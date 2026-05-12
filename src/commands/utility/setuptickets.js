const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setuptickets')
    .setDescription('Post the ticket panel in this channel (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt =>
      opt
        .setName('description')
        .setDescription('Custom description shown on the panel')
        .setRequired(false),
    ),

  async execute(interaction) {
    const desc =
      interaction.options.getString('description') ??
      'Need help from the staff team? Click the button below to open a private ticket. ' +
      'A staff member will be with you as soon as possible.';

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🎫 Support Tickets')
      .setDescription(desc)
      .addFields(
        { name: '❓ Help',         value: 'Questions or general support', inline: true },
        { name: '🚨 Report',       value: 'Report a user or incident',    inline: true },
        { name: '⚖️ Appeal',       value: 'Appeal a moderation action',   inline: true },
      )
      .setFooter({ text: 'One ticket per person at a time.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:open')
        .setLabel('Open a Ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({
      content: '✅ Ticket panel posted!',
      flags: MessageFlags.Ephemeral,
    });
  },
};
