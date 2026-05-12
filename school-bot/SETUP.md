# 🎓 School Bot — Complete Setup Guide

A fully modular, multipurpose Discord bot combining fun, utility, and full Firewall-grade moderation.

---

## 📁 File Directory

```
school-bot/
│
├── index.js                                  # Entry point
├── package.json
├── .env                                      # Your secrets — never commit this
├── .env.example
├── .gitignore
├── SETUP.md
│
├── handlers/
│   ├── commandHandler.js                     # Auto-loads & registers all slash commands
│   └── eventHandler.js                       # Auto-loads all events (supports array exports)
│
├── events/
│   ├── ready.js                              # Bot login → init DB
│   ├── interactionCreate.js                  # Routes commands, buttons, modals, menus
│   ├── messageCreate.js                      # Feeds every message into AutoMod engine
│   ├── messageDelete.js                      # Logs deleted messages
│   ├── messageUpdate.js                      # Logs edited messages
│   ├── guildMemberAdd.js                     # Welcome embed + join log + raid check
│   ├── guildMemberRemove.js                  # Leave log
│   ├── guildMemberUpdate.js                  # Role/nickname/timeout change logs
│   ├── guildBanAdd.js                        # Ban log
│   ├── guildBanRemove.js                     # Unban log
│   ├── starboard.js                          # ⭐ reaction → #starboard
│   └── serverEvents.js                       # Channel/role create & delete logs
│
├── commands/
│   ├── moderation/
│   │   ├── moderation.js                     # /moderation ban|unban|kick|timeout|untimeout|warn|unwarn|softban
│   │   ├── warnings.js                       # /warnings list|clear
│   │   ├── purge.js                          # /purge
│   │   ├── logs.js                           # /logs enable|disable|setchannel|ignore|status
│   │   └── automod.js                        # /automod status|set|thresholds|muterole|whitelist
│   │
│   ├── fun/
│   │   ├── truthordare.js                    # /tod
│   │   ├── poll.js                           # /poll
│   │   └── 8ball.js                          # /8ball
│   │
│   ├── utility/
│   │   ├── setuptickets.js                   # /setuptickets
│   │   ├── tickets.js                        # /tickets list|info|close|add|remove
│   │   └── remind.js                         # /remind
│   │
│   └── context-menus/
│       └── quoteMessage.js                   # Right-click → Quote as Image
│
├── modules/
│   ├── moderation/
│   │   ├── serverLogger.js                   # Central log dispatcher
│   │   └── automodEngine.js                  # Anti-spam, anti-link, anti-caps, anti-raid, anti-mention
│   │
│   ├── quotebot/
│   │   └── generateQuote.js                  # Canvas image renderer for quote cards
│   │
│   └── tickets/
│       └── ticketManager.js                  # Open/close/claim/transcript logic
│
├── utils/
│   ├── db.js                                 # SQLite connection + all table definitions
│   └── logger.js                             # Coloured console output
│
└── data/
    ├── tod.json                              # 25 truths + 25 dares
    └── school-bot.db                         # Auto-generated SQLite DB (gitignored)
```

---

## ✅ Prerequisites

| Requirement | Version |
|---|---|
| Node.js | v18 or higher |
| npm | v8+ (bundled with Node) |
| A Discord application | discord.com/developers |

---

## 🖥️ Local Setup (Windows / Mac)

### 1 — Install dependencies
```bash
cd school-bot
npm install
```

> **Windows canvas fix:** If `@napi-rs/canvas` fails to build, install
> "Desktop development with C++" from the Visual Studio installer, then re-run `npm install`.

### 2 — Create your Discord bot
1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. **New Application** → name it → go to **Bot** tab
3. Enable **Server Members Intent** and **Message Content Intent**
4. Copy your **Token**
5. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Administrator` (or granular list below)
   - Open the URL and invite the bot to your server

**Minimum permissions (non-admin):**
Manage Channels, Manage Roles, Kick Members, Ban Members, Moderate Members,
Send Messages, Embed Links, Attach Files, Read Message History,
Add Reactions, Manage Messages, View Channels, Use Slash Commands

### 3 — Configure `.env`
```bash
cp .env.example .env
```
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_server_id_here
```

| Value | Where to find it |
|---|---|
| `DISCORD_TOKEN` | Developer Portal → Bot → Token |
| `CLIENT_ID` | Developer Portal → OAuth2 → Client ID |
| `GUILD_ID` | Right-click server icon → Copy Server ID (enable Developer Mode first) |

### 4 — Start the bot
```bash
npm start
```

---

## ☁️ Oracle Cloud Free Tier Hosting (24/7, £0/month)

Oracle's Always Free tier gives you a real Ubuntu VM running forever at zero cost.

---

### Step 1 — Create an Oracle Cloud account

1. Go to [cloud.oracle.com](https://cloud.oracle.com) → **Start for free**
2. Fill in your details — a credit card is required for identity verification but **you will not be charged** for Always Free resources
3. Pick your **Home Region** (closest to you — cannot be changed later)
4. Verify your email and wait for activation (usually a few minutes)

---

### Step 2 — Create a free VM instance

1. In the OCI Console, open the menu → **Compute** → **Instances** → **Create Instance**
2. Configure as follows:

   | Setting | Value |
   |---|---|
   | Name | `school-bot` |
   | Image | **Canonical Ubuntu 22.04** |
   | Shape | **VM.Standard.E2.1.Micro** ← this is the Always Free one |
   | SSH Keys | Click **Generate a key pair** → download both files |

3. Click **Create** — it'll be running within 2 minutes
4. Note down the **Public IP address** shown in the instance details

---

### Step 3 — Allow SSH through Oracle's firewall

1. In the instance details, click your **Subnet** link
2. Click **Default Security List** → **Add Ingress Rules**
3. Add this rule:

   | Field | Value |
   |---|---|
   | Source CIDR | `0.0.0.0/0` |
   | Protocol | TCP |
   | Destination Port | `22` |

---

### Step 4 — Connect to your VM

**Windows (PowerShell or Windows Terminal):**
```powershell
ssh -i C:\Users\YourName\Downloads\your-key.key ubuntu@YOUR_PUBLIC_IP
```

**Mac / Linux:**
```bash
chmod 400 ~/Downloads/your-key.key
ssh -i ~/Downloads/your-key.key ubuntu@YOUR_PUBLIC_IP
```

If it says "Permission denied (publickey)", check that you're using the correct `.key` file
and that the username is `ubuntu` (not `root` or `oracle`).

---

### Step 5 — Install Node.js on the VM

Paste these commands one by one after you're connected via SSH:

```bash
# Update the system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify the install
node -v    # should print v20.x.x
npm -v     # should print 10.x.x

# Install build tools needed for @napi-rs/canvas (the quote image generator)
sudo apt install -y build-essential libcairo2-dev libpango1.0-dev \
  libjpeg-dev libgif-dev librsvg2-dev
```

---

### Step 6 — Upload your bot to the VM

**Option A — Git (easiest for updates later):**

First push your code to a private GitHub repo (make sure `.env` is in `.gitignore`!), then:
```bash
# On the VM:
sudo apt install -y git
git clone https://github.com/YOUR_USERNAME/school-bot.git
cd school-bot
```

**Option B — SCP (direct copy from your computer):**
```bash
# Run this on your computer, not the VM:
scp -i C:\Users\YourName\Downloads\your-key.key -r ./school-bot ubuntu@YOUR_PUBLIC_IP:~/school-bot
```

---

### Step 7 — Install packages and set up `.env` on the VM

```bash
cd ~/school-bot
npm install

# Create the .env file
cp .env.example .env
nano .env
```

Inside nano, fill in your three values:
```
DISCORD_TOKEN=your_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_server_id_here
```
Save: `Ctrl+X` → `Y` → `Enter`

Test that the bot starts correctly:
```bash
node index.js
# You should see: [Ready] Logged in as YourBot#1234
# Press Ctrl+C to stop it
```

---

### Step 8 — Keep it running 24/7 with PM2

PM2 is a process manager that keeps the bot alive and restarts it on crash or reboot.

```bash
# Install PM2
sudo npm install -g pm2

# Start the bot
pm2 start index.js --name school-bot

# View the logs to confirm it started
pm2 logs school-bot

# Save the process list
pm2 save

# Configure PM2 to start automatically on reboot
pm2 startup
# This prints a command — copy it and run it (starts with: sudo env PATH=...)
```

**Everyday PM2 commands:**

| Command | What it does |
|---|---|
| `pm2 status` | See all running processes |
| `pm2 logs school-bot` | Live log tail |
| `pm2 logs school-bot --lines 200` | Last 200 log lines |
| `pm2 restart school-bot` | Restart the bot |
| `pm2 stop school-bot` | Stop without removing |
| `pm2 delete school-bot` | Remove from PM2 entirely |

---

### Step 9 — Updating the bot later

**If using Git:**
```bash
ssh -i your-key.key ubuntu@YOUR_PUBLIC_IP
cd ~/school-bot
git pull
npm install          # only if package.json changed
pm2 restart school-bot
```

**If using SCP:**
```bash
# On your computer:
scp -i your-key.key -r ./school-bot ubuntu@YOUR_PUBLIC_IP:~/school-bot
# Then on the VM:
cd ~/school-bot && pm2 restart school-bot
```

---

## 🎮 Full Command Reference

### 🔨 Moderation (`/moderation`)
| Subcommand | Permission | Description |
|---|---|---|
| `ban @user [reason] [delete_days]` | Ban Members | Bans and optionally purges messages |
| `unban <user_id> [reason]` | Ban Members | Unbans by Discord user ID |
| `kick @user [reason]` | Kick Members | Kicks from the server |
| `timeout @user <duration> [reason]` | Moderate Members | Mutes for `10m`, `2h`, `1d` etc. (max 28d) |
| `untimeout @user [reason]` | Moderate Members | Removes a timeout early |
| `warn @user <reason>` | Moderate Members | Issues a tracked warning + DMs the user |
| `unwarn <warning_id> [reason]` | Moderate Members | Removes warning by its ID |
| `softban @user [reason]` | Ban Members | Bans + unbans to purge last 7 days of messages |

### ⚠️ Warnings
| Command | Description |
|---|---|
| `/warnings list @user` | Shows all warnings with IDs, dates, and reason |
| `/warnings clear @user` | Deletes every warning for that user |

### 🧹 Purge
| Command | Description |
|---|---|
| `/purge <1-100>` | Bulk delete messages in current channel |
| `/purge <amount> user:@user` | Only delete that user's messages |
| `/purge <amount> bots_only:True` | Only delete bot messages |

### 📋 Logging (`/logs`)
| Subcommand | Description |
|---|---|
| `setchannel #channel` | Set a default channel for ALL log events |
| `setchannel #channel event:X` | Route a specific event to its own channel |
| `enable event:X` | Turn on a specific log event |
| `disable event:X` | Turn off a specific log event |
| `enable event:All Events` | Turn on every single event at once |
| `disable event:All Events` | Turn off all events at once |
| `ignore #channel` | Exclude a channel from message logs |
| `unignore #channel` | Remove from ignore list |
| `status` | Full overview of what's enabled and where |

**Loggable events:**
Member Ban, Unban, Kick, Timeout, Warn, Nick Change, Role Add/Remove,
Message Delete, Message Edit, Purge, Member Join, Member Leave,
Channel Create/Delete, Role Create/Delete, AutoMod Action

### 🤖 AutoMod (`/automod`)
| Subcommand | Description |
|---|---|
| `status` | View full config with thresholds |
| `set feature:Anti-Spam enabled:True/False` | Toggle any feature |
| `thresholds spam_messages:6 spam_window:4` | Tune detection sensitivity |
| `muterole @role` | Role to apply on mute (falls back to timeout if not set) |
| `whitelist @role` | Exempt a role (e.g. Staff) from all AutoMod checks |

**AutoMod features:**
- **Anti-Spam** — mutes members sending too many messages in a short window
- **Anti-Raid** — detects mass-join events and alerts the log channel
- **Anti-Link** — removes messages containing any URL or Discord invite
- **Anti-Caps** — removes messages over a configurable capital letter percentage
- **Anti-Mention Spam** — mutes members pinging too many users at once

### 🎫 Ticketing
| Command | Description |
|---|---|
| `/setuptickets` | Post the ticket panel (staff only) |
| `/tickets list [status]` | List open/closed/all tickets |
| `/tickets info` | Show details of ticket in current channel |
| `/tickets close` | Close + transcript current ticket |
| `/tickets add @user` | Give a user access to current ticket |
| `/tickets remove @user` | Remove a user from current ticket |

### 🎮 Fun & Utility
| Command | Description |
|---|---|
| `/tod [type]` | Truth or Dare — Truth / Dare / Random |
| `/poll <question> <options>` | Reaction poll with auto-results after timer |
| `/8ball <question>` | Magic 8-ball |
| `/remind <duration> <message>` | DM reminder (e.g. `2h`, `45m`, `1d`) |
| Right-click → **Quote as Image** | Renders any message as a styled image card |

---

## ⚙️ Quick Config Reference

| Setting | File | Variable |
|---|---|---|
| Welcome channel name | `events/guildMemberAdd.js` | `WELCOME_CHANNEL` |
| Starboard channel name | `events/starboard.js` | `BOARD_NAME` |
| Starboard star threshold | `events/starboard.js` | `STAR_THRESHOLD` |
| ToD skip cooldown | `commands/fun/truthordare.js` | `SKIP_COOLDOWN_SECONDS` |
| Ticket categories | `modules/tickets/ticketManager.js` | `CATEGORIES` |
| Staff role auto-detect | `modules/tickets/ticketManager.js` | `getStaffRole()` |
| Raid detection sensitivity | `modules/moderation/automodEngine.js` | `LIMIT` + `WINDOW` |

---

## 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| `canvas` build fails on VM | Run the `sudo apt install build-essential libcairo2-dev...` line from Step 5 |
| Commands not showing in Discord | Check `GUILD_ID` in `.env`; restart and wait ~10 seconds |
| Logs not posting anywhere | Run `/logs setchannel #your-log-channel` first |
| AutoMod not doing anything | Run `/automod status` — features default to off until config row exists |
| Bot can't create ticket channels | Bot needs **Manage Channels** and its role must be above the target role |
| Starboard not working | Channel must be named exactly `starboard`; bot needs Message Content intent |
| Bot goes offline when SSH closes | You're running `node index.js` directly — use `pm2 start` instead |
| PM2 not starting on reboot | Re-run `pm2 startup`, copy the full `sudo env PATH=...` command it outputs, and run it |
| `Missing Access` error | Bot's role must be higher than any role it's trying to manage in the hierarchy |
| Can't SSH into VM | Check the Security List has port 22 open; verify you're using the correct `.key` file |
