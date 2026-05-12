/**
 * modules/moderation/automodEngine.js
 *
 * Runs on every message. Checks the guild's automod_config and
 * takes action (delete, timeout, warn) when rules are violated.
 */

const { logEvent } = require('./serverLogger');
const { db }       = require('../../utils/db');

// In-memory spam tracker: Map<guildId, Map<userId, number[]>> (timestamps)
const spamTracker = new Map();

// In-memory raid tracker: Map<guildId, number[]> (join timestamps)
const raidTracker = new Map();

const LINK_REGEX = /https?:\/\/\S+|discord\.gg\/\S+/gi;

// ── Config loader ─────────────────────────────────────────────────────────────
function getConfig(guildId) {
  return db.prepare('SELECT * FROM automod_config WHERE guild_id = ?').get(guildId);
}

// ── Check if a member is whitelisted (staff / bot) ────────────────────────────
function isWhitelisted(member, cfg) {
  if (member.permissions.has('ManageMessages')) return true; // staff
  if (member.user.bot) return true;
  if (!cfg.whitelist_roles) return false;
  const whitelisted = cfg.whitelist_roles.split(',');
  return member.roles.cache.some(r => whitelisted.includes(r.id));
}

// ── Apply action: delete msg + timeout member ─────────────────────────────────
async function punish(message, cfg, reason) {
  try { await message.delete(); } catch { /* already deleted */ }

  // Warn in channel, auto-delete after 5s
  const warning = await message.channel.send(
    `⚠️ ${message.author}, your message was removed: **${reason}**`,
  ).catch(() => null);
  if (warning) setTimeout(() => warning.delete().catch(() => {}), 5000);

  // Timeout for 5 minutes
  const ms = 5 * 60 * 1000;
  try {
    await message.member.timeout(ms, `AutoMod: ${reason}`);
  } catch { /* cannot timeout */ }

  // Log
  await logEvent(
    message.guild,
    'automod_action',
    {
      fields: [
        { name: 'User',    value: `${message.author.tag} (${message.author.id})`, inline: true },
        { name: 'Channel', value: `${message.channel}`,                           inline: true },
        { name: 'Rule',    value: reason,                                          inline: true },
        { name: 'Content', value: message.content.slice(0, 500) || '*(empty)*',   inline: false },
      ],
    },
    message.channelId,
  );
}

// ── Main message handler ──────────────────────────────────────────────────────
async function runAutoMod(message) {
  if (!message.guild || !message.member) return;

  const cfg = getConfig(message.guild.id);
  if (!cfg) return;
  if (isWhitelisted(message.member, cfg)) return;

  // ── Anti-Spam ──────────────────────────────────────────────────────────────
  if (cfg.anti_spam) {
    if (!spamTracker.has(message.guild.id)) spamTracker.set(message.guild.id, new Map());
    const guildMap = spamTracker.get(message.guild.id);

    const now       = Date.now();
    const window    = cfg.spam_window_ms ?? 5000;
    const threshold = cfg.spam_threshold ?? 5;

    const timestamps = (guildMap.get(message.author.id) ?? [])
      .filter(t => now - t < window);
    timestamps.push(now);
    guildMap.set(message.author.id, timestamps);

    if (timestamps.length >= threshold) {
      guildMap.set(message.author.id, []);
      return punish(message, cfg, 'Sending messages too quickly');
    }
  }

  // ── Anti-Link ─────────────────────────────────────────────────────────────
  if (cfg.anti_link && LINK_REGEX.test(message.content)) {
    LINK_REGEX.lastIndex = 0;
    return punish(message, cfg, 'Links are not allowed');
  }

  // ── Anti-Mention Spam ─────────────────────────────────────────────────────
  if (cfg.anti_mention_spam) {
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    if (mentionCount > (cfg.mention_limit ?? 5)) {
      return punish(message, cfg, `Too many mentions (${mentionCount})`);
    }
  }

  // ── Anti-Caps ─────────────────────────────────────────────────────────────
  if (cfg.anti_caps && message.content.length > 8) {
    const upper   = (message.content.match(/[A-Z]/g) ?? []).length;
    const letters = (message.content.match(/[a-zA-Z]/g) ?? []).length;
    const pct     = letters > 0 ? (upper / letters) * 100 : 0;
    if (pct >= (cfg.caps_threshold ?? 70)) {
      return punish(message, cfg, 'Excessive use of capital letters');
    }
  }
}

// ── Raid detection (called from guildMemberAdd event) ─────────────────────────
async function runRaidCheck(member) {
  const cfg = getConfig(member.guild.id);
  if (!cfg || !cfg.anti_raid) return;

  const guildId = member.guild.id;
  const now     = Date.now();
  const WINDOW  = 10_000;   // 10 seconds
  const LIMIT   = 8;        // 8 joins in 10s = raid

  const joins = (raidTracker.get(guildId) ?? []).filter(t => now - t < WINDOW);
  joins.push(now);
  raidTracker.set(guildId, joins);

  if (joins.length >= LIMIT) {
    raidTracker.set(guildId, []); // reset

    await logEvent(member.guild, 'automod_action', {
      description: `🚨 **Possible raid detected!** ${joins.length} members joined within 10 seconds.`,
      fields: [{ name: 'Latest join', value: `${member.user.tag}`, inline: true }],
    });

    // Optionally kick the member (comment out if too aggressive)
    // await member.kick('AutoMod: Suspected raid').catch(() => {});
  }
}

module.exports = { runAutoMod, runRaidCheck };
