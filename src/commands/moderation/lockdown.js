import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { logAudit } from '../../database/db.js';
import { successEmbed } from '../../utils/theme.js';
import { replyError, sendLog } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('lockdown')
  .setDescription('Bloquea el canal actual para los miembros')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false);

export async function execute(interaction) {
  const channel = interaction.channel;
  if (!channel?.permissionOverwrites || !channel.guild) return replyError(interaction, 'Canal no compatible', 'No se puede bloquear este canal.');
  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) return replyError(interaction, 'Me falta un permiso', 'Necesito **Gestionar canales**.');
  await interaction.deferReply();
  try {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }, { reason: `Lockdown por ${interaction.user.tag}` });
  } catch (error) {
    return replyError(interaction, 'No se pudo bloquear', `Discord respondio: \`${error.message}\``);
  }
  const embed = successEmbed('Canal bloqueado', `${channel} fue bloqueado para los miembros.`).setFooter({ text: `Por ${interaction.user.tag}` });
  await Promise.all([logAudit({ guildId: interaction.guild.id, action: 'channel.lockdown', actor: interaction.user, metadata: { channel_id: channel.id } }), sendLog(interaction.guild, embed)]);
  return interaction.editReply({ embeds: [embed] });
}
