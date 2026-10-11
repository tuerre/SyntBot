import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { baseEmbed } from '../../utils/theme.js';
import { replyError } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('purges')
  .setDescription('Borra varios mensajes recientes del canal')
  .addIntegerOption((o) =>
    o.setName('cantidad').setDescription('Cantidad de mensajes (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false);

export async function execute(interaction) {
  const amount = interaction.options.getInteger('cantidad', true);
  const channel = interaction.channel;
  if (!channel?.isTextBased() || typeof channel.bulkDelete !== 'function') {
    return replyError(interaction, 'Canal no compatible', 'Este comando solo funciona en canales de texto.');
  }
  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return replyError(interaction, 'Me falta un permiso', 'Necesito **Gestionar mensajes**.');
  }

  await interaction.deferReply({ flags: 64 });
  try {
    const deleted = await channel.bulkDelete(amount, true);
    return interaction.editReply({
      embeds: [baseEmbed({ color: 0x2ecc71 }).setTitle('🧹 Mensajes borrados')
        .setDescription(`Se borraron **${deleted.size}** mensaje(s) de ${channel}.`)]
    });
  } catch (error) {
    return replyError(interaction, 'No se pudieron borrar los mensajes', `Discord respondio: \`${error.message}\``);
  }
}
