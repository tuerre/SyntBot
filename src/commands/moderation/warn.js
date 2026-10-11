import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getUserInfractions } from '../../database/db.js';
import { recordSanction } from '../../services/moderation.js';
import { canModerate, replyError } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Da un aviso a un usuario y lo guarda en su historial')
  .addUserOption((o) => o.setName('usuario').setDescription('Usuario a avisar').setRequired(true))
  .addStringOption((o) =>
    o.setName('motivo').setDescription('Motivo del aviso').setRequired(true).setMaxLength(500))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const user = interaction.options.getUser('usuario', true);
  const reason = interaction.options.getString('motivo', true);

  if (user.bot) return replyError(interaction, 'Objetivo invalido', 'No se pueden avisar bots.');

  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const check = canModerate(interaction, member);
  if (!check.ok) return replyError(interaction, 'Accion no permitida', check.reason);

  await interaction.deferReply();

  const previous = await getUserInfractions(interaction.guild.id, user.id);
  const warnCount = previous.filter((i) => i.type === 'warn').length + 1;

  const { embed } = await recordSanction({
    guild: interaction.guild, user, member,
    moderator: interaction.user, type: 'warn', reason,
    extra: [
      { name: '⚠️ Avisos acumulados', value: `**${warnCount}**`, inline: true },
      { name: '📜 Infracciones totales', value: `**${previous.length + 1}**`, inline: true }
    ]
  });

  if (warnCount >= 3) {
    embed.addFields({
      name: '🔔 Recomendacion',
      value: `Este usuario ya acumula **${warnCount} avisos**. Considera un \`/timeout\` o \`/ban\`.`
    });
  }

  return interaction.editReply({ embeds: [embed] });
}
