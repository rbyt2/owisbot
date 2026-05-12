const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');

const NUMBER_EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

module.exports = {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a reaction poll')
    .addStringOption(opt =>
      opt.setName('question').setDescription('The poll question').setRequired(true),
    )
    .addStringOption(opt =>
      opt.setName('options').setDescription('Options separated by | e.g. Yes | No | Maybe').setRequired(true),
    )
    .addIntegerOption(opt =>
      opt.setName('duration').setDescription('Poll duration in minutes (default: 5)').setMinValue(1).setMaxValue(60),
    ),

  async execute(interaction) {
    const question  = interaction.options.getString('question');
    const rawOpts   = interaction.options.getString('options').split('|').map(s => s.trim()).filter(Boolean);
    const duration  = interaction.options.getInteger('duration') ?? 5;

    if (rawOpts.length < 2 || rawOpts.length > 10) {
      return interaction.reply({
        content: '❌ Please provide between **2 and 10** options separated by `|`.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const lines = rawOpts.map((opt, i) => `${NUMBER_EMOJIS[i]}  ${opt}`);

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(`📊 ${question}`)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `Poll by ${interaction.user.displayName} • Ends in ${duration} min` })
      .setTimestamp(Date.now() + duration * 60 * 1000);

    await interaction.reply({ embeds: [embed] });
    const msg = await interaction.fetchReply();

    // Add reactions
    for (let i = 0; i < rawOpts.length; i++) {
      await msg.react(NUMBER_EMOJIS[i]);
    }

    // Schedule results
    setTimeout(async () => {
      try {
        const fetched = await msg.fetch();
        const results = rawOpts.map((opt, i) => {
          const reaction = fetched.reactions.cache.get(NUMBER_EMOJIS[i]);
          const count    = (reaction?.count ?? 1) - 1; // subtract bot's own reaction
          return { opt, count };
        });

        const total   = results.reduce((s, r) => s + r.count, 0);
        const winner  = results.reduce((a, b) => (b.count > a.count ? b : a));
        const bar     = (count) => {
          const pct  = total ? Math.round((count / total) * 10) : 0;
          return '█'.repeat(pct) + '░'.repeat(10 - pct);
        };

        const resultLines = results.map((r, i) =>
          `${NUMBER_EMOJIS[i]} **${r.opt}**\n${bar(r.count)} ${r.count} vote${r.count !== 1 ? 's' : ''}`,
        );

        const resultEmbed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(`📊 Poll Results — ${question}`)
          .setDescription(resultLines.join('\n\n'))
          .addFields({ name: '🏆 Winner', value: `**${winner.opt}** with ${winner.count} vote${winner.count !== 1 ? 's' : ''}` })
          .setFooter({ text: `${total} total vote${total !== 1 ? 's' : ''}` })
          .setTimestamp();

        await msg.reply({ embeds: [resultEmbed] });
      } catch (e) {
        console.error('[Poll] Could not post results:', e);
      }
    }, duration * 60 * 1000);
  },
};
