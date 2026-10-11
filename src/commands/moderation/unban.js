import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { recordSanction } from '../../services/moderation.js';
import { replyError } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Retira el ban de un usuario')
  .addStringOption((o) =>
    o.setName('usuario').setDescription('ID del usuario baneado').setRequired(true))
  .addStringOption((o) =>
    o.setName('motivo').setDescription('Motivo del unban').setMaxLength(500))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const userId = interaction.options.getString('usuario', true).trim();
  const reason = interaction.options.getString('motivo') ?? 'Sin motivo especificado';

  if (!/^\d{17,20}$/.test(userId)) {
    return replyError(interaction, 'Usuario invalido', 'Indica un ID de Discord valido.');
  }
  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
    return replyError(interaction, 'Me falta un permiso', 'Necesito el permiso **Banear miembros**.');
  }

  const banned = await interaction.guild.bans.fetch(userId).catch(() => null);
  if (!banned) {
    return replyError(interaction, 'Usuario no baneado', 'No hay un ban activo para ese usuario en este servidor.');
  }

  await interaction.deferReply();
  try {
    await interaction.guild.bans.remove(userId, `${reason} · por ${interaction.user.tag}`);
  } catch (error) {
    return replyError(interaction, 'No se pudo quitar el ban', `Discord respondio: \`${error.message}\``);
  }

  const { embed } = await recordSanction({
    guild: interaction.guild,
    user: banned.user,
    moderator: interaction.user,
    type: 'unban',
    reason
  });

  return interaction.editReply({ embeds: [embed] });
}
