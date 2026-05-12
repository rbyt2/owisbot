const { Events } = require('discord.js');
const { logEvent } = require('../modules/moderation/serverLogger');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember, client) {
    const guild = newMember.guild;

    // ── Nickname change ──────────────────────────────────────────────────────
    if (oldMember.nickname !== newMember.nickname) {
      await logEvent(guild, 'member_nick', {
        fields: [
          { name: 'User',   value: `${newMember.user.tag} (${newMember.user.id})`, inline: true },
          { name: 'Before', value: oldMember.nickname ?? '*(none)*',                inline: true },
          { name: 'After',  value: newMember.nickname ?? '*(none)*',                inline: true },
        ],
      });
    }

    // ── Role added ───────────────────────────────────────────────────────────
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    for (const [, role] of addedRoles) {
      await logEvent(guild, 'member_role_add', {
        fields: [
          { name: 'User', value: `${newMember.user.tag} (${newMember.user.id})`, inline: true },
          { name: 'Role', value: `${role}`,                                       inline: true },
        ],
      });
    }

    // ── Role removed ─────────────────────────────────────────────────────────
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
    for (const [, role] of removedRoles) {
      await logEvent(guild, 'member_role_remove', {
        fields: [
          { name: 'User', value: `${newMember.user.tag} (${newMember.user.id})`, inline: true },
          { name: 'Role', value: `${role}`,                                       inline: true },
        ],
      });
    }

    // ── Timeout applied (communicationDisabledUntil changed to a future date) ─
    const wasTimedOut = oldMember.communicationDisabledUntilTimestamp;
    const isTimedOut  = newMember.communicationDisabledUntilTimestamp;

    if (!wasTimedOut && isTimedOut && isTimedOut > Date.now()) {
      await logEvent(guild, 'member_timeout', {
        fields: [
          { name: 'User',    value: `${newMember.user.tag} (${newMember.user.id})`, inline: true },
          { name: 'Expires', value: `<t:${Math.floor(isTimedOut / 1000)}:R>`,       inline: true },
        ],
      });
    }

    if (wasTimedOut && !isTimedOut) {
      await logEvent(guild, 'member_untimeout', {
        fields: [
          { name: 'User', value: `${newMember.user.tag} (${newMember.user.id})`, inline: true },
        ],
      });
    }
  },
};
