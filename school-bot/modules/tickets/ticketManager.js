const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { db } = require('../../utils/db');

// ── Config ────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'help',        label: '❓ Help',          description: 'Get help from staff'            },
  { value: 'report',      label: '🚨 Report a User',  description: 'Report someone to the mods'     },
  { value: 'appeal',      label: '⚖️ Appeal',         description: 'Appeal a moderation action'     },
  { value: 'general',     label: '💬 General',        description: 'Anything else'                  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find the configured staff role; falls back to any role named 'Staff' or 'Moderator'. */
function getStaffRole(guild) {
  return guild.roles.cache.find(r =>
    ['staff', 'moderator', 'mod', 'admin'].includes(r.name.toLowerCase()),
  ) ?? null;
}

/** Build the in-ticket control panel embed + buttons. */
function ticketControls(ticket, claimer) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎫 Ticket Controls')
    .addFields(
      { name: 'Category', value: ticket.category, inline: true },
      { name: 'Opened by', value: `<@${ticket.user_id}>`, inline: true },
      { name: 'Claimed by', value: claimer ? `<@${claimer}>` : 'Unclaimed', inline: true },
    )
    .setFooter({ text: `Ticket #${ticket.id}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:claim:${ticket.id}`)
      .setLabel('Claim')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket:close:${ticket.id}`)
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
  );

  return { embed, row };
}

// ── Open a ticket ─────────────────────────────────────────────────────────────
async function openTicket(interaction, category, description) {
  const guild = interaction.guild;
  const user = interaction.user;

  // Prevent duplicate open tickets per user
  const existing = db.prepare(
    `SELECT channel_id FROM tickets WHERE user_id = ? AND status = 'open'`,
  ).get(user.id);

  if (existing) {
    return interaction.reply({
      content: `❌ You already have an open ticket: <#${existing.channel_id}>`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const staffRole = getStaffRole(guild);

  // ── Create a private channel ──────────────────────────────────────────────
  const channel = await guild.channels.create({
    name: `ticket-${user.username}`,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: guild.id,   deny:  [PermissionFlagsBits.ViewChannel] },
      { id: user.id,    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ...(staffRole ? [{
        id:    staffRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages],
      }] : []),
    ],
  });

  // ── Persist to DB ─────────────────────────────────────────────────────────
  const info = db.prepare(
    `INSERT INTO tickets (channel_id, user_id, category) VALUES (?, ?, ?)`,
  ).run(channel.id, user.id, category);

  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(info.lastInsertRowid);

  // ── Welcome embed ─────────────────────────────────────────────────────────
  const welcome = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('✅ Ticket Opened')
    .setDescription(
      `Welcome, ${user}! Staff will be with you shortly.\n\n` +
      (description ? `**Your message:**\n> ${description}` : ''),
    )
    .addFields({ name: 'Category', value: category, inline: true })
    .setTimestamp();

  const { embed: controlEmbed, row: controlRow } = ticketControls(ticket, null);

  await channel.send({ content: `${user}${staffRole ? ` | ${staffRole}` : ''}` });
  await channel.send({ embeds: [welcome] });
  await channel.send({ embeds: [controlEmbed], components: [controlRow] });

  return interaction.reply({
    content: `✅ Ticket opened! Head over to ${channel}.`,
    flags: MessageFlags.Ephemeral,
  });
}

// ── Close a ticket ────────────────────────────────────────────────────────────
async function closeTicket(interaction, ticketId) {
  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticketId);
  if (!ticket || ticket.status === 'closed') {
    return interaction.reply({ content: '❌ Ticket not found or already closed.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply();

  // Generate transcript
  let transcriptMsg = '';
  try {
    const { createTranscript } = require('discord-html-transcripts');
    const channel = interaction.channel;
    const transcript = await createTranscript(channel, {
      filename: `ticket-${ticketId}.html`,
      saveImages: false,
      poweredBy: false,
    });

    // Try to find a log channel
    const logChannel = interaction.guild.channels.cache.find(c =>
      ['ticket-logs', 'mod-logs', 'logs'].includes(c.name),
    );

    if (logChannel) {
      await logChannel.send({
        content: `📄 Transcript for ticket #${ticketId} (opened by <@${ticket.user_id}>)`,
        files: [transcript],
      });
    }

    // DM the transcript to the user
    try {
      const opener = await interaction.client.users.fetch(ticket.user_id);
      await opener.send({
        content: `📄 Your ticket #${ticketId} has been closed. Here is your transcript:`,
        files: [transcript],
      });
    } catch { /* DMs closed */ }

    transcriptMsg = 'A transcript has been saved.';
  } catch (e) {
    console.error('[Tickets] Transcript error:', e);
    transcriptMsg = '(Transcript generation failed.)';
  }

  db.prepare(`UPDATE tickets SET status = 'closed' WHERE id = ?`).run(ticketId);

  await interaction.editReply({ content: `🔒 Closing ticket… ${transcriptMsg}` });

  setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}

// ── Claim a ticket ────────────────────────────────────────────────────────────
async function claimTicket(interaction, ticketId) {
  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticketId);
  if (!ticket) return interaction.reply({ content: '❌ Ticket not found.', flags: MessageFlags.Ephemeral });

  if (ticket.claimed_by) {
    return interaction.reply({
      content: `❌ This ticket is already claimed by <@${ticket.claimed_by}>.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  db.prepare(`UPDATE tickets SET claimed_by = ? WHERE id = ?`).run(interaction.user.id, ticketId);
  const updated = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticketId);

  const { embed, row } = ticketControls(updated, interaction.user.id);
  await interaction.update({ embeds: [embed], components: [row] });
  await interaction.channel.send(`✅ ${interaction.user} has claimed this ticket.`);
}

// ── Main button/modal/select router ──────────────────────────────────────────
async function handleTicketButton(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[1];

  // Open panel button → show category select
  if (action === 'open') {
    const select = new StringSelectMenuBuilder()
      .setCustomId('ticket:selectcategory')
      .setPlaceholder('Choose a category...')
      .addOptions(
        CATEGORIES.map(c =>
          new StringSelectMenuOptionBuilder()
            .setLabel(c.label)
            .setValue(c.value)
            .setDescription(c.description),
        ),
      );

    const row = new ActionRowBuilder().addComponents(select);
    return interaction.reply({ content: '📂 What do you need help with?', components: [row], flags: MessageFlags.Ephemeral });
  }

  // Category selected → show description modal
  if (action === 'selectcategory') {
    const category = interaction.values[0];
    const categoryLabel = CATEGORIES.find(c => c.value === category)?.label ?? category;

    const modal = new ModalBuilder()
      .setCustomId(`ticket:submit:${category}`)
      .setTitle('Open a Ticket');

    const descInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Briefly describe your issue')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Tell us what you need help with...')
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(descInput));
    return interaction.showModal(modal);
  }

  // Modal submitted → open the ticket
  if (action === 'submit') {
    const category = parts[2];
    const categoryLabel = CATEGORIES.find(c => c.value === category)?.label ?? category;
    const description = interaction.fields.getTextInputValue('description') ?? '';
    return openTicket(interaction, categoryLabel, description);
  }

  // Claim button
  if (action === 'claim') {
    return claimTicket(interaction, parseInt(parts[2]));
  }

  // Close button
  if (action === 'close') {
    return closeTicket(interaction, parseInt(parts[2]));
  }
}

module.exports = { handleTicketButton, openTicket };
