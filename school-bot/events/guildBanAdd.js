const { Events } = require('discord.js');
const { logEvent } = require('../modules/moderation/serverLogger');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban, client) {
    await logEvent(ban.guild, 'member_ban', {
      fields: [
        { name: 'User',   value: `${ban.user.tag} (${ban.user.id})`, inline: true },
        { name: 'Reason', value: ban.reason ?? 'No reason provided',  inline: true },
      ],
    });
  },
};
