const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data', 'school-bot.db'));

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id  TEXT NOT NULL UNIQUE,
      user_id     TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT 'General',
      claimed_by  TEXT,
      status      TEXT NOT NULL DEFAULT 'open',
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS tod_skips (
      user_id    TEXT PRIMARY KEY,
      last_skip  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS warnings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id    TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      mod_id      TEXT NOT NULL,
      reason      TEXT NOT NULL DEFAULT 'No reason provided',
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS mutes (
      guild_id    TEXT NOT NULL,
      user_id     TEXT PRIMARY KEY,
      mod_id      TEXT NOT NULL,
      reason      TEXT NOT NULL DEFAULT 'No reason provided',
      expires_at  INTEGER,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS automod_config (
      guild_id          TEXT PRIMARY KEY,
      anti_spam         INTEGER NOT NULL DEFAULT 1,
      anti_raid         INTEGER NOT NULL DEFAULT 1,
      anti_link         INTEGER NOT NULL DEFAULT 0,
      anti_caps         INTEGER NOT NULL DEFAULT 0,
      anti_mention_spam INTEGER NOT NULL DEFAULT 1,
      log_channel_id    TEXT,
      mute_role_id      TEXT,
      whitelist_roles   TEXT,
      spam_threshold    INTEGER NOT NULL DEFAULT 5,
      spam_window_ms    INTEGER NOT NULL DEFAULT 5000,
      caps_threshold    INTEGER NOT NULL DEFAULT 70,
      mention_limit     INTEGER NOT NULL DEFAULT 5
    );

    CREATE TABLE IF NOT EXISTS mod_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id    TEXT NOT NULL,
      action      TEXT NOT NULL,
      target_id   TEXT NOT NULL,
      mod_id      TEXT NOT NULL,
      reason      TEXT,
      duration    TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS log_config (
      guild_id   TEXT NOT NULL,
      event      TEXT NOT NULL,
      enabled    INTEGER NOT NULL DEFAULT 1,
      channel_id TEXT,
      PRIMARY KEY (guild_id, event)
    );

    CREATE TABLE IF NOT EXISTS log_ignored_channels (
      guild_id   TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      PRIMARY KEY (guild_id, channel_id)
    );
  `);
  console.log('[DB] Tables initialised.');
}

module.exports = { db, initDB };
