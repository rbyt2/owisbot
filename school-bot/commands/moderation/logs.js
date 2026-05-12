const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { db }        = require('../../utils/db');
const { LOG_EVENTS } = require('../../modules/moderation/serverLogger');

// All valid event choices for the slash command
const EVENT_CHOICES = [
  { name: '📋 All Events (set default channel / toggle all)', value: 'all' },
  ...Object.entries(LOG_EVENTS).map(([k, v]) => ({ name: `${v.emoji} ${v.label}`, value: k })),
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure the server logging system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ── Enable ───────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('enable')
      .setDescription('Enable a log event (or all events)')
      .addStringOption(o => o
        .setName('event')
        .setDescription('Which event to enable')
        .setRequired(true)
        .addChoices(...EVENT_CHOICES)
      )
    )

    // ── Disable ──────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('disable')
      .setDescription('Disable a log event (or all events)')
      .addStringOption(o => o
        .setName('event')
        .setDescription('Which event to disable')
        .setRequired(true)
        .addChoices(...EVENT_CHOICES)
      )
    )

    // ── Set Channel ───────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('setchannel')
      .setDescription('Set the channel for a log event (or the default for all)')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to send logs to')
        .setRequired(true)
      )
      .addStringOption(o => o
        .setName('event')
        .setDescription('Which event (leave blank = sets the default for everything)')
        .addChoices(...EVENT_CHOICES)
      )
    )

    // ── Ignore Channel ────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('ignore')
      .setDescription('Ignore a channel — message events from it won\'t be logged')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to ignore')
        .setRequired(true)
      )
    )

    // ── Unignore Channel ──────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('unignore')
      .setDescription('Remove a channel from the ignore list')
      .addChannelOption(o => o
        .setName('channel')
        .setDescription('Channel to unignore')
        .setRequired(true)
      )
    )

    // ── Status ────────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('status')
      .setDescription('Show the current logging configuration for this server')
    ),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── Helper: upsert a single event row ────────────────────────────────────
    const upsert = (event, enabled, channelId) => {
      db.prepare(`
        INSERT INTO log_config (guild_id, event, enabled, channel_id)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(guild_id, event) DO UPDATE SET
          enabled    = COALESCE(excluded.enabled,    enabled),
          channel_id = COALESCE(excluded.channel_id, channel_id)
      `).run(guildId, event, enabled, channelId ?? null);
    };

    const setEnabled = (event, enabled) => {
      db.prepare(`
        INSERT INTO log_config (guild_id, event, enabled)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id, event) DO UPDATE SET enabled = excluded.enabled
      `).run(guildId, event, enabled ? 1 : 0);
    };

    // ── ENABLE ────────────────────────────────────────────────────────────────
    if (sub === 'enable') {
      const event = interaction.options.getString('event');
      if (event === 'all') {
        for (const key of Object.keys(LOG_EVENTS)) setEnabled(key, true);
        return interaction.reply({ content: '✅ All log events **enabled**.', flags: MessageFlags.Ephemeral });
      }
      setEnabled(event, true);
      return interaction.reply({
        content: `✅ Log event **${LOG_EVENTS[event]?.label ?? event}** enabled.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── DISABLE ───────────────────────────────────────────────────────────────
    if (sub === 'disable') {
      const event = interaction.options.getString('event');
      if (event === 'all') {
        for (const key of Object.keys(LOG_EVENTS)) setEnabled(key, false);
        return interaction.reply({ content: '🔕 All log events **disabled**.', flags: MessageFlags.Ephemeral });
      }
      setEnabled(event, false);
      return interaction.reply({
        content: `🔕 Log event **${LOG_EVENTS[event]?.label ?? event}** disabled.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── SET CHANNEL ───────────────────────────────────────────────────────────
    if (sub === 'setchannel') {
      const channel = interaction.options.getChannel('channel');
      const event   = interaction.options.getString('event') ?? 'all';

      if (event === 'all') {
        // Set the 'default' sentinel — used as fallback for all events
        db.prepare(`
          INSERT INTO log_config (guild_id, event, enabled, channel_id)
          VALUES (?, 'default', 1, ?)
          ON CONFLICT(guild_id, event) DO UPDATE SET channel_id = excluded.channel_id
        `).run(guildId, channel.id);
        return interaction.reply({
          content: `✅ Default log channel set to ${channel}. All events without a specific channel will log there.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      db.prepare(`
        INSERT INTO log_config (guild_id, event, enabled, channel_id)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(guild_id, event) DO UPDATE SET channel_id = excluded.channel_id
      `).run(guildId, event, channel.id);

      return interaction.reply({
        content: `✅ **${LOG_EVENTS[event]?.label ?? event}** events will now log to ${channel}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── IGNORE ────────────────────────────────────────────────────────────────
    if (sub === 'ignore') {
      const channel = interaction.options.getChannel('channel');
      db.prepare(`
        INSERT OR IGNORE INTO log_ignored_channels (guild_id, channel_id) VALUES (?, ?)
      `).run(guildId, channel.id);
      return interaction.reply({
        content: `🔇 ${channel} is now **ignored** — message events from it won't be logged.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── UNIGNORE ──────────────────────────────────────────────────────────────
    if (sub === 'unignore') {
      const channel = interaction.options.getChannel('channel');
      db.prepare('DELETE FROM log_ignored_channels WHERE guild_id = ? AND channel_id = ?').run(guildId, channel.id);
      return interaction.reply({
        content: `🔊 ${channel} has been **unignored** and will be logged again.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── STATUS ────────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const rows     = db.prepare('SELECT * FROM log_config WHERE guild_id = ?').all(guildId);
      const ignored  = db.prepare('SELECT channel_id FROM log_ignored_channels WHERE guild_id = ?').all(guildId);
      const configMap = Object.fromEntries(rows.map(r => [r.event, r]));

      const defaultRow   = configMap['default'];
      const defaultCh    = defaultRow?.channel_id ? `<#${defaultRow.channel_id}>` : '*(not set)*';

      const lines = Object.entries(LOG_EVENTS).map(([key, meta]) => {
        const row     = configMap[key];
        const enabled = row ? (row.enabled ? '🟢' : '🔴') : '🟢'; // default on
        const ch      = row?.channel_id ? `<#${row.channel_id}>` : defaultCh;
        return `${enabled} ${meta.emoji} **${meta.label}** → ${ch}`;
      });

      const ignoredLine = ignored.length
        ? ignored.map(r => `<#${r.channel_id}>`).join(', ')
        : '*None*';

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📋 Logging Configuration')
        .setDescription(lines.join('\n'))
        .addFields(
          { name: 'Default Channel',   value: defaultCh,   inline: true },
          { name: 'Ignored Channels',  value: ignoredLine, inline: false },
        )
        .setFooter({ text: 'Use /logs setchannel, /logs enable, /logs disable to configure' });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
