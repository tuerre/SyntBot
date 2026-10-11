import { Events } from 'discord.js';
import { getSettings, logAudit } from '../database/db.js';
import { DIVIDER, baseEmbed, theme } from '../utils/theme.js';
import { renderTemplate, timestamp } from '../utils/utils.js';
import { handleJoin } from '../services/antiraid.js';

export const name = Events.GuildMemberAdd;

export async function execute(member) {
  if (member.user.bot && !member.guild.available) return;

  const settings = await getSettings(member.guild.id);

  // 1) El anti-raid decide primero: si expulsa o banea, no hay bienvenida.
  const blocked = await handleJoin(member, settings);
  if (blocked) return;

  await logAudit({
    guildId: member.guild.id,
    action: 'member.join',
    target: member.user,
    metadata: {
      account_created: member.user.createdAt.toISOString(),
      member_count: member.guild.memberCount
    }
  });

  // 2) Autorol
  if (settings.autorole_id) {
    const role = member.guild.roles.cache.get(settings.autorole_id);
    if (role && member.guild.members.me.roles.highest.comparePositionTo(role) > 0) {
      await member.roles.add(role, 'Autorol de bienvenida').catch((error) =>
        console.error('[guildMemberAdd] autorol:', error.message)
      );
    }
  }

  // 3) Mensaje de bienvenida en el canal
  if (settings.welcome_enabled && settings.welcome_channel_id) {
    const channel = await member.guild.channels
      .fetch(settings.welcome_channel_id)
      .catch(() => null);

    if (channel?.isTextBased()) {
      const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
      const embed = baseEmbed({ color: theme.colors.success })
        .setAuthor({
          name: `${theme.icons.welcome}  ¡Bienvenido/a a ${member.guild.name}!`,
          iconURL: member.guild.iconURL({ size: 128 }) ?? undefined
        })
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setDescription(
          `${DIVIDER}\n${renderTemplate(settings.welcome_message, member)}\n${DIVIDER}`
        )
        .addFields(
          { name: '👤 Miembro', value: `${member.user.tag}`, inline: true },
          { name: '🔢 Numero', value: `#${member.guild.memberCount}`, inline: true },
          { name: '🗓️ Cuenta creada', value: `${timestamp(member.user.createdTimestamp, 'R')}`, inline: true }
        )
        .setFooter({ text: `ID: ${member.id}${accountAgeDays < 7 ? ' · cuenta nueva' : ''}` });

      if (settings.welcome_image_url) embed.setImage(settings.welcome_image_url);

      await channel.send({ content: `${member}`, embeds: [embed] }).catch((error) =>
        console.error('[guildMemberAdd] bienvenida:', error.message)
      );
    }
  }

  // 4) Mensaje privado de bienvenida
  if (settings.welcome_dm_enabled) {
    const text = settings.welcome_dm_message || settings.welcome_message;
    const dm = baseEmbed({ color: theme.colors.brand })
      .setTitle(`${theme.icons.welcome}  Bienvenido/a a ${member.guild.name}`)
      .setDescription(renderTemplate(text, member))
      .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() ?? undefined });

    await member.send({ embeds: [dm] }).catch(() => null);
  }
}
