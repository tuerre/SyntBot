import { GuildVerificationLevel, PermissionFlagsBits } from 'discord.js';
import { logAudit, updateSettings } from '../database/db.js';
import { DIVIDER, baseEmbed, theme } from '../utils/theme.js';
import { recordSanction } from './moderation.js';
import { sendAlert, sendLog, timestamp } from '../utils/utils.js';

/** guildId → array de timestamps de entradas recientes */
const joinWindows = new Map();
/** guildId → { until, previousLevel, timer } mientras hay bloqueo activo */
const lockdowns = new Map();

const LOCKDOWN_MS = 10 * 60_000; // 10 minutos de bloqueo

/**
 * Procesa una entrada al servidor.
 * Devuelve true si el miembro fue expulsado/baneado (y por tanto no debe recibir bienvenida).
 */
export async function handleJoin(member, settings) {
  if (!settings?.antiraid_enabled) return false;

  const guild = member.guild;
  const now = Date.now();
  const windowMs = settings.antiraid_window_sec * 1000;

  const recent = (joinWindows.get(guild.id) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  joinWindows.set(guild.id, recent);

  const underAttack = lockdowns.has(guild.id) && lockdowns.get(guild.id).until > now;
  const thresholdHit = recent.length >= settings.antiraid_join_count;

  // Filtro de cuentas demasiado nuevas (solo cuenta durante un ataque o si siempre esta activo)
  const accountAgeHours = (now - member.user.createdTimestamp) / 3_600_000;
  const tooNew = settings.antiraid_min_age_hours > 0 && accountAgeHours < settings.antiraid_min_age_hours;

  if (thresholdHit && !underAttack) {
    await triggerRaidAlert(guild, settings, recent.length);
  }

  const shouldAct = (thresholdHit || underAttack) && settings.antiraid_action !== 'lockdown';

  if (shouldAct || (tooNew && (thresholdHit || underAttack))) {
    const reason = tooNew
      ? `Anti-raid: cuenta creada hace ${Math.floor(accountAgeHours)}h (minimo ${settings.antiraid_min_age_hours}h)`
      : `Anti-raid: ${recent.length} entradas en ${settings.antiraid_window_sec}s`;

    const action = settings.antiraid_action === 'ban' ? 'ban' : 'kick';
    const removed = await removeMember(member, action, reason);

    if (removed) {
      await recordSanction({
        guild,
        user: member.user,
        member,
        moderator: null,
        type: 'raid',
        reason: `${reason} · accion automatica: ${action}`
      }).catch((error) => console.error('[antiraid] recordSanction:', error.message));
      return true;
    }
  }

  // Si el filtro de edad esta activo fuera de un ataque, solo se avisa en los logs
  if (tooNew && !thresholdHit && !underAttack) {
    await sendAlert(
      guild,
      baseEmbed({ color: theme.colors.warning })
        .setTitle(`${theme.icons.raid}  Cuenta nueva detectada`)
        .setDescription(
          `${member} \`${member.user.tag}\` entro al servidor.\n` +
          `**Cuenta creada:** ${timestamp(member.user.createdTimestamp, 'R')} ` +
          `(${Math.floor(accountAgeHours)}h de antiguedad)`
        )
        .setFooter({ text: `ID: ${member.id}` })
    );
  }

  return false;
}

async function removeMember(member, action, reason) {
  try {
    if (action === 'ban') {
      if (!member.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) return false;
      await member.ban({ reason });
    } else {
      if (!member.guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) return false;
      if (!member.kickable) return false;
      await member.kick(reason);
    }
    return true;
  } catch (error) {
    console.error('[antiraid] removeMember:', error.message);
    return false;
  }
}

async function triggerRaidAlert(guild, settings, joinCount) {
  const until = Date.now() + LOCKDOWN_MS;
  const previousLevel = guild.verificationLevel;

  const embed = baseEmbed({ color: theme.colors.danger })
    .setAuthor({ name: `${theme.icons.raid}  ¡POSIBLE RAID DETECTADA!` })
    .setDescription(
      `${DIVIDER}\n` +
      `**${joinCount} entradas** en los ultimos **${settings.antiraid_window_sec} segundos** ` +
      `(umbral: ${settings.antiraid_join_count}).\n\n` +
      `**Accion configurada:** \`${settings.antiraid_action}\`\n` +
      `**Modo proteccion activo hasta:** ${timestamp(until, 'T')} (${timestamp(until, 'R')})\n${DIVIDER}`
    )
    .addFields({
      name: '🧰 Que puedes hacer',
      value:
        '• `/config antiraid accion:Expulsar` para echar a quien siga entrando\n' +
        '• `/audit accion:Anti-raid` para revisar lo ocurrido\n' +
        '• `/history usuario:<id>` sobre cualquier cuenta sospechosa'
    })
    .setFooter({ text: guild.name });

  await sendAlert(guild, embed);

  await logAudit({
    guildId: guild.id,
    action: 'antiraid.triggered',
    metadata: {
      joins: joinCount,
      window_sec: settings.antiraid_window_sec,
      action: settings.antiraid_action,
      previous_verification_level: previousLevel
    }
  });

  await updateSettings(guild.id, { antiraid_active_until: new Date(until).toISOString() }).catch(() => null);

  // Modo bloqueo: subir la verificacion del servidor temporalmente
  if (settings.antiraid_action === 'lockdown') {
    if (guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild) &&
        previousLevel < GuildVerificationLevel.High) {
      await guild.setVerificationLevel(
        GuildVerificationLevel.High,
        'Anti-raid: bloqueo temporal automatico'
      ).catch((error) => console.error('[antiraid] setVerificationLevel:', error.message));
    }
  }

  const existing = lockdowns.get(guild.id);
  if (existing?.timer) clearTimeout(existing.timer);

  const timer = setTimeout(() => endLockdown(guild, previousLevel), LOCKDOWN_MS);
  timer.unref?.();
  lockdowns.set(guild.id, { until, previousLevel, timer });
}

async function endLockdown(guild, previousLevel) {
  lockdowns.delete(guild.id);
  joinWindows.delete(guild.id);

  await updateSettings(guild.id, { antiraid_active_until: null }).catch(() => null);

  if (guild.verificationLevel !== previousLevel &&
      guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await guild.setVerificationLevel(previousLevel, 'Anti-raid: fin del bloqueo temporal').catch(() => null);
  }

  await logAudit({ guildId: guild.id, action: 'antiraid.lockdown_end', metadata: { restored_level: previousLevel } });

  await sendLog(
    guild,
    baseEmbed({ color: theme.colors.success })
      .setTitle('🔓  Fin del modo proteccion')
      .setDescription('El anti-raid ha vuelto a la normalidad y la verificacion del servidor se ha restaurado.')
  );
}

/** Para /raidmode manual y para las pruebas. */
export function isUnderAttack(guildId) {
  const entry = lockdowns.get(guildId);
  return Boolean(entry && entry.until > Date.now());
}
