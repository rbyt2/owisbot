/**
 * modules/moderation/serverLogger.js
 *
 * The single source of truth for all server logging.
 * Every event (message_delete, member_ban, etc.) calls logEvent().
 * It reads the DB to find which channel to post to and whether the event is enabled.
 */

const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { db } = require('../../utils/db');

// ── All supported log event types ────────────────────────────────────────────
const LOG_EVENTS = {
  // Moderation actions
  member_ban:        { label: 'Member Banned',          color: 0xed4245, emoji: '🔨' },
  member_unban:      { label: 'Member Unbanned',         color: 0x57f287, emoji: '🔓' },
  member_kick:       { label: 'Member Kicked',           color: 0xff7043, emoji: '👢' },
  member_timeout:    { label: 'Member Timed Out',        color: 0xffa500, emoji: '⏳' },
  member_untimeout:  { label: 'Timeout Removed',         color: 0x57f287, emoji: '✅' },
  member_warn:       { label: 'Member Warned',           color: 0xfee75c, emoji: '⚠️'  },
  member_unwarn:     { label: 'Warning Removed',         color: 0x57f287, emoji: '🗑️'  },
  // Message events
  message_delete:    { label: 'Message Deleted',         color: 0xed4245, emoji: '🗑️'  },
  message_edit:      { label: 'Message Edited',          color: 0xfee75c, emoji: '✏️'  },
  message_purge:     { label: 'Messages Purged',         color: 0xff7043, emoji: '🧹' },
  // Member events
  member_join:       { label: 'Member Joined',           color: 0x57f287, emoji: '📥' },
  member_leave:      { label: 'Member Left',             color: 0x747f8d, emoji: '📤' },
  member_role_add:   { label: 'Role Added to Member',    color: 0x5865f2, emoji: '🎭' },
  member_role_remove:{ label: 'Role Removed from Member',color: 0x747f8d, emoji: '🎭' },
  member_nick:       { label: 'Nickname Changed',        color: 0xfee75c, emoji: '📝' },
  // Server events
  channel_create:    { label: 'Channel Created',         color: 0x57f287, emoji: '📢' },
  channel_delete:    { label: 'Channel Deleted',         color: 0xed4245, emoji: '🔇' },
  role_create:       { label: 'Role Created',            color: 0x57f287, emoji: '🏷️'  },
  role_delete:       { label: 'Role Deleted',            color: 0xed4245, emoji: '🏷️'  },
  // Automod
  automod_action:    { label: 'AutoMod Action',          color: 0xff7043, emoji: '🤖' },
};

// ── DB helpers ────────────────────────────────────────────────────────────────

/** Get the log config row for a guild+event. */
function getConfig(guildId, event) {
  return db.prepare(
    'SELECT enabled, channel_id FROM log_config WHERE guild_id = ? AND event = ?',
  ).get(guildId, event);
}

/** Get the fallback "default" channel (if no per-event channel is set). */
function getDefaultChannel(guildId) {
  return db.prepare(
    "SELECT channel_id FROM log_config WHERE guild_id = ? AND event = 'default'",
  ).get(guildId)?.channel_id ?? null;
}

/** Check if a channel is in the ignore list. */
function isIgnored(guildId, channelId) {
  return !!db.prepare(
    'SELECT 1 FROM log_ignored_channels WHERE guild_id = ? AND channel_id = ?',
  ).get(guildId, channelId);
}

// ── Main dispatch function ────────────────────────────────────────────────────

/**
 * Post a log entry to the appropriate channel.
 *
 * @param {Guild}  guild   - discord.js Guild object
 * @param {string} event   - one of the LOG_EVENTS keys
 * @param {Object} fields  - embed fields { description?, fields[], footer? }
 * @param {string} [sourceChannelId] - if provided, checks the ignore list
 */
async function logEvent(guild, event, { description = '', fields = [], footer = null } = {}, sourceChannelId = null) {
  if (!guild) return;

  // Check source channel ignore list
  if (sourceChannelId && isIgnored(guild.id, sourceChannelId)) return;

  const meta   = LOG_EVENTS[event];
  if (!meta) return;

  // Find the target log channel
  const cfg    = getConfig(guild.id, event);
  const enabled = cfg ? cfg.enabled : 1;  // default: on if never configured
  if (!enabled) return;

  const channelId = cfg?.channel_id ?? getDefaultChannel(guild.id);
  if (!channelId) return;

  const logChannel = guild.channels.cache.get(channelId);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.emoji}  ${meta.label}`)
    .setTimestamp();

  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);
  if (footer)        embed.setFooter({ text: footer });

  try {
    await logChannel.send({ embeds: [embed] });
  } catch (e) {
    console.error(`[Logger] Failed to post ${event} log:`, e.message);
  }
}

// ── Mod-action DB logger (writes to mod_logs table + posts embed) ─────────────

/**
 * Record a moderation action in the DB and post a log embed.
 */
async function logModAction(guild, { action, target, mod, reason = 'No reason provided', duration = null }) {
  // Write to DB
  db.prepare(
    'INSERT INTO mod_logs (guild_id, action, target_id, mod_id, reason, duration) VALUES (?,?,?,?,?,?)',
  ).run(guild.id, action, target.id, mod.id, reason, duration);

  // Post embed
  const fields = [
    { name: 'User',       value: `${target} (${target.id})`, inline: true  },
    { name: 'Moderator',  value: `${mod}`,                   inline: true  },
    { name: 'Reason',     value: reason,                     inline: false },
  ];
  if (duration) fields.splice(2, 0, { name: 'Duration', value: duration, inline: true });

  await logEvent(guild, action, { fields });
}

module.exports = { logEvent, logModAction, LOG_EVENTS, isIgnored };
