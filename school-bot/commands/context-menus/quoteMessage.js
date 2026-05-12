const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  AttachmentBuilder,
  MessageFlags,
} = require('discord.js');
const { generateQuoteImage } = require('../../modules/quotebot/generateQuote');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Quote as Image')
    .setType(ApplicationCommandType.Message),

  async execute(interaction) {
    const message = interaction.targetMessage;

    // Guard: skip empty messages (e.g. image-only posts)
    if (!message.content || message.content.trim().length === 0) {
      return interaction.reply({
        content: '❌ That message has no text content to quote.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    const timestamp = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(message.createdAt);

    const imageBuffer = await generateQuoteImage({
      content: message.content,
      authorName: message.member?.displayName ?? message.author.username,
      authorAvatar: message.author.displayAvatarURL({ extension: 'png', size: 256 }),
      timestamp,
      guildName: interaction.guild?.name,
    });

    const attachment = new AttachmentBuilder(imageBuffer, { name: 'quote.png' });

    await interaction.editReply({
      content: `📌 Quoted by ${interaction.user}`,
      files: [attachment],
    });
  },
};
