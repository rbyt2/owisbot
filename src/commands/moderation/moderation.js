const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { db }            = require('../../utils/db');
const { logModAction }  = require('../../modules/moderation/serverLogger');

// ── Duration parser  "1d2h30m" → ms ─────────────────────────────────────────
function parseDuration(str) {
  if (!str) return null;
  const re = /(\d+)\s*(d|h|m|s)/gi;
  let ms = 0, m;
  while ((m = re.exec(str)) !== null) {
    const v = parseInt(m[1]);
    switch (m[2].toLowerCase()) {
      case 'd': ms += v * 86_400_000; break;
      case 'h': ms += v *  3_600_000; break;
      case 'm': ms += v *     60_000; break;
      case 's': ms += v *      1_000; break;
    }
  }
  return ms || null;
}

function humanDuration(ms) {
  if (!ms) return null;
  const parts = [];
  const d = Math.floor(ms / 86_400_000); if (d) { parts.push(`${d}d`); ms %= 86_400_000; }
  const h = Math.floor(ms /  3_600_000); if (h) { parts.push(`${h}h`); ms %=  3_600_000; }
  const n = Math.floor(ms /     60_000); if (n) { parts.push(`${n}m`); ms %=     60_000; }
  const s = Math.floor(ms /      1_000); if (s)   parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

// ── DM user before action ────────────────────────────────────────────────────
async function dmUser(user, action, guild, reason, duration) {
  const lines = [
    `**Server:** ${guild.name}`,
    `**Action:** ${action}`,
    `**Reason:** ${reason}`,
  ];
  if (duration) lines.push(`**Duration:** ${duration}`);
  try {
    await user.send(lines.join('\n'));
  } catch { /* DMs closed — silently skip */ }
}

// ── Permission check helper ───────────────────────────────────────────────────
function canAct(interaction, target) {
  const bot = interaction.guild.members.me;
  if (!target.manageable) return '❌ I cannot perform actions on that member — they may be above me in the role hierarchy.';
  if (target.id === interaction.user.id) return '❌ You cannot perform this action on yourself.';
  if (target.id === interaction.guild.ownerId) return '❌ You cannot perform this action on the server owner.';
  if (interaction.member.roles.highest.comparePositionTo(target.roles.highest) <= 0)
    return '❌ That member has an equal or higher role than you.';
  return null;
}

// ── Reply helper ──────────────────────────────────────────────────────────────
async function ok(interaction, emoji, text) {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setDescription(`${emoji}  ${text}`)
    .setTimestamp();
  return interaction.reply({ embeds: [embed] });
}
async function err(interaction, text) {
  return interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
}

// ── Command ───────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('All moderation actions in one place')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

    // ── BAN ──────────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('ban')
      .setDescription('Ban a member from the server')
      .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason for the ban'))
      .addIntegerOption(o => o.setName('delete_days').setDescription('Days of messages to delete (0–7)').setMinValue(0).setMaxValue(7))
    )

    // ── UNBAN ─────────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('unban')
      .setDescription('Unban a user by their ID')
      .addStringOption(o => o.setName('user_id').setDescription('User ID to unban').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason for unban'))
    )

    // ── KICK ──────────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('kick')
      .setDescription('Kick a member from the server')
      .addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason for the kick'))
    )

    // ── TIMEOUT ───────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('timeout')
      .setDescription('Timeout a member (mutes them for a set duration)')
      .addUserOption(o => o.setName('user').setDescription('Member to timeout').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 2h, 1d (max 28d)').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason'))
    )

    // ── UNTIMEOUT ─────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('untimeout')
      .setDescription('Remove a timeout from a member')
      .addUserOption(o => o.setName('user').setDescription('Member to untimeout').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason'))
    )

    // ── WARN ──────────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('warn')
      .setDescription('Issue a warning to a member')
      .addUserOption(o => o.setName('user').setDescription('Member to warn').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason for the warning').setRequired(true))
    )

    // ── UNWARN ────────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('unwarn')
      .setDescription('Remove a warning by its ID')
      .addIntegerOption(o => o.setName('warning_id').setDescription('Warning ID (from /warnings)').setRequired(true))
    )

    // ── SOFTBAN ───────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('softban')
      .setDescription('Ban then immediately unban to purge messages')
      .addUserOption(o => o.setName('user').setDescription('Member to softban').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason'))
    ),

  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const guild  = interaction.guild;
    const mod    = interaction.user;

    // ── BAN ───────────────────────────────────────────────────────────────────
    if (sub === 'ban') {
      const target = interaction.options.getMember('user');
      const reason = interaction.options.getString('reason') ?? 'No reason provided';
      const days   = interaction.options.getInteger('delete_days') ?? 0;
      if (!target) return err(interaction, '❌ That user is not in this server. Use `/moderation hackban` for external users.');
      const check  = canAct(interaction, target);
      if (check)   return err(interaction, check);
      await dmUser(target.user, 'Banned', guild, reason, null);
      await guild.members.ban(target, { reason, deleteMessageDays: days });
      await logModAction(guild, { action: 'member_ban', target: target.user, mod, reason });
      return ok(interaction, '🔨', `**${target.user.tag}** has been banned.\n**Reason:** ${reason}`);
    }

    // ── UNBAN ─────────────────────────────────────────────────────────────────
    if (sub === 'unban') {
      const userId = interaction.options.getString('user_id');
      const reason = interaction.options.getString('reason') ?? 'No reason provided';
      try {
        const user = await interaction.client.users.fetch(userId);
        await guild.members.unban(userId, reason);
        await logModAction(guild, { action: 'member_unban', target: user, mod, reason });
        return ok(interaction, '🔓', `**${user.tag}** has been unbanned.\n**Reason:** ${reason}`);
      } catch {
        return err(interaction, '❌ Could not find a ban for that user ID.');
      }
    }

    // ── KICK ──────────────────────────────────────────────────────────────────
    if (sub === 'kick') {
      const target = interaction.options.getMember('user');
      const reason = interaction.options.getString('reason') ?? 'No reason provided';
      if (!target) return err(interaction, '❌ That member is not in this server.');
      const check  = canAct(interaction, target);
      if (check)   return err(interaction, check);
      await dmUser(target.user, 'Kicked', guild, reason, null);
      await target.kick(reason);
      await logModAction(guild, { action: 'member_kick', target: target.user, mod, reason });
      return ok(interaction, '👢', `**${target.user.tag}** has been kicked.\n**Reason:** ${reason}`);
    }

    // ── TIMEOUT ───────────────────────────────────────────────────────────────
    if (sub === 'timeout') {
      const target   = interaction.options.getMember('user');
      const rawDur   = interaction.options.getString('duration');
      const reason   = interaction.options.getString('reason') ?? 'No reason provided';
      const ms       = parseDuration(rawDur);
      const MAX_28D  = 28 * 24 * 60 * 60 * 1000;

      if (!target) return err(interaction, '❌ Member not found.');
      const check  = canAct(interaction, target);
      if (check)   return err(interaction, check);
      if (!ms)     return err(interaction, '❌ Invalid duration. Examples: `10m`, `2h`, `1d`.');
      if (ms > MAX_28D) return err(interaction, '❌ Maximum timeout duration is **28 days**.');

      const human = humanDuration(ms);
      await dmUser(target.user, 'Timed Out', guild, reason, human);
      await target.timeout(ms, reason);
      await logModAction(guild, { action: 'member_timeout', target: target.user, mod, reason, duration: human });
      return ok(interaction, '⏳', `**${target.user.tag}** has been timed out for **${human}**.\n**Reason:** ${reason}`);
    }

    // ── UNTIMEOUT ─────────────────────────────────────────────────────────────
    if (sub === 'untimeout') {
      const target = interaction.options.getMember('user');
      const reason = interaction.options.getString('reason') ?? 'No reason provided';
      if (!target) return err(interaction, '❌ Member not found.');
      await target.timeout(null, reason);
      await logModAction(guild, { action: 'member_untimeout', target: target.user, mod, reason });
      return ok(interaction, '✅', `Timeout removed from **${target.user.tag}**.\n**Reason:** ${reason}`);
    }

    // ── WARN ──────────────────────────────────────────────────────────────────
    if (sub === 'warn') {
      const target = interaction.options.getMember('user');
      const reason = interaction.options.getString('reason');
      if (!target) return err(interaction, '❌ Member not found.');
      const check = canAct(interaction, target);
      if (check)  return err(interaction, check);

      const info = db.prepare(
        'INSERT INTO warnings (guild_id, user_id, mod_id, reason) VALUES (?,?,?,?)',
      ).run(guild.id, target.id, mod.id, reason);

      const count = db.prepare(
        'SELECT COUNT(*) as n FROM warnings WHERE guild_id = ? AND user_id = ?',
      ).get(guild.id, target.id).n;

      await dmUser(target.user, `Warning #${count}`, guild, reason, null);
      await logModAction(guild, { action: 'member_warn', target: target.user, mod, reason });
      return ok(interaction, '⚠️', `**${target.user.tag}** has been warned (warning #${count}, ID: \`${info.lastInsertRowid}\`).\n**Reason:** ${reason}`);
    }

    // ── UNWARN ────────────────────────────────────────────────────────────────
    if (sub === 'unwarn') {
      const warnId = interaction.options.getInteger('warning_id');
      const warn   = db.prepare('SELECT * FROM warnings WHERE id = ? AND guild_id = ?').get(warnId, guild.id);
      if (!warn) return err(interaction, `❌ No warning found with ID \`${warnId}\` in this server.`);

      db.prepare('DELETE FROM warnings WHERE id = ?').run(warnId);
      const target = await interaction.client.users.fetch(warn.user_id).catch(() => ({ id: warn.user_id, tag: 'Unknown User' }));
      await logModAction(guild, { action: 'member_unwarn', target, mod, reason: `Removed warning #${warnId}` });
      return ok(interaction, '🗑️', `Warning \`#${warnId}\` removed from **${target.tag ?? target.id}**.`);
    }

    // ── SOFTBAN ───────────────────────────────────────────────────────────────
    if (sub === 'softban') {
      const target = interaction.options.getMember('user');
      const reason = interaction.options.getString('reason') ?? 'No reason provided';
      if (!target) return err(interaction, '❌ Member not found.');
      const check  = canAct(interaction, target);
      if (check)   return err(interaction, check);
      await dmUser(target.user, 'Softbanned (message purge)', guild, reason, null);
      await guild.members.ban(target, { reason: `Softban: ${reason}`, deleteMessageDays: 7 });
      await guild.members.unban(target.id, 'Softban — immediate unban');
      await logModAction(guild, { action: 'member_ban', target: target.user, mod, reason: `[Softban] ${reason}` });
      return ok(interaction, '🧹', `**${target.user.tag}** has been softbanned (kicked + last 7 days of messages deleted).\n**Reason:** ${reason}`);
    }
  },
};
