import { Events } from 'discord.js';
import { getSettings, logAudit } from '../database/db.js';
import { baseEmbed, theme } from '../utils/theme.js';
import { renderTemplate, timestamp } from '../utils/utils.js';

export const name = Events.GuildMemberRemove;

export async function execute(member) {
  try {
    const settings = await getSettings(member.guild.id);

    await logAudit({
      guildId: member.guild.id,
      action: 'member.leave',
      target: member.user,
      metadata: { member_count: member.guild.memberCount }
    });

    if (!settings.farewell_enabled || !settings.farewell_channel_id) return;

    const channel = await member.guild.channels.fetch(settings.farewell_channel_id).catch(() => null);
    if (!channel?.isTextBased()) return;

    const embed = baseEmbed({ color: theme.colors.neutral })
      .setAuthor({
        name: `📤  ${member.user.tag} salio del servidor`,
        iconURL: member.user.displayAvatarURL({ size: 128 })
      })
      .setDescription(renderTemplate(settings.farewell_message, member))
      .addFields(
        { name: '🔢 Miembros restantes', value: `${member.guild.memberCount}`, inline: true },
        {
          name: '📥 Se habia unido',
          value: member.joinedTimestamp ? timestamp(member.joinedTimestamp, 'R') : 'desconocido',
          inline: true
        }
      )
      .setFooter({ text: `ID: ${member.id}` });

    await channel.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.error('[guildMemberRemove]', error.message);
  }
}
