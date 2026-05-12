const { EmbedBuilder, Events } = require('discord.js');

const STAR_THRESHOLD = 3;     // number of ⭐ needed
const STAR_EMOJI     = '⭐';
const BOARD_NAME     = 'starboard';

// Cache to avoid double-posting
const posted = new Set();

module.exports = {
  name: Events.MessageReactionAdd,

  async execute(reaction, user, client) {
    // Fetch partial reactions/messages if needed
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    if (reaction.emoji.name !== STAR_EMOJI) return;
    if (reaction.count < STAR_THRESHOLD)    return;
    if (posted.has(reaction.message.id))    return;

    const msg   = reaction.message;
    const guild = msg.guild;
    if (!guild) return;

    const starboard = guild.channels.cache.find(c => c.name === BOARD_NAME);
    if (!starboard) return;

    // Don't repost if already in starboard
    if (msg.channelId === starboard.id) return;

    posted.add(msg.id);

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setAuthor({
        name:    msg.author.displayName,
        iconURL: msg.author.displayAvatarURL(),
      })
      .setDescription(msg.content || '*No text content*')
      .addFields({ name: 'Source', value: `[Jump to message](${msg.url})` })
      .setTimestamp(msg.createdAt);

    // Attach first image if present
    const img = msg.attachments.find(a => a.contentType?.startsWith('image/'));
    if (img) embed.setImage(img.url);

    await starboard.send({
      content: `${STAR_EMOJI} **${reaction.count}** in <#${msg.channelId}>`,
      embeds: [embed],
    });
  },
};
