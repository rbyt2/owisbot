const { Events } = require('discord.js');
const { logEvent } = require('../modules/moderation/serverLogger');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMsg, newMsg, client) {
    if (!newMsg.guild) return;
    if (newMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return; // embed resolving, not a real edit

    await logEvent(
      newMsg.guild,
      'message_edit',
      {
        fields: [
          { name: 'Author',   value: `${newMsg.author?.tag ?? 'Unknown'} (${newMsg.author?.id ?? '?'})`, inline: true },
          { name: 'Channel',  value: `${newMsg.channel}`,                                                inline: true },
          { name: 'Jump',     value: `[View message](${newMsg.url})`,                                    inline: true },
          { name: 'Before',   value: (oldMsg.content || '*(empty)*').slice(0, 1024),                     inline: false },
          { name: 'After',    value: (newMsg.content || '*(empty)*').slice(0, 1024),                     inline: false },
        ],
      },
      newMsg.channelId,
    );
  },
};
