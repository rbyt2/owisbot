const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

async function loadCommands(client) {
  const commandsData = [];

  // Recursively find all .js files under /commands
  function readDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        readDir(full);
      } else if (entry.name.endsWith('.js')) {
        const command = require(full);
        if (!command.data || !command.execute) {
          console.warn(`[CommandHandler] Skipping ${full} — missing data or execute`);
          continue;
        }
        client.commands.set(command.data.name, command);
        commandsData.push(command.data.toJSON());
        console.log(`[CommandHandler] Loaded: ${command.data.name}`);
      }
    }
  }

  readDir(path.join(__dirname, '..', 'commands'));

  // Also load context menus
  const ctxDir = path.join(__dirname, '..', 'commands', 'context-menus');
  if (fs.existsSync(ctxDir)) {
    for (const file of fs.readdirSync(ctxDir).filter(f => f.endsWith('.js'))) {
      const cmd = require(path.join(ctxDir, file));
      if (!cmd.data || !cmd.execute) continue;
      client.commands.set(cmd.data.name, cmd);
      commandsData.push(cmd.data.toJSON());
      console.log(`[CommandHandler] Loaded context menu: ${cmd.data.name}`);
    }
  }

  // Register with Discord
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
    : Routes.applicationCommands(process.env.CLIENT_ID);

  console.log('[CommandHandler] Registering slash commands...');
  await rest.put(route, { body: commandsData });
  console.log(`[CommandHandler] Registered ${commandsData.length} command(s).`);
}

module.exports = { loadCommands };
