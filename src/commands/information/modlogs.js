import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getAuditLogs } from '../../database/db.js';
import { baseEmbed, DIVIDER, theme, truncate } from '../../utils/theme.js';
import { replyError, timestamp } from '../../utils/utils.js';

const ACTIONS = [
  ['Ban', 'moderation.ban'], ['Unban', 'moderation.unban'], ['Kick', 'moderation.kick'],
  ['Timeout', 'moderation.timeout'], ['Fin de timeout', 'moderation.untimeout'],
  ['Aviso', 'moderation.warn'], ['Anti-spam', 'moderation.spam'], ['Anti-raid', 'moderation.raid']
];

export const data = new SlashCommandBuilder()
  .setName('modlogs')
  .setDescription('Muestra las acciones realizadas por un moderador')
  .addUserOption((o) => o.setName('moderador').setDescription('Moderador a consultar').setRequired(true))
  .addStringOption((o) =>
    o.setName('accion').setDescription('Filtrar por accion').addChoices(...ACTIONS.map(([name, value]) => ({ name, value }))))
  .addIntegerOption((o) => o.setName('cantidad').setDescription('Entradas (1-20)').setMinValue(1).setMaxValue(20))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export async function execute(interaction) {
  const moderator = interaction.options.getUser('moderador', true);
  const action = interaction.options.getString('accion');
  const limit = interaction.options.getInteger('cantidad') ?? 10;
  await interaction.deferReply();
  try {
    const logs = await getAuditLogs(interaction.guild.id, { limit, action, actorId: moderator.id });
    if (!logs.length) return replyError(interaction, 'Sin resultados', 'No hay acciones con esos filtros.');
    const embed = baseEmbed({ color: theme.colors.neutral })
      .setAuthor({ name: `🗂️  Logs de ${moderator.tag}`, iconURL: moderator.displayAvatarURL({ size: 128 }) })
      .setDescription(`${DIVIDER}\nMostrando **${logs.length}** entrada(s)${action ? ` · \`${action}\`` : ''}`)
      .setFooter({ text: `ID moderador: ${moderator.id}` });
    for (const log of logs) {
      const meta = log.metadata ?? {};
      embed.addFields({
        name: log.action,
        value: `**Fecha:** ${timestamp(log.created_at, 'f')}\n` +
          (log.target_id ? `**Objetivo:** <@${log.target_id}>\n` : '') +
          (meta.reason ? `**Motivo:** ${truncate(meta.reason, 150)}` : 'Sin detalles')
      });
    }
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    return replyError(interaction, 'Error de base de datos', error.message);
  }
}
