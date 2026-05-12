const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { db } = require('../../utils/db');

function getConfig(guildId) {
  let cfg = db.prepare('SELECT * FROM automod_config WHERE guild_id = ?').get(guildId);
  if (!cfg) {
    db.prepare(`
      INSERT OR IGNORE INTO automod_config (guild_id) VALUES (?)
    `).run(guildId);
    cfg = db.prepare('SELECT * FROM automod_config WHERE guild_id = ?').get(guildId);
  }
  return cfg;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure the automatic moderation system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(s => s
      .setName('status')
      .setDescription('Show current AutoMod configuration')
    )

    .addSubcommand(s => s
      .setName('set')
      .setDescription('Toggle AutoMod features on or off')
      .addStringOption(o => o
        .setName('feature')
        .setDescription('Which feature to toggle')
        .setRequired(true)
        .addChoices(
          { name: '🚫 Anti-Spam',         value: 'anti_spam'         },
          { name: '🛡️ Anti-Raid',          value: 'anti_raid'         },
          { name: '🔗 Anti-Link',          value: 'anti_link'         },
          { name: '🔠 Anti-Caps',          value: 'anti_caps'         },
          { name: '📣 Anti-Mention Spam',  value: 'anti_mention_spam' },
        )
      )
      .addBooleanOption(o => o.setName('enabled').setDescription('Enable or disable').setRequired(true))
    )

    .addSubcommand(s => s
      .setName('thresholds')
      .setDescription('Tune AutoMod detection thresholds')
      .addIntegerOption(o => o
        .setName('spam_messages')
        .setDescription('Messages per window before mute (default 5)')
        .setMinValue(2).setMaxValue(20)
      )
      .addIntegerOption(o => o
        .setName('spam_window')
        .setDescription('Spam detection window in seconds (default 5)')
        .setMinValue(2).setMaxValue(30)
      )
      .addIntegerOption(o => o
        .setName('caps_percent')
        .setDescription('% of caps before flagging (default 70)')
        .setMinValue(50).setMaxValue(100)
      )
      .addIntegerOption(o => o
        .setName('mention_limit')
        .setDescription('Max mentions per message before action (default 5)')
        .setMinValue(2).setMaxValue(20)
      )
    )

    .addSubcommand(s => s
      .setName('muterole')
      .setDescription('Set the role applied when AutoMod mutes someone')
      .addRoleOption(o => o.setName('role').setDescription('The mute role').setRequired(true))
    )

    .addSubcommand(s => s
      .setName('whitelist')
      .setDescription('Whitelist a role from AutoMod (e.g. Staff)')
      .addRoleOption(o => o.setName('role').setDescription('Role to whitelist').setRequired(true))
    ),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const cfg     = getConfig(guildId);

    if (sub === 'status') {
      const bool  = v => v ? '🟢 Enabled' : '🔴 Disabled';
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🤖 AutoMod Configuration')
        .addFields(
          { name: '🚫 Anti-Spam',        value: `${bool(cfg.anti_spam)}\n${cfg.spam_threshold} msgs / ${cfg.spam_window_ms / 1000}s`,          inline: true },
          { name: '🛡️ Anti-Raid',         value: bool(cfg.anti_raid),                                                                            inline: true },
          { name: '🔗 Anti-Link',         value: bool(cfg.anti_link),                                                                            inline: true },
          { name: '🔠 Anti-Caps',         value: `${bool(cfg.anti_caps)}\n${cfg.caps_threshold}% threshold`,                                     inline: true },
          { name: '📣 Anti-Mention Spam', value: `${bool(cfg.anti_mention_spam)}\nMax ${cfg.mention_limit} mentions`,                            inline: true },
          { name: '🔇 Mute Role',         value: cfg.mute_role_id ? `<@&${cfg.mute_role_id}>` : '*(not set — will use timeout instead)*',        inline: true },
        )
        .setFooter({ text: 'Use /automod set or /automod thresholds to change settings' });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'set') {
      const feature = interaction.options.getString('feature');
      const enabled = interaction.options.getBoolean('enabled') ? 1 : 0;
      db.prepare(`UPDATE automod_config SET ${feature} = ? WHERE guild_id = ?`).run(enabled, guildId);
      return interaction.reply({
        content: `✅ **${feature.replace(/_/g, ' ')}** is now ${enabled ? '🟢 enabled' : '🔴 disabled'}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'thresholds') {
      const spamMsgs   = interaction.options.getInteger('spam_messages');
      const spamWindow = interaction.options.getInteger('spam_window');
      const capsPct    = interaction.options.getInteger('caps_percent');
      const mentionLim = interaction.options.getInteger('mention_limit');

      if (spamMsgs)   db.prepare('UPDATE automod_config SET spam_threshold = ? WHERE guild_id = ?').run(spamMsgs, guildId);
      if (spamWindow) db.prepare('UPDATE automod_config SET spam_window_ms = ? WHERE guild_id = ?').run(spamWindow * 1000, guildId);
      if (capsPct)    db.prepare('UPDATE automod_config SET caps_threshold = ? WHERE guild_id = ?').run(capsPct, guildId);
      if (mentionLim) db.prepare('UPDATE automod_config SET mention_limit  = ? WHERE guild_id = ?').run(mentionLim, guildId);

      return interaction.reply({ content: '✅ Thresholds updated.', flags: MessageFlags.Ephemeral });
    }

    if (sub === 'muterole') {
      const role = interaction.options.getRole('role');
      db.prepare('UPDATE automod_config SET mute_role_id = ? WHERE guild_id = ?').run(role.id, guildId);
      return interaction.reply({
        content: `✅ Mute role set to ${role}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'whitelist') {
      // Store whitelisted roles in automod_config as JSON in a new column
      // We'll use a simple approach — store comma-separated role IDs
      const role    = interaction.options.getRole('role');
      const current = cfg.whitelist_roles ? cfg.whitelist_roles.split(',') : [];
      if (!current.includes(role.id)) {
        current.push(role.id);
        db.prepare('UPDATE automod_config SET whitelist_roles = ? WHERE guild_id = ?')
          .run(current.join(','), guildId);
      }
      return interaction.reply({
        content: `✅ ${role} is now **whitelisted** from AutoMod.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
