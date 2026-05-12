const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { db } = require('../../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View or manage warnings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all warnings for a user')
      .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('clear')
      .setDescription('Clear ALL warnings for a user')
      .addUserOption(o => o.setName('user').setDescription('User to clear').setRequired(true))
    ),

  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');
    const guild  = interaction.guild;

    if (sub === 'list') {
      const rows = db.prepare(
        'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC',
      ).all(guild.id, target.id);

      if (!rows.length) {
        return interaction.reply({
          content: `✅ **${target.tag}** has no warnings on record.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const lines = rows.map(r => {
        const time = `<t:${r.created_at}:d>`;
        return `\`#${r.id}\` ${time} — <@${r.mod_id}> — ${r.reason}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(`⚠️ Warnings — ${target.tag}`)
        .setThumbnail(target.displayAvatarURL())
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${rows.length} warning${rows.length !== 1 ? 's' : ''} total` });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'clear') {
      const { changes } = db.prepare(
        'DELETE FROM warnings WHERE guild_id = ? AND user_id = ?',
      ).run(guild.id, target.id);

      return interaction.reply({
        content: `🗑️ Cleared **${changes}** warning${changes !== 1 ? 's' : ''} from **${target.tag}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
