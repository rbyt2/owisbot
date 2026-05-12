const fs   = require('fs');
const path = require('path');

function register(client, event) {
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(`[EventHandler] Registered event: ${event.name}`);
}

async function loadEvents(client) {
  const eventsDir = path.join(__dirname, '..', 'events');
  for (const file of fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'))) {
    const exported = require(path.join(eventsDir, file));
    // Support both single-event exports and array exports
    if (Array.isArray(exported)) {
      exported.forEach(ev => register(client, ev));
    } else {
      register(client, exported);
    }
  }
}

module.exports = { loadEvents };
