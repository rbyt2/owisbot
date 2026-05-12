const { Events } = require('discord.js');
const { logEvent } = require('../modules/moderation/serverLogger');

// ── Channel Create ────────────────────────────────────────────────────────────
module.exports = [
  {
    name: Events.ChannelCreate,
    async execute(channel, client) {
      if (!channel.guild) return;
      await logEvent(channel.guild, 'channel_create', {
        fields: [
          { name: 'Channel', value: `${channel} (${channel.name})`, inline: true },
          { name: 'Type',    value: channel.type.toString(),         inline: true },
        ],
      });
    },
  },
  {
    name: Events.ChannelDelete,
    async execute(channel, client) {
      if (!channel.guild) return;
      await logEvent(channel.guild, 'channel_delete', {
        fields: [
          { name: 'Channel', value: channel.name,         inline: true },
          { name: 'Type',    value: channel.type.toString(), inline: true },
        ],
      });
    },
  },
  {
    name: Events.GuildRoleCreate,
    async execute(role, client) {
      await logEvent(role.guild, 'role_create', {
        fields: [{ name: 'Role', value: `${role} (${role.name})`, inline: true }],
      });
    },
  },
  {
    name: Events.GuildRoleDelete,
    async execute(role, client) {
      await logEvent(role.guild, 'role_delete', {
        fields: [{ name: 'Role', value: role.name, inline: true }],
      });
    },
  },
];
