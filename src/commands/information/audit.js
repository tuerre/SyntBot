import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getAuditLogs } from '../../database/db.js';
import { DIVIDER, baseEmbed, theme, truncate } from '../../utils/theme.js';
import { replyError, timestamp } from '../../utils/utils.js';

const ACTION_LABELS = {
  'moderation.ban': '⛔ Ban',
  'moderation.unban': '♻️ Unban',
  'moderation.kick': '👟 Expulsion',
  'moderation.timeout': '🔇 Timeout',
  'moderation.untimeout': '🔊 Fin de timeout',
  'moderation.warn': '⚠️ Aviso',
  'moderation.clearwarns': '🧹 Avisos limpiados',
  'moderation.spam': '🚫 Anti-spam',
  'moderation.raid': '🛡️ Anti-raid',
  'moderation.case_void': '♻️ Caso anulado',
  'config.update': '⚙️ Configuracion',
  'antiraid.triggered': '🛡️ Raid detectada',
  'antiraid.lockdown_end': '🔓 Fin del bloqueo',
  'member.join': '📥 Entrada',
  'member.leave': '📤 Salida',
  'channel.lockdown': '🔒 Canal bloqueado',
  'channel.unlockdown': '🔓 Canal desbloqueado',
  'channel.slowmode.update': '🐢 Modo lento'
};

export const data = new SlashCommandBuilder()
  .setName('audit')
  .setDescription('Consulta el registro de auditoria del bot en este servidor')
  .addIntegerOption((o) =>
    o.setName('cantidad').setDescription('Numero de entradas (1-20)').setMinValue(1).setMaxValue(20))
  .addStringOption((o) =>
    o.setName('accion').setDescription('Filtrar por tipo de accion')
      .addChoices(
        { name: 'Bans', value: 'moderation.ban' },
        { name: 'Expulsiones', value: 'moderation.kick' },
        { name: 'Timeouts', value: 'moderation.timeout' },
        { name: 'Avisos', value: 'moderation.warn' },
        { name: 'Anti-spam', value: 'moderation.spam' },
        { name: 'Anti-raid', value: 'antiraid.triggered' },
        { name: 'Cambios de configuracion', value: 'config.update' }
      ))
  .addUserOption((o) => o.setName('autor').setDescription('Filtrar por quien realizo la accion'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export async function execute(interaction) {
  const limit = interaction.options.getInteger('cantidad') ?? 10;
  const action = interaction.options.getString('accion');
  const actor = interaction.options.getUser('autor');

  await interaction.deferReply();

  let logs;
  try {
    logs = await getAuditLogs(interaction.guild.id, { limit, action, actorId: actor?.id ?? null });
  } catch (error) {
    return replyError(interaction, 'Error de base de datos', error.message);
  }

  if (!logs.length) {
    return replyError(interaction, 'Sin resultados', 'No hay entradas de auditoria con esos filtros.');
  }

  const embed = baseEmbed({ color: theme.colors.neutral })
    .setAuthor({
      name: `${theme.icons.audit}  Auditoria de ${interaction.guild.name}`,
      iconURL: interaction.guild.iconURL({ size: 128 }) ?? undefined
    })
    .setDescription(
      `${DIVIDER}\nMostrando **${logs.length}** entrada(s)` +
      (action ? ` · accion \`${action}\`` : '') +
      (actor ? ` · autor ${actor}` : '') +
      `\n${DIVIDER}`
    )
    .setFooter({ text: 'Los registros se guardan en Supabase (tabla audit_logs)' });

  for (const log of logs) {
    const label = ACTION_LABELS[log.action] ?? `• ${log.action}`;
    const lines = [`**Cuando:** ${timestamp(log.created_at, 'f')} (${timestamp(log.created_at, 'R')})`];

    if (log.actor_id) {
      lines.push(`**Autor:** ${log.actor_id === 'SYSTEM' ? 'SyntBot' : `<@${log.actor_id}>`}`);
    }
    if (log.target_id) lines.push(`**Objetivo:** <@${log.target_id}>`);

    const meta = log.metadata ?? {};
    const details = [];
    if (meta.case_number) details.push(`caso #${meta.case_number}`);
    if (meta.reason) details.push(`motivo: ${truncate(meta.reason, 80)}`);
    if (meta.setting) details.push(`ajuste: \`${meta.setting}\` → \`${truncate(String(meta.value), 40)}\``);
    if (meta.joins) details.push(`${meta.joins} entradas en ${meta.window_sec}s`);
    if (details.length) lines.push(`**Detalle:** ${details.join(' · ')}`);

    embed.addFields({ name: label, value: lines.join('\n') });
  }

  return interaction.editReply({ embeds: [embed] });
}
