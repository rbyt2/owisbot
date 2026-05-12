const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const RESPONSES = [
  // Positive
  { text: 'It is certain.',          color: 0x57f287 },
  { text: 'It is decidedly so.',     color: 0x57f287 },
  { text: 'Without a doubt.',        color: 0x57f287 },
  { text: 'Yes, definitely.',        color: 0x57f287 },
  { text: 'You may rely on it.',     color: 0x57f287 },
  { text: 'As I see it, yes.',       color: 0x57f287 },
  { text: 'Most likely.',            color: 0x57f287 },
  { text: 'Outlook good.',           color: 0x57f287 },
  { text: 'Signs point to yes.',     color: 0x57f287 },
  // Neutral
  { text: 'Reply hazy, try again.',  color: 0xfee75c },
  { text: 'Ask again later.',        color: 0xfee75c },
  { text: 'Better not tell you now.',color: 0xfee75c },
  { text: 'Cannot predict now.',     color: 0xfee75c },
  { text: 'Concentrate and ask again.', color: 0xfee75c },
  // Negative
  { text: "Don't count on it.",      color: 0xed4245 },
  { text: 'My reply is no.',         color: 0xed4245 },
  { text: 'My sources say no.',      color: 0xed4245 },
  { text: 'Outlook not so good.',    color: 0xed4245 },
  { text: 'Very doubtful.',          color: 0xed4245 },
];

module.exports = {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8-ball a question 🎱')
    .addStringOption(opt =>
      opt.setName('question').setDescription('Your yes/no question').setRequired(true),
    ),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const pick     = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];

    const embed = new EmbedBuilder()
      .setColor(pick.color)
      .setTitle('🎱 Magic 8-Ball')
      .addFields(
        { name: 'Question', value: question },
        { name: 'Answer',   value: `**${pick.text}**` },
      )
      .setFooter({ text: `Asked by ${interaction.user.displayName}` });

    await interaction.reply({ embeds: [embed] });
  },
};
