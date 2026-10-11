import { SlashCommandBuilder } from 'discord.js';
import { getUserInfractions } from '../../database/db.js';
import { DIVIDER, baseEmbed, theme } from '../../utils/theme.js';
import { timestamp } from '../../utils/utils.js';

const KEY_PERMISSIONS = {
  Administrator: 'Administrador',
  ManageGuild: 'Gestionar servidor',
  BanMembers: 'Banear',
  KickMembers: 'Expulsar',
  ModerateMembers: 'Timeout',
  ManageMessages: 'Mensajes',
  ManageRoles: 'Roles',
  ManageChannels: 'Canales'
};

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('Informacion detallada de un usuario, con su expediente de moderacion')
  .addUserOption((o) => o.setName('usuario').setDescription('Usuario a consultar (por defecto, tu)'))
  .setDMPermission(false);

export async function execute(interaction) {
  const user = interaction.options.getUser('usuario') ?? interaction.user;
  await interaction.deferReply();

  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const infractions = await getUserInfractions(interaction.guild.id, user.id).catch(() => []);
  const active = infractions.filter((i) => i.active);
  const counts = infractions.reduce((acc, r) => { acc[r.type] = (acc[r.type] ?? 0) + 1; return acc; }, {});

  const accountAgeDays = Math.floor((Date.now() - user.createdTimestamp) / 86_400_000);
  const riskFlags = [];
  if (accountAgeDays < 7) riskFlags.push('🆕 Cuenta creada hace menos de 7 dias');
  if ((counts.warn ?? 0) >= 3) riskFlags.push(`⚠️ ${counts.warn} avisos acumulados`);
  if (member?.isCommunicationDisabled()) riskFlags.push(`🔇 En timeout hasta ${timestamp(member.communicationDisabledUntil, 'R')}`);
  if (counts.spam) riskFlags.push(`🚫 ${counts.spam} deteccion(es) de spam`);

  const embed = baseEmbed({ color: member?.displayColor || theme.colors.brand })
    .setAuthor({ name: `${theme.icons.user}  ${user.tag}`, iconURL: user.displayAvatarURL({ size: 128 }) })
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription(
      `${DIVIDER}\n` +
      `**Mencion:** ${user}\n` +
      `**ID:** \`${user.id}\`\n` +
      `**Bot:** ${user.bot ? 'si' : 'no'}`
    )
    .addFields(
      {
        name: '🗓️ Cuenta creada',
        value: `${timestamp(user.createdTimestamp, 'D')}\n${timestamp(user.createdTimestamp, 'R')}`,
        inline: true
      },
      {
        name: '📥 Se unio',
        value: member?.joinedTimestamp
          ? `${timestamp(member.joinedTimestamp, 'D')}\n${timestamp(member.joinedTimestamp, 'R')}`
          : 'No esta en el servidor',
        inline: true
      },
      {
        name: '🎖️ Rol mas alto',
        value: member ? (member.roles.highest.id === interaction.guild.id ? '—' : `${member.roles.highest}`) : '—',
        inline: true
      }
    );

  if (member) {
    const roles = member.roles.cache
      .filter((r) => r.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => `${r}`);

    embed.addFields({
      name: `🏷️ Roles (${roles.length})`,
      value: roles.length ? truncateList(roles, 1000) : 'Ninguno'
    });

    const perms = Object.entries(KEY_PERMISSIONS)
      .filter(([flag]) => member.permissions.has(flag))
      .map(([, label]) => `\`${label}\``);
    if (perms.length) embed.addFields({ name: '🔑 Permisos clave', value: perms.join(' ') });
  }

  const record = Object.entries(counts)
    .map(([type, n]) => `${theme.typeMeta[type]?.icon ?? '•'} ${theme.typeMeta[type]?.label ?? type}: **${n}**`)
    .join(' · ');

  embed.addFields({
    name: `${theme.icons.history} Expediente de moderacion`,
    value: infractions.length
      ? `${record}\n**Total:** ${infractions.length} · **Activas:** ${active.length}\n` +
        `Usa \`/history usuario:${user.tag}\` para el detalle.`
      : '`Sin infracciones registradas`'
  });

  if (riskFlags.length) {
    embed.addFields({ name: '🚩 Señales de riesgo', value: riskFlags.map((f) => `> ${f}`).join('\n') });
  }

  const banner = (await user.fetch().catch(() => null))?.bannerURL?.({ size: 512 });
  if (banner) embed.setImage(banner);

  embed.setFooter({ text: `Consultado por ${interaction.user.tag}` });
  return interaction.editReply({ embeds: [embed] });
}

function truncateList(items, maxLength) {
  const out = [];
  let length = 0;
  for (const item of items) {
    if (length + item.length + 2 > maxLength - 15) {
      out.push(`… +${items.length - out.length} mas`);
      break;
    }
    out.push(item);
    length += item.length + 2;
  }
  return out.join(' ');
}
