import { EmbedBuilder } from 'discord.js';
import { config } from '../config/env.js';

/** Paleta y simbolos usados por todos los embeds del bot. */
export const theme = {
  colors: {
    brand:   config.brandColor,
    success: 0x2ecc71,
    danger:  0xed4245,
    warning: 0xfaa61a,
    info:    0x5865f2,
    neutral: 0x2b2d31,
    mute:    0x9b59b6
  },
  icons: {
    ban: '⛔', kick: '👟', timeout: '🔇', untimeout: '🔊', warn: '⚠️',
    spam: '🚫', raid: '🛡️', info: 'ℹ️', success: '✅', error: '❌',
    stats: '📊', history: '📜', audit: '🗂️', welcome: '👋', settings: '⚙️',
    user: '👤', clock: '🕒', shield: '🛡️', hash: '＃'
  },
  typeMeta: {
    ban:       { label: 'Ban',        icon: '⛔', color: 0xed4245 },
    unban:     { label: 'Unban',      icon: '♻️', color: 0x2ecc71 },
    kick:      { label: 'Expulsion',  icon: '👟', color: 0xe67e22 },
    timeout:   { label: 'Timeout',    icon: '🔇', color: 0x9b59b6 },
    untimeout: { label: 'Timeout fin',icon: '🔊', color: 0x2ecc71 },
    warn:      { label: 'Aviso',      icon: '⚠️', color: 0xfaa61a },
    spam:      { label: 'Anti-spam',  icon: '🚫', color: 0xfaa61a },
    raid:      { label: 'Anti-raid',  icon: '🛡️', color: 0xed4245 }
  }
};

const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

export function baseEmbed({ color = theme.colors.brand } = {}) {
  return new EmbedBuilder().setColor(color).setTimestamp();
}

/** Embed de accion de moderacion, estilo tarjeta. */
export function moderationEmbed({ type, target, moderator, reason, caseNumber, duration, extra = [] }) {
  const meta = theme.typeMeta[type] ?? { label: type, icon: '•', color: theme.colors.neutral };
  const embed = baseEmbed({ color: meta.color })
    .setAuthor({
      name: `${meta.icon}  ${meta.label} · Caso #${caseNumber ?? '—'}`,
      iconURL: target?.displayAvatarURL?.({ size: 128 })
    })
    .setDescription(
      `${DIVIDER}\n` +
      `${theme.icons.user} **Usuario**\n> ${target ? `${target} \`${target.tag ?? target.id}\`` : '—'}\n` +
      `${theme.icons.shield} **Moderador**\n> ${moderator ? `${moderator} \`${moderator.tag ?? moderator.id}\`` : 'Automatico'}`
    )
    .addFields({ name: '📝 Motivo', value: `\`\`\`${truncate(reason || 'Sin motivo especificado', 900)}\`\`\`` });

  if (duration) embed.addFields({ name: `${theme.icons.clock} Duracion`, value: duration, inline: true });
  if (extra.length) embed.addFields(...extra);

  embed.setFooter({ text: `ID: ${target?.id ?? 'desconocido'}` });
  return embed;
}

export function successEmbed(title, description) {
  return baseEmbed({ color: theme.colors.success })
    .setTitle(`${theme.icons.success}  ${title}`)
    .setDescription(description ?? null);
}

export function errorEmbed(title, description) {
  return baseEmbed({ color: theme.colors.danger })
    .setTitle(`${theme.icons.error}  ${title}`)
    .setDescription(description ?? null);
}

export function infoEmbed(title, description) {
  return baseEmbed({ color: theme.colors.info })
    .setTitle(title)
    .setDescription(description ?? null);
}

export function progressBar(value, max, size = 10) {
  if (!max) return '▱'.repeat(size);
  const filled = Math.max(0, Math.min(size, Math.round((value / max) * size)));
  return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

export function truncate(text, max) {
  const str = String(text ?? '');
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

export { DIVIDER };
