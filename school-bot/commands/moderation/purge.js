const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { logEvent } = require('../../modules/moderation/serverLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk-delete messages from this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

    .addIntegerOption(o => o
      .setName('amount')
      .setDescription('Number of messages to delete (1–100)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
    )
    .addUserOption(o => o
      .setName('user')
      .setDescription('Only delete messages from this user')
    )
    .addBooleanOption(o => o
      .setName('bots_only')
      .setDescription('Only delete bot messages')
    ),

  async execute(interaction) {
    const amount   = interaction.options.getInteger('amount');
    const filterUser = interaction.options.getUser('user');
    const botsOnly   = interaction.options.getBoolean('bots_only') ?? false;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Fetch messages
    let messages = await interaction.channel.messages.fetch({ limit: 100 });

    // Filter
    if (filterUser) messages = messages.filter(m => m.author.id === filterUser.id);
    if (botsOnly)   messages = messages.filter(m => m.author.bot);

    // Discord only allows bulk-delete of messages < 14 days old
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    messages = messages
      .filter(m => m.createdTimestamp > twoWeeksAgo)
      .first(amount);

    if (!messages.length) {
      return interaction.editReply('❌ No eligible messages found (messages older than 14 days cannot be bulk-deleted).');
    }

    const deleted = await interaction.channel.bulkDelete(messages, true);

    await logEvent(
      interaction.guild,
      'message_purge',
      {
        fields: [
          { name: 'Channel',    value: `${interaction.channel}`,         inline: true },
          { name: 'Deleted',    value: `${deleted.size} messages`,       inline: true },
          { name: 'Moderator',  value: `${interaction.user}`,            inline: true },
          ...(filterUser ? [{ name: 'Filter', value: `${filterUser}`, inline: true }] : []),
          ...(botsOnly   ? [{ name: 'Filter', value: 'Bots only',     inline: true }] : []),
        ],
      },
    );

    await interaction.editReply(
      `🧹 Deleted **${deleted.size}** message${deleted.size !== 1 ? 's' : ''}${filterUser ? ` from ${filterUser.tag}` : ''}.`,
    );
  },
};
