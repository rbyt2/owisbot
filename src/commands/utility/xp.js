
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { db } = require('../../utils/db');
const {
  getStats,
  getRank,
  levelFromXp,
  totalXpForLevel,
  progressToNext,
  progressBar,
  getConfig,
} = require('../../modules/leveling/levelEngine');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('XP and levelling management')

    //rank 
    .addSubcommand(s => s
      .setName('rank')
      .setDescription('View yours or another member\'s XP rank card')
      .addUserOption(o => o
        .setName('user')
        .setDescription('User to look up (defaults to yourself)')
      )
    )

    //add 
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Add XP to a member (staff only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // checked below
      .addUserOption(o => o.setName('user').setDescription('Target member').setRequired(true))
      .addIntegerOption(o => o
        .setName('amount')
        .setDescription('Amount of XP to add')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100_000)
      )
    )

    // remove
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove XP from a member (staff only)')
      .addUserOption(o => o.setName('user').setDescription('Target member').setRequired(true))
      .addIntegerOption(o => o
        .setName('amount')
        .setDescription('Amount of XP to remove')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100_000)
      )
    )

    //reset 
    .addSubcommand(s => s
      .setName('reset')
      .setDescription('Reset a member\'s XP and level to 0 (staff only)')
      .addUserOption(o => o.setName('user').setDescription('Target member').setRequired(true))
    )

    //config
    .addSubcommand(s => s
      .setName('config')
      .setDescription('Configure the levelling system (staff only)')
      .addBooleanOption(o => o.setName('enabled').setDescription('Enable or disable XP gain'))
      .addIntegerOption(o => o
        .setName('xp_min')
        .setDescription('Minimum XP per message (default 15)')
        .setMinValue(1).setMaxValue(500)
      )
      .addIntegerOption(o => o
        .setName('xp_max')
        .setDescription('Maximum XP per message (default 25)')
        .setMinValue(1).setMaxValue(500)
      )
      .addIntegerOption(o => o
        .setName('cooldown')
        .setDescription('Seconds between XP grants per user (default 60)')
        .setMinValue(5).setMaxValue(600)
      )
      .addChannelOption(o => o
        .setName('announce_channel')
        .setDescription('Channel to post level-up messages in')
      )
      .addStringOption(o => o
        .setName('announce_mode')
        .setDescription('Where to announce level-ups')
        .addChoices(
          { name: '📢 Dedicated channel', value: 'channel'      },
          { name: '💬 Same channel',       value: 'same_channel' },
          { name: '📩 DM the user',         value: 'dm'           },
        )
      )
    )

    // setreward
    .addSubcommand(s => s
      .setName('setreward')
      .setDescription('Give a role when a member reaches a certain level (staff only)')
      .addIntegerOption(o => o
        .setName('level')
        .setDescription('Level at which the role is awarded')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(500)
      )
      .addRoleOption(o => o
        .setName('role')
        .setDescription('Role to award')
        .setRequired(true)
      )
    )

    //removereward
    .addSubcommand(s => s
      .setName('removereward')
      .setDescription('Remove a level reward (staff only)')
      .addIntegerOption(o => o
        .setName('level')
        .setDescription('Level whose reward should be removed')
        .setRequired(true)
      )
    )

    //rewards 
    .addSubcommand(s => s
      .setName('rewards')
      .setDescription('List all level reward roles')
    ),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // Staff-only guard for write operations
    const isStaff = interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild);
    const staffOnly = ['add', 'remove', 'reset', 'config', 'setreward', 'removereward'];
    if (staffOnly.includes(sub) && !isStaff) {
      return interaction.reply({ content: '❌ You need the **Manage Server** permission for this.', flags: MessageFlags.Ephemeral });
    }

    // RANK
    if (sub === 'rank') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      const stats  = getStats(guildId, target.id);

      if (!stats || stats.xp === 0) {
        return interaction.reply({
          content: `📊 **${target.displayName}** hasn't earned any XP yet.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const level    = levelFromXp(stats.xp);
      const rank     = getRank(guildId, target.id);
      const progress = progressToNext(stats.xp);
      const bar      = progressBar(progress);
      const thisFloor = totalXpForLevel(level);
      const nextFloor = totalXpForLevel(level + 1);
      const current   = stats.xp - thisFloor;
      const needed    = nextFloor - thisFloor;

      const embed = new EmbedBuilder()
        .setColor(member?.displayHexColor ?? 0x5865f2)
        .setAuthor({
          name:    member?.displayName ?? target.username,
          iconURL: target.displayAvatarURL(),
        })
        .setTitle(`Level ${level}`)
        .setDescription(`\`${bar}\`  ${Math.round(progress * 100)}%`)
        .addFields(
          { name: 'Total XP', value: `${stats.xp.toLocaleString()}`,       inline: true },
          { name: 'Progress', value: `${current} / ${needed} XP`,          inline: true },
          { name: 'Rank',     value: rank ? `#${rank}` : '—',              inline: true },
        )
        .setFooter({ text: `Next level: ${nextFloor.toLocaleString()} total XP` });

      return interaction.reply({ embeds: [embed] });
    }

    // ADD
    if (sub === 'add') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      db.prepare('INSERT OR IGNORE INTO levels (guild_id, user_id) VALUES (?,?)').run(guildId, target.id);
      db.prepare('UPDATE levels SET xp = xp + ?, level = ?, last_xp_at = last_xp_at WHERE guild_id = ? AND user_id = ?')
        .run(amount, 0, guildId, target.id);
      // Recalculate level
      const row = db.prepare('SELECT xp FROM levels WHERE guild_id = ? AND user_id = ?').get(guildId, target.id);
      db.prepare('UPDATE levels SET level = ? WHERE guild_id = ? AND user_id = ?')
        .run(levelFromXp(row.xp), guildId, target.id);

      // Log to xp_log for weekly/monthly
      db.prepare('INSERT INTO xp_log (guild_id, user_id, amount) VALUES (?,?,?)').run(guildId, target.id, amount);

      return interaction.reply({
        content: `✅ Added **${amount.toLocaleString()} XP** to ${target}. They now have **${row.xp.toLocaleString()} total XP**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // REMOVE
    if (sub === 'remove') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      db.prepare('INSERT OR IGNORE INTO levels (guild_id, user_id) VALUES (?,?)').run(guildId, target.id);
      db.prepare('UPDATE levels SET xp = MAX(0, xp - ?) WHERE guild_id = ? AND user_id = ?')
        .run(amount, guildId, target.id);
      const row = db.prepare('SELECT xp FROM levels WHERE guild_id = ? AND user_id = ?').get(guildId, target.id);
      db.prepare('UPDATE levels SET level = ? WHERE guild_id = ? AND user_id = ?')
        .run(levelFromXp(row.xp), guildId, target.id);

      return interaction.reply({
        content: `✅ Removed **${amount.toLocaleString()} XP** from ${target}. They now have **${row.xp.toLocaleString()} total XP**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // RESET
    if (sub === 'reset') {
      const target = interaction.options.getUser('user');
      db.prepare('UPDATE levels SET xp = 0, level = 0, last_xp_at = 0 WHERE guild_id = ? AND user_id = ?')
        .run(guildId, target.id);
      db.prepare('DELETE FROM xp_log WHERE guild_id = ? AND user_id = ?').run(guildId, target.id);
      return interaction.reply({
        content: `✅ Reset **${target.tag}**'s XP and level to 0.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // CONFIG
    if (sub === 'config') {
      const enabled  = interaction.options.getBoolean('enabled');
      const xpMin    = interaction.options.getInteger('xp_min');
      const xpMax    = interaction.options.getInteger('xp_max');
      const cooldown = interaction.options.getInteger('cooldown');
      const channel  = interaction.options.getChannel('announce_channel');
      const mode     = interaction.options.getString('announce_mode');

      // Ensure row exists
      db.prepare('INSERT OR IGNORE INTO level_config (guild_id) VALUES (?)').run(guildId);

      if (enabled  !== null) db.prepare('UPDATE level_config SET enabled          = ? WHERE guild_id = ?').run(enabled ? 1 : 0, guildId);
      if (xpMin)             db.prepare('UPDATE level_config SET xp_min           = ? WHERE guild_id = ?').run(xpMin, guildId);
      if (xpMax)             db.prepare('UPDATE level_config SET xp_max           = ? WHERE guild_id = ?').run(xpMax, guildId);
      if (cooldown)          db.prepare('UPDATE level_config SET xp_cooldown      = ? WHERE guild_id = ?').run(cooldown, guildId);
      if (channel)           db.prepare('UPDATE level_config SET announce_channel = ? WHERE guild_id = ?').run(channel.id, guildId);
      if (mode)              db.prepare('UPDATE level_config SET announce_mode    = ? WHERE guild_id = ?').run(mode, guildId);

      const cfg = getConfig(guildId);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('⚙️ Levelling Config')
        .addFields(
          { name: 'Enabled',          value: cfg.enabled ? '🟢 Yes' : '🔴 No',                                       inline: true },
          { name: 'XP per message',   value: `${cfg.xp_min} – ${cfg.xp_max}`,                                        inline: true },
          { name: 'Cooldown',         value: `${cfg.xp_cooldown}s`,                                                   inline: true },
          { name: 'Announce channel', value: cfg.announce_channel ? `<#${cfg.announce_channel}>` : '*(same channel)*', inline: true },
          { name: 'Announce mode',    value: cfg.announce_mode,                                                        inline: true },
        );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // SETREWARD
    if (sub === 'setreward') {
      const level = interaction.options.getInteger('level');
      const role  = interaction.options.getRole('role');
      db.prepare(
        'INSERT INTO level_rewards (guild_id, level, role_id) VALUES (?,?,?) ON CONFLICT(guild_id, level) DO UPDATE SET role_id = excluded.role_id',
      ).run(guildId, level, role.id);
      return interaction.reply({
        content: `✅ Members who reach **Level ${level}** will now receive ${role}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // REMOVEREWARD
    if (sub === 'removereward') {
      const level = interaction.options.getInteger('level');
      const { changes } = db.prepare('DELETE FROM level_rewards WHERE guild_id = ? AND level = ?').run(guildId, level);
      return interaction.reply({
        content: changes
          ? `✅ Removed reward for Level ${level}.`
          : `❌ No reward found for Level ${level}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    //REWARDS
    if (sub === 'rewards') {
      const rewards = db.prepare('SELECT * FROM level_rewards WHERE guild_id = ? ORDER BY level ASC').all(guildId);
      if (!rewards.length) {
        return interaction.reply({
          content: '📭 No level rewards set yet. Use `/xp setreward` to add one.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle('🏆 Level Rewards')
        .setDescription(rewards.map(r => `**Level ${r.level}** → <@&${r.role_id}>`).join('\n'));

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
