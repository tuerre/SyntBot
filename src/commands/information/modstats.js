import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getGuildTotals, getModStats } from '../../database/db.js';
import { DIVIDER, baseEmbed, progressBar, theme } from '../../utils/theme.js';
import { replyError } from '../../utils/utils.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export const data = new SlashCommandBuilder()
  .setName('modstats')
  .setDescription('Estadisticas de moderacion del servidor y del equipo')
  .addIntegerOption((o) =>
    o.setName('dias').setDescription('Periodo a analizar (por defecto 30)')
      .addChoices(
        { name: 'Ultimas 24 horas', value: 1 },
        { name: 'Ultimos 7 dias', value: 7 },
        { name: 'Ultimos 30 dias', value: 30 },
        { name: 'Ultimos 90 dias', value: 90 },
        { name: 'Ultimo año', value: 365 }
      ))
  .addUserOption((o) => o.setName('moderador').setDescription('Ver solo las estadisticas de un moderador'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export async function execute(interaction) {
  const days = interaction.options.getInteger('dias') ?? 30;
  const moderator = interaction.options.getUser('moderador');

  await interaction.deferReply();

  let stats;
  let totals;
  try {
    [stats, totals] = await Promise.all([
      getModStats(interaction.guild.id, days),
      getGuildTotals(interaction.guild.id, days)
    ]);
  } catch (error) {
    return replyError(interaction, 'Error de base de datos', error.message);
  }

  /* ─── Vista de un solo moderador ─── */
  if (moderator) {
    const row = stats.find((s) => s.moderator_id === moderator.id);
    if (!row) {
      return replyError(
        interaction, 'Sin actividad',
        `${moderator} no registra acciones de moderacion en los ultimos **${days} dias**.`
      );
    }
    const share = totals.total ? Math.round((Number(row.total) / totals.total) * 100) : 0;
    const embed = baseEmbed({ color: theme.colors.info })
      .setAuthor({
        name: `${theme.icons.stats}  Estadisticas de ${moderator.tag}`,
        iconURL: moderator.displayAvatarURL({ size: 128 })
      })
      .setDescription(
        `${DIVIDER}\n**Periodo:** ultimos ${days} dias\n` +
        `**Acciones:** ${row.total}  ·  **Cuota del equipo:** ${share}%\n` +
        `${progressBar(Number(row.total), totals.total, 14)}`
      )
      .addFields(
        { name: '⛔ Bans', value: `**${row.bans}**`, inline: true },
        { name: '👟 Expulsiones', value: `**${row.kicks}**`, inline: true },
        { name: '🔇 Timeouts', value: `**${row.timeouts}**`, inline: true },
        { name: '⚠️ Avisos', value: `**${row.warns}**`, inline: true }
      )
      .setFooter({ text: `Servidor: ${interaction.guild.name}` });
    return interaction.editReply({ embeds: [embed] });
  }

  /* ─── Vista general del servidor ─── */
  const auto = (totals.spam ?? 0) + (totals.raid ?? 0);
  const embed = baseEmbed({ color: theme.colors.info })
    .setAuthor({
      name: `${theme.icons.stats}  Estadisticas de moderacion`,
      iconURL: interaction.guild.iconURL({ size: 128 }) ?? undefined
    })
    .setDescription(
      `${DIVIDER}\n` +
      `**Periodo:** ultimos **${days}** dias\n` +
      `**Acciones totales:** ${totals.total}\n` +
      `**Usuarios sancionados:** ${totals.uniqueUsers}\n` +
      `**Detecciones automaticas:** ${auto}\n${DIVIDER}`
    )
    .addFields(
      { name: '⛔ Bans', value: `**${totals.ban ?? 0}**`, inline: true },
      { name: '👟 Expulsiones', value: `**${totals.kick ?? 0}**`, inline: true },
      { name: '🔇 Timeouts', value: `**${totals.timeout ?? 0}**`, inline: true },
      { name: '⚠️ Avisos', value: `**${totals.warn ?? 0}**`, inline: true },
      { name: '🚫 Anti-spam', value: `**${totals.spam ?? 0}**`, inline: true },
      { name: '🛡️ Anti-raid', value: `**${totals.raid ?? 0}**`, inline: true }
    );

  if (stats.length) {
    const top = stats.slice(0, 10).map((row, index) => {
      const medal = MEDALS[index] ?? `\`${index + 1}.\``;
      const bar = progressBar(Number(row.total), Number(stats[0].total), 8);
      return `${medal} <@${row.moderator_id}> ${bar} **${row.total}**\n` +
             `└ ⛔${row.bans} 👟${row.kicks} 🔇${row.timeouts} ⚠️${row.warns}`;
    }).join('\n');
    embed.addFields({ name: '🏆 Equipo de moderacion', value: top });
  } else {
    embed.addFields({ name: '🏆 Equipo de moderacion', value: '`Sin actividad en este periodo`' });
  }

  embed.setFooter({ text: `${interaction.guild.name} · solicitado por ${interaction.user.tag}` });
  return interaction.editReply({ embeds: [embed] });
}
