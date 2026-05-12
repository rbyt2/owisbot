const { Events, EmbedBuilder } = require('discord.js');
const { logEvent }    = require('../modules/moderation/serverLogger');
const { runRaidCheck } = require('../modules/moderation/automodEngine');

const WELCOME_CHANNEL = 'welcome';

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member, client) {
    // ── Raid check ──────────────────────────────────────────────────────────
    await runRaidCheck(member);

    // ── Join log ────────────────────────────────────────────────────────────
    const accountAge = Math.floor(member.user.createdTimestamp / 1000);
    await logEvent(member.guild, 'member_join', {
      fields: [
        { name: 'User',         value: `${member.user.tag} (${member.user.id})`, inline: true },
        { name: 'Account Age',  value: `<t:${accountAge}:R>`,                    inline: true },
        { name: 'Member Count', value: `${member.guild.memberCount}`,             inline: true },
      ],
    });

    // ── Welcome message ─────────────────────────────────────────────────────
    const channel = member.guild.channels.cache.find(c => c.name === WELCOME_CHANNEL)
                 ?? member.guild.systemChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`👋 Welcome to ${member.guild.name}!`)
      .setDescription(
        `Hey ${member}, glad you're here!\n\n` +
        `📋 Check out the rules, grab your roles, and enjoy your stay 🎉`,
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Member',  value: member.user.tag,                          inline: true },
        { name: 'Joined',  value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
        { name: 'Members', value: `${member.guild.memberCount}`,             inline: true },
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  },
};
