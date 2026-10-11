import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { clearWarnings, logAudit } from '../../database/db.js';
import { baseEmbed, theme } from '../../utils/theme.js';
import { canModerate, replyError, sendLog } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('clearwarns')
  .setDescription('Limpia los avisos activos de un usuario')
  .addUserOption((o) => o.setName('usuario').setDescription('Usuario al que se le limpiaran los avisos').setRequired(true))
  .addStringOption((o) => o.setName('motivo').setDescription('Motivo de la limpieza').setMaxLength(500))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const user = interaction.options.getUser('usuario', true);
  const reason = interaction.options.getString('motivo') ?? 'Sin motivo especificado';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const check = canModerate(interaction, member);

  if (!check.ok) return replyError(interaction, 'Accion no permitida', check.reason);
  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return replyError(interaction, 'Me falta un permiso', 'Necesito el permiso **Aislar miembros**.');
  }

  await interaction.deferReply();

  try {
    const cleared = await clearWarnings(interaction.guild.id, user.id);
    if (!cleared.length) {
      return replyError(interaction, 'Sin avisos activos', `${user} no tiene avisos activos para limpiar.`);
    }

    const embed = baseEmbed({ color: theme.colors.success })
      .setTitle('✅ Avisos limpiados')
      .setDescription(`Se limpiaron **${cleared.length}** aviso(s) activo(s) de ${user}.`)
      .addFields({ name: 'Motivo', value: reason })
      .setFooter({ text: `Limpiados por ${interaction.user.tag}` });

    await Promise.all([
      logAudit({
        guildId: interaction.guild.id,
        action: 'moderation.clearwarns',
        actor: interaction.user,
        target: user,
        metadata: {
          cleared_cases: cleared.map((warning) => warning.case_number),
          reason
        }
      }),
      sendLog(interaction.guild, embed)
    ]);

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    return replyError(interaction, 'Error al limpiar avisos', error.message);
  }
}
