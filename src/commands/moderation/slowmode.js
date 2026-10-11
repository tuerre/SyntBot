import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { logAudit } from '../../database/db.js';
import { successEmbed } from '../../utils/theme.js';
import { replyError, sendLog } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Configura el modo lento de un canal')
  .addIntegerOption((o) =>
    o.setName('segundos')
      .setDescription('Segundos entre mensajes (0 para desactivar)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(21600))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false);

export async function execute(interaction) {
  const seconds = interaction.options.getInteger('segundos', true);
  const channel = interaction.channel;

  if (!channel?.isTextBased() || typeof channel.setRateLimitPerUser !== 'function') {
    return replyError(interaction, 'Canal no compatible', 'Este comando solo funciona en canales de texto.');
  }
  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return replyError(interaction, 'Me falta un permiso', 'Necesito el permiso **Gestionar canales**.');
  }

  await interaction.deferReply();
  try {
    await channel.setRateLimitPerUser(seconds, `Configurado por ${interaction.user.tag}`);
  } catch (error) {
    return replyError(interaction, 'No se pudo cambiar el modo lento', `Discord respondio: \`${error.message}\``);
  }

  const state = seconds ? `**${seconds} segundo(s)** entre mensajes` : '**desactivado**';
  const embed = successEmbed('Modo lento actualizado', `El modo lento de ${channel} ha sido ${state}.`)
    .setFooter({ text: `Cambiado por ${interaction.user.tag}` });

  await Promise.all([
    logAudit({
      guildId: interaction.guild.id,
      action: 'channel.slowmode.update',
      actor: interaction.user,
      metadata: { channel_id: channel.id, seconds }
    }),
    sendLog(interaction.guild, embed)
  ]);

  return interaction.editReply({ embeds: [embed] });
}
