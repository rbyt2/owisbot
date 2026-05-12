const { Events } = require('discord.js');
const { logEvent } = require('../modules/moderation/serverLogger');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member, client) {
    await logEvent(member.guild, 'member_leave', {
      fields: [
        { name: 'User',  value: `${member.user.tag} (${member.user.id})`, inline: true },
        { name: 'Roles', value: member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.toString()).join(', ') || 'None', inline: false },
      ],
    });
  },
};
