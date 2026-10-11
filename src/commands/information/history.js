import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getUserInfractions } from '../../database/db.js';
import { DIVIDER, baseEmbed, theme, truncate } from '../../utils/theme.js';
import { formatDuration, replyError, timestamp } from '../../utils/utils.js';

const PER_PAGE = 5;

export const data = new SlashCommandBuilder()
  .setName('history')
  .setDescription('Muestra el historial de infracciones de un usuario')
  .addUserOption((o) => o.setName('usuario').setDescription('Usuario a consultar').setRequired(true))
  .addIntegerOption((o) => o.setName('pagina').setDescription('Pagina del historial').setMinValue(1))
  .addStringOption((o) =>
    o.setName('tipo').setDescription('Filtrar por tipo de infraccion')
      .addChoices(
        { name: 'Ban', value: 'ban' },
        { name: 'Expulsion', value: 'kick' },
        { name: 'Timeout', value: 'timeout' },
        { name: 'Aviso', value: 'warn' },
        { name: 'Anti-spam', value: 'spam' },
        { name: 'Anti-raid', value: 'raid' }
      ))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const user = interaction.options.getUser('usuario', true);
  const page = interaction.options.getInteger('pagina') ?? 1;
  const typeFilter = interaction.options.getString('tipo');

  await interaction.deferReply();

  let all;
  try {
    all = await getUserInfractions(interaction.guild.id, user.id);
  } catch (error) {
    return replyError(interaction, 'Error de base de datos', error.message);
  }

  const rows = typeFilter ? all.filter((r) => r.type === typeFilter) : all;

  if (!rows.length) {
    return interaction.editReply({
      embeds: [
        baseEmbed({ color: theme.colors.success })
          .setAuthor({ name: `${theme.icons.history}  Historial de ${user.tag}`, iconURL: user.displayAvatarURL() })
          .setDescription(
            `${DIVIDER}\n${theme.icons.success} **Expediente limpio.**\n` +
            (typeFilter ? `No hay infracciones del tipo \`${typeFilter}\`.` : 'Este usuario no tiene infracciones registradas.')
          )
      ]
    });
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, totalPages);
  const slice = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const counts = all.reduce((acc, r) => { acc[r.type] = (acc[r.type] ?? 0) + 1; return acc; }, {});
  const summary = Object.entries(counts)
    .map(([type, n]) => `${theme.typeMeta[type]?.icon ?? '•'} ${theme.typeMeta[type]?.label ?? type}: **${n}**`)
    .join(' · ');

  const embed = baseEmbed({ color: theme.colors.warning })
    .setAuthor({ name: `${theme.icons.history}  Historial de ${user.tag}`, iconURL: user.displayAvatarURL({ size: 128 }) })
    .setDescription(`${DIVIDER}\n**Resumen** · ${rows.length} registro(s)\n${summary}\n${DIVIDER}`)
    .setFooter({ text: `Pagina ${current}/${totalPages} · ID ${user.id}` });

  for (const row of slice) {
    const meta = theme.typeMeta[row.type] ?? { label: row.type, icon: '•' };
    const lines = [
      `**Motivo:** ${truncate(row.reason, 180)}`,
      `**Moderador:** ${row.moderator_id === 'SYSTEM' ? 'SyntBot (automatico)' : `<@${row.moderator_id}>`}`,
      `**Fecha:** ${timestamp(row.created_at, 'f')} · ${timestamp(row.created_at, 'R')}`
    ];
    if (row.duration_ms) lines.push(`**Duracion:** ${formatDuration(Number(row.duration_ms))}`);
    if (!row.active) lines.push('**Estado:** `anulada`');

    embed.addFields({
      name: `${meta.icon}  Caso #${row.case_number} — ${meta.label}`,
      value: lines.join('\n')
    });
  }

  return interaction.editReply({ embeds: [embed] });
}
