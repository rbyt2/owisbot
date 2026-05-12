const { Events } = require('discord.js');
const { logEvent } = require('../modules/moderation/serverLogger');

module.exports = {
  name: Events.GuildBanRemove,
  async execute(ban, client) {
    await logEvent(ban.guild, 'member_unban', {
      fields: [
        { name: 'User', value: `${ban.user.tag} (${ban.user.id})`, inline: true },
      ],
    });
  },
};
