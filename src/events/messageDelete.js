const { Events } = require('discord.js');
const { logEvent } = require('../modules/moderation/serverLogger');

module.exports = {
  name: Events.MessageDelete,
  async execute(message, client) {
    if (!message.guild) return;
    if (message.author?.bot) return;
    if (!message.content && message.attachments.size === 0) return; // partial with no data

    const fields = [
      { name: 'Author',  value: message.author ? `${message.author.tag} (${message.author.id})` : 'Unknown', inline: true },
      { name: 'Channel', value: `${message.channel ?? `<#${message.channelId}>`}`,                           inline: true },
    ];

    if (message.content) {
      fields.push({ name: 'Content', value: message.content.slice(0, 1024), inline: false });
    }
    if (message.attachments.size > 0) {
      fields.push({ name: 'Attachments', value: message.attachments.map(a => a.url).join('\n').slice(0, 512), inline: false });
    }

    await logEvent(message.guild, 'message_delete', { fields }, message.channelId);
  },
};
