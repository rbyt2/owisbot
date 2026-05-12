const { Events } = require('discord.js');
const { runAutoMod } = require('../modules/moderation/automodEngine');

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    if (message.author?.bot) return;
    if (!message.guild) return;
    await runAutoMod(message);
  },
};
