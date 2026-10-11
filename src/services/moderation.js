import { addInfraction, deactivateActive, logAudit } from '../database/db.js';
import { moderationEmbed, baseEmbed, theme } from '../utils/theme.js';
import { formatDuration, notifyUser, sendLog, timestamp } from '../utils/utils.js';

/**
 * Registra una sancion en Supabase, avisa al usuario por DM,
 * publica en el canal de registros y devuelve el embed de confirmacion.
 */
export async function recordSanction({
  guild, user, member, moderator, type, reason, durationMs = null, extra = []
}) {
  if (type === 'untimeout') await deactivateActive(guild.id, user.id, 'timeout');

  const infraction = await addInfraction({
    guildId: guild.id, user, moderator, type, reason, durationMs
  });

  const duration = durationMs ? `${formatDuration(durationMs)} · expira ${timestamp(Date.now() + durationMs, 'R')}` : null;

  const embed = moderationEmbed({
    type, target: user, moderator, reason,
    caseNumber: infraction?.case_number, duration, extra
  });

  const meta = theme.typeMeta[type] ?? {};
  const dmEmbed = baseEmbed({ color: meta.color })
    .setTitle(`${meta.icon ?? '•'}  ${meta.label ?? type} en ${guild.name}`)
    .setDescription(
      `Se te ha aplicado una sancion del tipo **${meta.label ?? type}**.\n\n` +
      `**Motivo**\n> ${reason || 'Sin motivo especificado'}` +
      (duration ? `\n\n**Duracion**\n> ${formatDuration(durationMs)}` : '')
    )
    .setFooter({ text: `Caso #${infraction?.case_number ?? '—'} · ${guild.name}` });

  const dmSent = type === 'untimeout' ? false : await notifyUser(user, dmEmbed);

  await Promise.all([
    sendLog(guild, embed),
    logAudit({
      guildId: guild.id,
      action: `moderation.${type}`,
      actor: moderator,
      target: user,
      metadata: {
        case_number: infraction?.case_number,
        reason,
        duration_ms: durationMs,
        dm_sent: dmSent,
        roles: member?.roles?.cache?.map((r) => r.id).slice(0, 25) ?? []
      }
    })
  ]);

  if (!dmSent && type !== 'untimeout') {
    embed.addFields({ name: '📬 Aviso por DM', value: 'No se pudo enviar (DMs cerrados)', inline: true });
  }

  return { embed, infraction };
}
