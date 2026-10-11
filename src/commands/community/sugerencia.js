import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getSettings, logAudit } from '../../database/db.js';
import { baseEmbed, theme } from '../../utils/theme.js';
import { replyError } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('sugerencia')
  .setDescription('Envía una sugerencia al canal configurado')
  .setDMPermission(false)
  .addStringOption((option) =>
    option
      .setName('texto')
      .setDescription('La sugerencia que quieres enviar')
      .setRequired(true)
      .setMaxLength(2000));

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 });

  const settings = await getSettings(interaction.guild.id);
  if (!settings?.suggestion_channel_id) {
    return replyError(
      interaction,
      'Sugerencias no configuradas',
      'Un administrador debe configurar primero el canal con `/config sugerencias canal:#canal`.'
    );
  }

  const channel = await interaction.guild.channels.fetch(settings.suggestion_channel_id).catch(() => null);
  if (!channel?.isTextBased()) {
    return replyError(
      interaction,
      'Canal de sugerencias no disponible',
      'El canal configurado ya no existe o no permite publicar mensajes. Pide a un administrador que lo configure de nuevo.'
    );
  }

  const permissions = channel.permissionsFor(interaction.guild.members.me);
  if (!permissions?.has(PermissionFlagsBits.SendMessages) ||
      !permissions.has(PermissionFlagsBits.EmbedLinks) ||
      !permissions.has(PermissionFlagsBits.AddReactions) ||
      !permissions.has(PermissionFlagsBits.ManageMessages)) {
    return replyError(
      interaction,
      'No puedo publicar la sugerencia',
      `Necesito **Enviar mensajes**, **Insertar enlaces**, **Añadir reacciones** y **Gestionar mensajes** en <#${channel.id}>.`
    );
  }

  const suggestion = baseEmbed({ color: theme.colors.info })
    .setAuthor({
      name: `💡 Sugerencia de ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL({ size: 128 })
    })
    .setDescription(interaction.options.getString('texto', true))
    .addFields({
      name: 'Votos',
      value: '✅ A favor: **0**\n❌ En contra: **0**'
    })
    .setFooter({ text: `Sugerencia · ID del usuario: ${interaction.user.id}` });

  const message = await channel.send({
    embeds: [suggestion],
    allowedMentions: { parse: [] }
  });

  for (const emoji of ['✅', '❌', '🔒']) {
    await message.react(emoji);
  }

  await logAudit({
    guildId: interaction.guild.id,
    action: 'suggestion.create',
    actor: interaction.user,
    metadata: { channel_id: channel.id, message_id: message.id }
  });

  return interaction.editReply({
    content: `Tu sugerencia se publicó en <#${channel.id}>.`
  });
}
