import { PermissionFlagsBits } from 'discord.js';
import { baseEmbed, theme } from '../utils/theme.js';
import { recordSanction } from './moderation.js';

/** `${guildId}:${userId}` → { messages: [{ id, channelId, content, at }], lastHit } */
const buckets = new Map();
const CLEANUP_MS = 120_000;

setInterval(() => {
  const cutoff = Date.now() - CLEANUP_MS;
  for (const [key, bucket] of buckets) {
    bucket.messages = bucket.messages.filter((m) => m.at > cutoff);
    if (!bucket.messages.length) buckets.delete(key);
  }
}, CLEANUP_MS).unref?.();

/**
 * Analiza un mensaje y aplica la accion configurada si detecta spam.
 * Devuelve true si se tomo una accion.
 */
export async function inspectMessage(message, settings) {
  if (!settings?.antispam_enabled) return false;

  const member = message.member;
  if (!member) return false;

  // Los moderadores quedan exentos
  if (member.permissions.has(PermissionFlagsBits.ManageMessages) ||
      member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return false;
  }

  const key = `${message.guild.id}:${member.id}`;
  const now = Date.now();
  const windowMs = settings.antispam_window_sec * 1000;

  const bucket = buckets.get(key) ?? { messages: [], lastHit: 0 };
  bucket.messages = bucket.messages.filter((m) => now - m.at < windowMs);
  bucket.messages.push({
    id: message.id,
    channelId: message.channel.id,
    content: message.content.trim().toLowerCase(),
    at: now
  });
  buckets.set(key, bucket);

  const reason = detect(bucket, message, settings);
  if (!reason) return false;

  // Evita castigar dos veces por la misma rafaga
  if (now - bucket.lastHit < 10_000) return true;
  bucket.lastHit = now;

  const offending = [...bucket.messages];
  bucket.messages = [];

  await punish(message, settings, reason, offending);
  return true;
}

function detect(bucket, message, settings) {
  const count = bucket.messages.length;

  if (count >= settings.antispam_max_messages) {
    return `Envio ${count} mensajes en ${settings.antispam_window_sec}s (limite: ${settings.antispam_max_messages})`;
  }

  const current = bucket.messages.at(-1).content;
  if (current.length > 0) {
    const duplicates = bucket.messages.filter((m) => m.content === current).length;
    if (duplicates >= settings.antispam_duplicates) {
      return `Repitio el mismo mensaje ${duplicates} veces seguidas (limite: ${settings.antispam_duplicates})`;
    }
  }

  const mentions = message.mentions.users.size + message.mentions.roles.size;
  if (mentions >= settings.antispam_max_mentions) {
    return `Uso ${mentions} menciones en un solo mensaje (limite: ${settings.antispam_max_mentions})`;
  }

  // Mismo mensaje repetido en varios canales (spam cruzado)
  const channels = new Set(bucket.messages.filter((m) => m.content === current).map((m) => m.channelId));
  if (current.length > 10 && channels.size >= 3) {
    return `Publico el mismo mensaje en ${channels.size} canales distintos`;
  }

  return null;
}

async function punish(message, settings, reason, offending) {
  const { guild, member, channel } = message;
  const action = settings.antispam_action;

  // 1) Borrar la rafaga
  if (guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
    const byChannel = new Map();
    for (const m of offending) {
      if (!byChannel.has(m.channelId)) byChannel.set(m.channelId, []);
      byChannel.get(m.channelId).push(m.id);
    }
    for (const [channelId, ids] of byChannel) {
      const target = guild.channels.cache.get(channelId);
      if (target?.isTextBased()) await target.bulkDelete(ids, true).catch(() => null);
    }
  }

  // 2) Aplicar la sancion configurada
  let durationMs = null;
  let applied = 'aviso';

  try {
    if (action === 'timeout' && guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      durationMs = settings.antispam_timeout_min * 60_000;
      await member.timeout(durationMs, `Anti-spam: ${reason}`);
      applied = `timeout de ${settings.antispam_timeout_min} min`;
    } else if (action === 'kick' && member.kickable) {
      await member.kick(`Anti-spam: ${reason}`);
      applied = 'expulsion';
    } else if (action === 'ban' && member.bannable) {
      await member.ban({ reason: `Anti-spam: ${reason}`, deleteMessageSeconds: 3600 });
      applied = 'ban';
    }
  } catch (error) {
    console.error('[antispam] punish:', error.message);
  }

  // 3) Registrar la infraccion y los logs
  await recordSanction({
    guild,
    user: member.user,
    member,
    moderator: null,
    type: 'spam',
    reason,
    durationMs,
    extra: [
      { name: '⚡ Accion aplicada', value: applied, inline: true },
      { name: '📍 Canal', value: `${channel}`, inline: true },
      { name: '🧹 Mensajes borrados', value: String(offending.length), inline: true }
    ]
  }).catch((error) => console.error('[antispam] recordSanction:', error.message));

  // 4) Aviso breve y autodestruible en el canal
  if (channel.isTextBased()) {
    const notice = baseEmbed({ color: theme.colors.warning })
      .setDescription(
        `${theme.icons.spam}  ${member} — **anti-spam activado**\n` +
        `> ${reason}\n> Accion: **${applied}**`
      );
    const sent = await channel.send({ embeds: [notice] }).catch(() => null);
    if (sent) setTimeout(() => sent.delete().catch(() => null), 8000).unref?.();
  }
}
