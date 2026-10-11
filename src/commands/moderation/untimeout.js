import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { recordSanction } from '../../services/moderation.js';
import { canModerate, replyError } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('untimeout')
  .setDescription('Retira el timeout de un usuario antes de que expire')
  .addUserOption((o) => o.setName('usuario').setDescription('Usuario a liberar').setRequired(true))
  .addStringOption((o) => o.setName('motivo').setDescription('Motivo de la retirada').setMaxLength(500))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const user = interaction.options.getUser('usuario', true);
  const reason = interaction.options.getString('motivo') ?? 'Timeout retirado manualmente';

  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return replyError(interaction, 'Me falta un permiso', 'Necesito el permiso **Aislar miembros**.');
  }

  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const check = canModerate(interaction, member);
  if (!check.ok) return replyError(interaction, 'Accion no permitida', check.reason);

  if (!member.isCommunicationDisabled()) {
    return replyError(interaction, 'Sin timeout activo', `${user} no tiene ningun timeout en curso.`);
  }

  await interaction.deferReply();

  try {
    await member.timeout(null, `${reason} · por ${interaction.user.tag}`);
  } catch (error) {
    return replyError(interaction, 'No se pudo retirar el timeout', `Discord respondio: \`${error.message}\``);
  }

  const { embed } = await recordSanction({
    guild: interaction.guild, user, member,
    moderator: interaction.user, type: 'untimeout', reason
  });

  return interaction.editReply({ embeds: [embed] });
}
