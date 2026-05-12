const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { db } = require('../../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Manage tickets (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

    // ── Subcommands ──────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all open tickets')
        .addStringOption(opt =>
          opt
            .setName('status')
            .setDescription('Filter by status (default: open)')
            .addChoices(
              { name: 'Open',   value: 'open'   },
              { name: 'Closed', value: 'closed' },
              { name: 'All',    value: 'all'    },
            ),
        ),
    )

    .addSubcommand(sub =>
      sub
        .setName('info')
        .setDescription('Get info on the ticket in the current channel'),
    )

    .addSubcommand(sub =>
      sub
        .setName('close')
        .setDescription('Force-close the ticket in the current channel'),
    )

    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a user to the current ticket')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to add').setRequired(true),
        ),
    )

    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a user from the current ticket')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to remove').setRequired(true),
        ),
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const status = interaction.options.getString('status') ?? 'open';
      const rows   = status === 'all'
        ? db.prepare('SELECT * FROM tickets ORDER BY id DESC LIMIT 20').all()
        : db.prepare('SELECT * FROM tickets WHERE status = ? ORDER BY id DESC LIMIT 20').all(status);

      if (!rows.length) {
        return interaction.reply({ content: `📭 No ${status} tickets found.`, flags: MessageFlags.Ephemeral });
      }

      const lines = rows.map(t =>
        `\`#${t.id}\` <#${t.channel_id}> — <@${t.user_id}> · **${t.category}** · ${t.status}` +
        (t.claimed_by ? ` · claimed by <@${t.claimed_by}>` : ''),
      );

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🎫 Tickets — ${status}`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Showing up to 20 results` });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // ── INFO ──────────────────────────────────────────────────────────────────
    if (sub === 'info') {
      const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channelId);
      if (!ticket) {
        return interaction.reply({ content: '❌ This channel is not a ticket.', flags: MessageFlags.Ephemeral });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🎫 Ticket #${ticket.id}`)
        .addFields(
          { name: 'Opened by',  value: `<@${ticket.user_id}>`,                               inline: true },
          { name: 'Category',   value: ticket.category,                                       inline: true },
          { name: 'Status',     value: ticket.status,                                         inline: true },
          { name: 'Claimed by', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'None', inline: true },
          { name: 'Opened',     value: `<t:${ticket.created_at}:F>`,                          inline: true },
        );

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // ── CLOSE ─────────────────────────────────────────────────────────────────
    if (sub === 'close') {
      const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channelId);
      if (!ticket) {
        return interaction.reply({ content: '❌ This channel is not a ticket.', flags: MessageFlags.Ephemeral });
      }
      const { closeTicket } = require('../../modules/tickets/ticketManager');
      return closeTicket(interaction, ticket.id);
    }

    // ── ADD ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channelId);
      if (!ticket) {
        return interaction.reply({ content: '❌ This channel is not a ticket.', flags: MessageFlags.Ephemeral });
      }

      const target = interaction.options.getMember('user');
      await interaction.channel.permissionOverwrites.edit(target, {
        ViewChannel: true,
        SendMessages: true,
      });

      return interaction.reply({ content: `✅ Added ${target} to the ticket.`, flags: MessageFlags.Ephemeral });
    }

    // ── REMOVE ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channelId);
      if (!ticket) {
        return interaction.reply({ content: '❌ This channel is not a ticket.', flags: MessageFlags.Ephemeral });
      }

      const target = interaction.options.getMember('user');
      if (target.id === ticket.user_id) {
        return interaction.reply({ content: '❌ Cannot remove the ticket opener.', flags: MessageFlags.Ephemeral });
      }

      await interaction.channel.permissionOverwrites.edit(target, { ViewChannel: false });
      return interaction.reply({ content: `✅ Removed ${target} from the ticket.`, flags: MessageFlags.Ephemeral });
    }
  },
};
