import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { deactivateInfraction, getInfraction, logAudit } from '../../database/db.js';
import { DIVIDER, baseEmbed, successEmbed, theme } from '../../utils/theme.js';
import { formatDuration, replyError, sendLog, timestamp } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('case')
  .setDescription('Consulta o anula una infraccion por su numero de caso')
  .addSubcommand((s) =>
    s.setName('ver').setDescription('Muestra los detalles de un caso')
      .addIntegerOption((o) => o.setName('numero').setDescription('Numero de caso').setRequired(true).setMinValue(1)))
  .addSubcommand((s) =>
    s.setName('anular').setDescription('Marca un caso como anulado (no borra el registro)')
      .addIntegerOption((o) => o.setName('numero').setDescription('Numero de caso').setRequired(true).setMinValue(1))
      .addStringOption((o) => o.setName('motivo').setDescription('Por que se anula').setMaxLength(400)))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const number = interaction.options.getInteger('numero', true);

  await interaction.deferReply();

  const row = await getInfraction(interaction.guild.id, number);
  if (!row) return replyError(interaction, 'Caso no encontrado', `No existe el caso **#${number}** en este servidor.`);

  const meta = theme.typeMeta[row.type] ?? { label: row.type, icon: '•', color: theme.colors.neutral };

  if (sub === 'ver') {
    const embed = baseEmbed({ color: meta.color })
      .setAuthor({ name: `${meta.icon}  Caso #${row.case_number} — ${meta.label}` })
      .setDescription(
        `${DIVIDER}\n` +
        `${theme.icons.user} **Usuario:** <@${row.user_id}> \`${row.user_tag ?? row.user_id}\`\n` +
        `${theme.icons.shield} **Moderador:** ${row.moderator_id === 'SYSTEM' ? 'SyntBot (automatico)' : `<@${row.moderator_id}>`}\n` +
        `${theme.icons.clock} **Fecha:** ${timestamp(row.created_at, 'F')}`
      )
      .addFields(
        { name: '📝 Motivo', value: `\`\`\`${row.reason}\`\`\`` },
        { name: 'Estado', value: row.active ? '`activa`' : '`anulada`', inline: true },
        { name: 'Duracion', value: row.duration_ms ? formatDuration(Number(row.duration_ms)) : '—', inline: true }
      )
      .setFooter({ text: `ID usuario: ${row.user_id}` });

    return interaction.editReply({ embeds: [embed] });
  }

  if (!row.active) {
    return replyError(interaction, 'Ya estaba anulada', `El caso **#${number}** ya figura como anulado.`);
  }

  const reason = interaction.options.getString('motivo') ?? 'Sin motivo especificado';
  await deactivateInfraction(interaction.guild.id, number);
  await logAudit({
    guildId: interaction.guild.id,
    action: 'moderation.case_void',
    actor: interaction.user,
    target: { id: row.user_id, tag: row.user_tag },
    metadata: { case_number: number, original_type: row.type, void_reason: reason }
  });

  const embed = successEmbed(
    `Caso #${number} anulado`,
    `${meta.icon} **${meta.label}** de <@${row.user_id}> queda marcado como anulado.\n\n**Motivo:**\n> ${reason}`
  ).setFooter({ text: `Anulado por ${interaction.user.tag}` });

  await sendLog(interaction.guild, embed);
  return interaction.editReply({ embeds: [embed] });
}
