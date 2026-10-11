import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { recordSanction } from '../../services/moderation.js';
import { canModerate, parseDuration, replyError } from '../../utils/utils.js';

const MAX_TIMEOUT = 28 * 86_400_000; // limite de Discord: 28 dias

export const data = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Aisla temporalmente a un usuario (no puede hablar ni entrar a voz)')
  .addUserOption((o) => o.setName('usuario').setDescription('Usuario a aislar').setRequired(true))
  .addStringOption((o) =>
    o.setName('duracion')
      .setDescription('Ej: 10m, 1h, 1h30m, 7d (maximo 28d)')
      .setRequired(true))
  .addStringOption((o) => o.setName('motivo').setDescription('Motivo del timeout').setMaxLength(500))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const user = interaction.options.getUser('usuario', true);
  const rawDuration = interaction.options.getString('duracion', true);
  const reason = interaction.options.getString('motivo') ?? 'Sin motivo especificado';

  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return replyError(interaction, 'Me falta un permiso', 'Necesito el permiso **Aislar miembros**.');
  }

  const durationMs = parseDuration(rawDuration);
  if (!durationMs) {
    return replyError(
      interaction, 'Duracion invalida',
      'Usa el formato `10m`, `2h`, `1h30m`, `7d`. Unidades validas: `s`, `m`, `h`, `d`, `w`.'
    );
  }
  if (durationMs > MAX_TIMEOUT) {
    return replyError(interaction, 'Duracion demasiado larga', 'Discord permite como maximo **28 dias** de timeout.');
  }

  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const check = canModerate(interaction, member);
  if (!check.ok) return replyError(interaction, 'Accion no permitida', check.reason);

  await interaction.deferReply();

  try {
    await member.timeout(durationMs, `${reason} · por ${interaction.user.tag}`);
  } catch (error) {
    return replyError(interaction, 'No se pudo aplicar el timeout', `Discord respondio: \`${error.message}\``);
  }

  const { embed } = await recordSanction({
    guild: interaction.guild, user, member,
    moderator: interaction.user, type: 'timeout', reason, durationMs
  });

  return interaction.editReply({ embeds: [embed] });
}
