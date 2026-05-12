const { SlashCommandBuilder, MessageFlags } = require('discord.js');

// Parse "2h30m", "45m", "1d", "30s" etc. → milliseconds
function parseDuration(input) {
  const regex = /(\d+)\s*(d|h|m|s)/gi;
  let ms = 0, match;
  while ((match = regex.exec(input)) !== null) {
    const val  = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 'd') ms += val * 86400000;
    if (unit === 'h') ms += val * 3600000;
    if (unit === 'm') ms += val * 60000;
    if (unit === 's') ms += val * 1000;
  }
  return ms;
}

function humanise(ms) {
  const parts = [];
  const d = Math.floor(ms / 86400000); if (d) { parts.push(`${d}d`); ms %= 86400000; }
  const h = Math.floor(ms / 3600000);  if (h) { parts.push(`${h}h`); ms %= 3600000; }
  const m = Math.floor(ms / 60000);    if (m) { parts.push(`${m}m`); ms %= 60000; }
  const s = Math.floor(ms / 1000);     if (s)   parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a personal reminder — the bot will DM you')
    .addStringOption(opt =>
      opt.setName('when').setDescription('When to remind you, e.g. 2h30m or 45m').setRequired(true),
    )
    .addStringOption(opt =>
      opt.setName('message').setDescription('What to remind you about').setRequired(true),
    ),

  async execute(interaction) {
    const raw     = interaction.options.getString('when');
    const message = interaction.options.getString('message');
    const ms      = parseDuration(raw);

    const MAX = 7 * 24 * 60 * 60 * 1000; // 7 days
    const MIN = 10 * 1000;               // 10 seconds

    if (ms < MIN) {
      return interaction.reply({
        content: '❌ Reminder must be at least **10 seconds** away.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (ms > MAX) {
      return interaction.reply({
        content: '❌ Reminder cannot be more than **7 days** away.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const when = humanise(ms);
    await interaction.reply({
      content: `✅ Got it! I'll remind you in **${when}** about: *${message}*`,
      flags: MessageFlags.Ephemeral,
    });

    setTimeout(async () => {
      try {
        await interaction.user.send(
          `⏰ **Reminder!**\n\n> ${message}\n\n*(Set ${when} ago in ${interaction.guild?.name ?? 'DMs'})*`,
        );
      } catch {
        // DMs are closed — try replying in channel as a fallback
        try {
          await interaction.channel?.send(
            `⏰ ${interaction.user}, here's your reminder: **${message}**`,
          );
        } catch { /* channel deleted */ }
      }
    }, ms);
  },
};
