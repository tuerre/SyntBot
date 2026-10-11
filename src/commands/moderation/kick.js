import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { recordSanction } from '../../services/moderation.js';
import { canModerate, replyError } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Expulsa a un usuario del servidor y registra la infraccion')
  .addUserOption((o) => o.setName('usuario').setDescription('Usuario a expulsar').setRequired(true))
  .addStringOption((o) => o.setName('motivo').setDescription('Motivo de la expulsion').setMaxLength(500))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const user = interaction.options.getUser('usuario', true);
  const reason = interaction.options.getString('motivo') ?? 'Sin motivo especificado';

  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
    return replyError(interaction, 'Me falta un permiso', 'Necesito el permiso **Expulsar miembros**.');
  }

  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const check = canModerate(interaction, member);
  if (!check.ok) return replyError(interaction, 'Accion no permitida', check.reason);

  await interaction.deferReply();

  // El DM se envia antes de expulsar para que el usuario aun lo reciba.
  const { embed } = await recordSanction({
    guild: interaction.guild, user, member,
    moderator: interaction.user, type: 'kick', reason
  });

  try {
    await member.kick(`${reason} · por ${interaction.user.tag}`);
  } catch (error) {
    return replyError(interaction, 'No se pudo expulsar', `Discord respondio: \`${error.message}\``);
  }

  return interaction.editReply({ embeds: [embed] });
}
