import { SlashCommandBuilder } from 'discord.js';
import { baseEmbed, DIVIDER, theme } from '../../utils/theme.js';
import { timestamp } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Muestra informacion del servidor')
  .setDMPermission(false);

export async function execute(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const owner = await guild.fetchOwner().catch(() => null);
  const channels = guild.channels.cache;
  const members = guild.memberCount;
  const bots = guild.members.cache.filter((member) => member.user.bot).size;
  const roles = guild.roles.cache.filter((role) => role.id !== guild.id).size;

  const embed = baseEmbed({ color: guild.members.me?.displayColor || theme.colors.brand })
    .setAuthor({ name: `${theme.icons.info}  ${guild.name}`, iconURL: guild.iconURL({ size: 128 }) ?? undefined })
    .setThumbnail(guild.iconURL({ size: 256 }))
    .setDescription(`${DIVIDER}\n**ID:** \`${guild.id}\`\n**Dueño:** ${owner ?? `\`${guild.ownerId}\``}`)
    .addFields(
      { name: '👥 Miembros', value: `**Total:** ${members}\n**Bots visibles:** ${bots}`, inline: true },
      { name: '📚 Canales', value: `**Total:** ${channels.size}\n**Texto:** ${channels.filter((c) => c.isTextBased()).size}`, inline: true },
      { name: '🎭 Roles', value: String(roles), inline: true },
      { name: '🚀 Servidor creado', value: `${timestamp(guild.createdTimestamp, 'D')}\n${timestamp(guild.createdTimestamp, 'R')}`, inline: true },
      { name: '🔐 Verificacion', value: String(guild.verificationLevel), inline: true },
      { name: '😀 Emojis', value: String(guild.emojis.cache.size), inline: true }
    )
    .setFooter({ text: `Consultado por ${interaction.user.tag}` });

  return interaction.editReply({ embeds: [embed] });
}
