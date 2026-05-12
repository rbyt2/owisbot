const { initDB } = require('../utils/db');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    initDB();
    console.log(`[Ready] Logged in as ${client.user.tag}`);
  },
};
