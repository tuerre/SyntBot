import { PermissionFlagsBits } from 'discord.js';
import { getSettings } from '../database/db.js';
import { errorEmbed } from './theme.js';

/* ───────────── Duraciones ───────────── */

const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

/** "10m", "1h30m", "7d" → milisegundos. Devuelve null si no es valido. */
export function parseDuration(input) {
  if (!input) return null;
  const matches = String(input).toLowerCase().matchAll(/(\d+)\s*(s|m|h|d|w)/g);
  let total = 0;
  for (const [, amount, unit] of matches) total += Number(amount) * UNITS[unit];
  return total > 0 ? total : null;
}

export function formatDuration(ms) {
  if (!ms || ms <= 0) return 'permanente';
  const parts = [];
  const units = [['d', 86_400_000], ['h', 3_600_000], ['m', 60_000], ['s', 1000]];
  let rest = ms;
  for (const [label, size] of units) {
    const value = Math.floor(rest / size);
    if (value > 0) { parts.push(`${value}${label}`); rest -= value * size; }
  }
  return parts.slice(0, 2).join(' ') || '0s';
}

export const timestamp = (date, style = 'f') =>
  `<t:${Math.floor(new Date(date).getTime() / 1000)}:${style}>`;

/* ───────────── Comprobaciones de jerarquia ───────────── */

/**
 * Verifica que el moderador y el bot puedan actuar sobre el objetivo.
 * Devuelve { ok: true } o { ok: false, reason: string }.
 */
export function canModerate(interaction, targetMember, { requireMember = true } = {}) {
  const { guild, member } = interaction;

  if (!targetMember) {
    return requireMember
      ? { ok: false, reason: 'Ese usuario no esta en el servidor.' }
      : { ok: true };
  }
  if (targetMember.id === member.id) {
    return { ok: false, reason: 'No puedes aplicarte una sancion a ti mismo.' };
  }
  if (targetMember.id === guild.ownerId) {
    return { ok: false, reason: 'No se puede sancionar al dueño del servidor.' };
  }
  if (targetMember.id === interaction.client.user.id) {
    return { ok: false, reason: 'No puedo sancionarme a mi mismo.' };
  }
  if (member.id !== guild.ownerId &&
      member.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
    return { ok: false, reason: 'Ese usuario tiene un rol igual o superior al tuyo.' };
  }
  if (guild.members.me.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
    return { ok: false, reason: 'Mi rol esta por debajo del rol de ese usuario. Subeme en la lista de roles.' };
  }
  return { ok: true };
}

export function botHasPermission(guild, flag) {
  return guild.members.me?.permissions.has(flag) ?? false;
}

export const PERM_NAMES = {
  [PermissionFlagsBits.BanMembers]: 'Banear miembros',
  [PermissionFlagsBits.KickMembers]: 'Expulsar miembros',
  [PermissionFlagsBits.ModerateMembers]: 'Aislar miembros (timeout)',
  [PermissionFlagsBits.ManageMessages]: 'Gestionar mensajes',
  [PermissionFlagsBits.ManageRoles]: 'Gestionar roles',
  [PermissionFlagsBits.ManageGuild]: 'Gestionar servidor'
};

/* ───────────── Respuestas ───────────── */

export async function replyError(interaction, title, description) {
  const payload = { embeds: [errorEmbed(title, description)], flags: 64 };
  if (interaction.deferred || interaction.replied) return interaction.editReply({ embeds: payload.embeds });
  return interaction.reply(payload);
}

/* ───────────── Canal de registros ───────────── */

export async function sendLog(guild, embed) {
  try {
    const settings = await getSettings(guild.id);
    if (!settings?.log_channel_id) return;
    const channel = await guild.channels.fetch(settings.log_channel_id).catch(() => null);
    if (!channel?.isTextBased()) return;
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('[utils] sendLog:', error.message);
  }
}

/** Publica alertas de seguridad en el canal dedicado o, si no existe, en los registros. */
export async function sendAlert(guild, embed) {
  try {
    const settings = await getSettings(guild.id);
    const channelId = settings?.alert_channel_id || settings?.log_channel_id;
    if (!channelId) return;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('[utils] sendAlert:', error.message);
  }
}

/** Avisa por DM al usuario sancionado. Nunca lanza. */
export async function notifyUser(user, embed) {
  try {
    await user.send({ embeds: [embed] });
    return true;
  } catch {
    return false;
  }
}

/** Reemplaza los placeholders de bienvenida/despedida. */
export function renderTemplate(template, member) {
  return String(template ?? '')
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{tag}', member.user.tag)
    .replaceAll('{id}', member.id)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{memberCount}', String(member.guild.memberCount));
}
