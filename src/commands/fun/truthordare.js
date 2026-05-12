const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { db } = require('../../utils/db');
const tod = require('../../data/tod.json');

const SKIP_COOLDOWN_SECONDS = 120; // 2 minutes between skips

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildEmbed(type, prompt, user) {
  const isTruth = type === 'truth';
  return new EmbedBuilder()
    .setColor(isTruth ? 0x5865f2 : 0xed4245)
    .setTitle(isTruth ? '🤔 Truth' : '🎯 Dare')
    .setDescription(`**${prompt}**`)
    .setFooter({
      text: `Picked for ${user.displayName} • Skip has a ${SKIP_COOLDOWN_SECONDS}s cooldown`,
      iconURL: user.displayAvatarURL(),
    })
    .setTimestamp();
}

function buildRow(userId, lastType) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tod:truth:${userId}`)
      .setLabel('Truth')
      .setEmoji('🤔')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`tod:dare:${userId}`)
      .setLabel('Dare')
      .setEmoji('🎯')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`tod:skip:${userId}:${lastType}`)
      .setLabel('Skip')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary),
  );
}

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('tod')
    .setDescription('Play Truth or Dare!')
    .addStringOption(opt =>
      opt
        .setName('type')
        .setDescription('Pick truth, dare, or let the bot decide')
        .setRequired(false)
        .addChoices(
          { name: '🤔 Truth', value: 'truth' },
          { name: '🎯 Dare', value: 'dare' },
          { name: '🎲 Random', value: 'random' },
        ),
    ),

  async execute(interaction) {
    const choice = interaction.options.getString('type') ?? 'random';
    const type = choice === 'random'
      ? (Math.random() < 0.5 ? 'truth' : 'dare')
      : choice;

    const prompt = type === 'truth'
      ? getRandom(tod.truths)
      : getRandom(tod.dares);

    const embed = buildEmbed(type, prompt, interaction.user);
    const row = buildRow(interaction.user.id, type);

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};

// ── Button handler (called from interactionCreate) ───────────────────────────
async function handleTodButton(interaction) {
  const [, action, userId, lastType] = interaction.customId.split(':');

  // Skip: only the original user can skip, and it's rate-limited
  if (action === 'skip') {
    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: '❌ Only the person who was picked can skip!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const row = db
      .prepare('SELECT last_skip FROM tod_skips WHERE user_id = ?')
      .get(userId);

    if (row && now - row.last_skip < SKIP_COOLDOWN_SECONDS) {
      const remaining = SKIP_COOLDOWN_SECONDS - (now - row.last_skip);
      return interaction.reply({
        content: `⏳ You can skip again in **${remaining}s**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    db.prepare(
      'INSERT INTO tod_skips (user_id, last_skip) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET last_skip = ?',
    ).run(userId, now, now);

    // Re-roll same type that was skipped
    const type = lastType ?? (Math.random() < 0.5 ? 'truth' : 'dare');
    const prompt = type === 'truth'
      ? getRandom(tod.truths)
      : getRandom(tod.dares);

    const embed = buildEmbed(type, prompt, interaction.user);
    const newRow = buildRow(userId, type);
    return interaction.update({ embeds: [embed], components: [newRow] });
  }

  // Truth / Dare buttons — anyone can press these to get their own prompt
  const type = action;
  const prompt = type === 'truth'
    ? getRandom(tod.truths)
    : getRandom(tod.dares);

  const embed = buildEmbed(type, prompt, interaction.user);
  const newRow = buildRow(interaction.user.id, type);

  // Reply ephemerally so it doesn't spam the channel, then let them share if they want
  return interaction.reply({
    embeds: [embed],
    components: [newRow],
  });
}

module.exports.handleTodButton = handleTodButton;
