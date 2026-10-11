import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { recordSanction } from '../../services/moderation.js';
import { canModerate, replyError } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Banea a un usuario del servidor y registra la infraccion')
  .addUserOption((o) => o.setName('usuario').setDescription('Usuario a banear').setRequired(true))
  .addStringOption((o) => o.setName('motivo').setDescription('Motivo del ban').setMaxLength(500))
  .addIntegerOption((o) =>
    o.setName('borrar_dias')
      .setDescription('Borrar los mensajes recientes del usuario (0-7 dias)')
      .setMinValue(0).setMaxValue(7))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const user = interaction.options.getUser('usuario', true);
  const reason = interaction.options.getString('motivo') ?? 'Sin motivo especificado';
  const deleteDays = interaction.options.getInteger('borrar_dias') ?? 0;

  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
    return replyError(interaction, 'Me falta un permiso', 'Necesito el permiso **Banear miembros**.');
  }

  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const check = canModerate(interaction, member, { requireMember: false });
  if (!check.ok) return replyError(interaction, 'Accion no permitida', check.reason);

  await interaction.deferReply();

  try {
    await interaction.guild.bans.create(user.id, {
      reason: `${reason} · por ${interaction.user.tag}`,
      deleteMessageSeconds: deleteDays * 86_400
    });
  } catch (error) {
    return replyError(interaction, 'No se pudo banear', `Discord respondio: \`${error.message}\``);
  }

  const { embed } = await recordSanction({
    guild: interaction.guild,
    user, member,
    moderator: interaction.user,
    type: 'ban',
    reason,
    extra: deleteDays
      ? [{ name: '🧹 Mensajes borrados', value: `Ultimos ${deleteDays} dia(s)`, inline: true }]
      : []
  });

  return interaction.editReply({ embeds: [embed] });
}
