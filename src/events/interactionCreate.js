const { Events, MessageFlags } = require('discord.js');
const { handleTicketButton }  = require('../modules/tickets/ticketManager');
const { handleTodButton }     = require('../commands/fun/truthordare');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {

    // ── Slash commands & context menus ──────────────────────────────────────
    if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // Cooldown check
      const { cooldowns } = client;
      if (!cooldowns.has(command.data.name)) cooldowns.set(command.data.name, new Map());
      const now = Date.now();
      const timestamps = cooldowns.get(command.data.name);
      const cooldownAmount = (command.cooldown ?? 3) * 1000;

      if (timestamps.has(interaction.user.id)) {
        const expiry = timestamps.get(interaction.user.id) + cooldownAmount;
        if (now < expiry) {
          const remaining = ((expiry - now) / 1000).toFixed(1);
          return interaction.reply({
            content: `⏳ Please wait **${remaining}s** before using \`/${command.data.name}\` again.`,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
      timestamps.set(interaction.user.id, now);
      setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`[Command Error] ${command.data.name}:`, err);
        const msg = { content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg);
        } else {
          await interaction.reply(msg);
        }
      }
      return;
    }

    // ── Determine prefix ─────────────────────────────────────────────────────
    const customId = interaction.customId ?? '';
    const prefix   = customId.split(':')[0];

    // ── Buttons ──────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      if (prefix === 'ticket') return handleTicketButton(interaction, client);
      if (prefix === 'tod')    return handleTodButton(interaction, client);
      return;
    }

    // ── Select menus ─────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      if (prefix === 'ticket') return handleTicketButton(interaction, client);
      return;
    }

    // ── Modal submits ─────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (prefix === 'ticket') return handleTicketButton(interaction, client);
      return;
    }
  },
};
