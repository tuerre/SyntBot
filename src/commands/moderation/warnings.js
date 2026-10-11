import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getWarnings } from '../../database/db.js';
import { baseEmbed, DIVIDER, theme, truncate } from '../../utils/theme.js';
import { replyError, timestamp } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('warnings')
  .setDescription('Muestra los avisos de un usuario')
  .addUserOption((o) => o.setName('usuario').setDescription('Usuario a consultar').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const user = interaction.options.getUser('usuario', true);
  await interaction.deferReply();
  try {
    const warnings = await getWarnings(interaction.guild.id, user.id);
    const embed = baseEmbed({ color: warnings.length ? theme.colors.warning : theme.colors.success })
      .setAuthor({ name: `⚠️  Avisos de ${user.tag}`, iconURL: user.displayAvatarURL({ size: 128 }) })
      .setDescription(`${DIVIDER}\n**Total:** ${warnings.length} aviso(s)`)
      .setFooter({ text: `ID ${user.id}` });

    if (!warnings.length) {
      embed.addFields({ name: 'Estado', value: '✅ No tiene avisos registrados.' });
    } else {
      for (const warning of warnings) {
        embed.addFields({
          name: `Caso #${warning.case_number}`,
          value: `**Motivo:** ${truncate(warning.reason, 250)}\n` +
            `**Moderador:** <@${warning.moderator_id}>\n` +
            `**Fecha:** ${timestamp(warning.created_at, 'f')}`
        });
      }
    }
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    return replyError(interaction, 'Error de base de datos', error.message);
  }
}
