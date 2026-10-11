import { supabase } from './supabase.js';

/* ───────────── Cache de configuracion por servidor ───────────── */
const settingsCache = new Map();
const CACHE_TTL = 60_000;

export const DEFAULT_SETTINGS = {
  welcome_enabled: false,
  welcome_channel_id: null,
  welcome_message: 'Bienvenido/a {user} a **{server}**. Ya somos {memberCount} miembros.',
  welcome_image_url: null,
  welcome_dm_enabled: false,
  welcome_dm_message: null,
  farewell_enabled: false,
  farewell_channel_id: null,
  farewell_message: '{username} ha salido del servidor.',
  autorole_id: null,
  suggestion_channel_id: null,
  log_channel_id: null,
  alert_channel_id: null,
  antispam_enabled: false,
  antispam_max_messages: 6,
  antispam_window_sec: 5,
  antispam_duplicates: 4,
  antispam_max_mentions: 6,
  antispam_action: 'timeout',
  antispam_timeout_min: 10,
  antiraid_enabled: false,
  antiraid_join_count: 8,
  antiraid_window_sec: 10,
  antiraid_action: 'lockdown',
  antiraid_min_age_hours: 0,
  antiraid_active_until: null
};

export async function getSettings(guildId) {
  const cached = settingsCache.get(guildId);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data;

  const { data, error } = await supabase
    .from('guild_settings')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (error) console.error('[db] getSettings:', error.message);

  let settings = data;
  if (!settings) {
    const inserted = await supabase
      .from('guild_settings')
      .upsert({ guild_id: guildId }, { onConflict: 'guild_id' })
      .select('*')
      .maybeSingle();
    settings = inserted.data ?? { guild_id: guildId, ...DEFAULT_SETTINGS };
  }

  settingsCache.set(guildId, { at: Date.now(), data: settings });
  return settings;
}

export async function updateSettings(guildId, patch) {
  const { data, error } = await supabase
    .from('guild_settings')
    .upsert({ guild_id: guildId, ...patch }, { onConflict: 'guild_id' })
    .select('*')
    .maybeSingle();

  if (error) throw new Error(`No se pudo guardar la configuracion: ${error.message}`);
  settingsCache.set(guildId, { at: Date.now(), data });
  return data;
}

export function invalidateSettings(guildId) {
  settingsCache.delete(guildId);
}

/* ───────────── Infracciones ───────────── */

async function nextCaseNumber(guildId) {
  const { data, error } = await supabase.rpc('next_case_number', { p_guild_id: guildId });
  if (error || typeof data !== 'number') {
    // Respaldo si la funcion RPC no existe todavia
    const { count } = await supabase
      .from('infractions')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId);
    return (count ?? 0) + 1;
  }
  return data;
}

export async function addInfraction({
  guildId, user, moderator, type, reason, durationMs = null
}) {
  const caseNumber = await nextCaseNumber(guildId);
  const row = {
    case_number: caseNumber,
    guild_id: guildId,
    user_id: user.id,
    user_tag: user.tag ?? user.username ?? null,
    moderator_id: moderator?.id ?? 'SYSTEM',
    moderator_tag: moderator?.tag ?? 'SyntBot (automatico)',
    type,
    reason: reason || 'Sin motivo especificado',
    duration_ms: durationMs,
    active: true,
    expires_at: durationMs ? new Date(Date.now() + durationMs).toISOString() : null
  };

  const { data, error } = await supabase.from('infractions').insert(row).select('*').maybeSingle();
  if (error) throw new Error(`No se pudo registrar la infraccion: ${error.message}`);
  return data;
}

export async function getUserInfractions(guildId, userId, { limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('infractions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`No se pudo leer el historial: ${error.message}`);
  return data ?? [];
}

export async function getWarnings(guildId, userId, { limit = 25 } = {}) {
  return getUserInfractions(guildId, userId, { limit }).then((rows) =>
    rows.filter((row) => row.type === 'warn' && row.active)
  );
}

export async function clearWarnings(guildId, userId) {
  const { data, error } = await supabase
    .from('infractions')
    .update({ active: false })
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('type', 'warn')
    .eq('active', true)
    .select('case_number');

  if (error) throw new Error(`No se pudieron limpiar los avisos: ${error.message}`);
  return data ?? [];
}

export async function getInfraction(guildId, caseNumber) {
  const { data } = await supabase
    .from('infractions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('case_number', caseNumber)
    .maybeSingle();
  return data ?? null;
}

export async function deactivateInfraction(guildId, caseNumber) {
  const { data, error } = await supabase
    .from('infractions')
    .update({ active: false })
    .eq('guild_id', guildId)
    .eq('case_number', caseNumber)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deactivateActive(guildId, userId, type) {
  await supabase
    .from('infractions')
    .update({ active: false })
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('type', type)
    .eq('active', true);
}

/* ───────────── Estadisticas ───────────── */

export async function getModStats(guildId, days = 30) {
  const { data, error } = await supabase.rpc('mod_stats', { p_guild_id: guildId, p_days: days });
  if (error) throw new Error(`No se pudieron calcular las estadisticas: ${error.message}`);
  return data ?? [];
}

export async function getGuildTotals(guildId, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('infractions')
    .select('type, user_id')
    .eq('guild_id', guildId)
    .gte('created_at', since);

  if (error) throw new Error(error.message);

  const totals = { total: data.length, ban: 0, kick: 0, timeout: 0, warn: 0, spam: 0, raid: 0 };
  const users = new Set();
  for (const row of data) {
    totals[row.type] = (totals[row.type] ?? 0) + 1;
    users.add(row.user_id);
  }
  totals.uniqueUsers = users.size;
  return totals;
}

/* ───────────── Auditoria ───────────── */

export async function logAudit({ guildId, action, actor, target, metadata = {} }) {
  const { error } = await supabase.from('audit_logs').insert({
    guild_id: guildId,
    action,
    actor_id: actor?.id ?? null,
    actor_tag: actor?.tag ?? null,
    target_id: target?.id ?? null,
    target_tag: target?.tag ?? null,
    metadata
  });
  if (error) console.error('[db] logAudit:', error.message);
}

export async function getAuditLogs(guildId, { limit = 10, action = null, actorId = null } = {}) {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (action) query = query.eq('action', action);
  if (actorId) query = query.eq('actor_id', actorId);

  const { data, error } = await query;
  if (error) throw new Error(`No se pudo leer la auditoria: ${error.message}`);
  return data ?? [];
}

export async function createAppeal({ guildId, userId, userTag, caseNumber, reason }) {
  const { data, error } = await supabase
    .from('appeals')
    .insert({ guild_id: guildId, user_id: userId, user_tag: userTag, case_number: caseNumber, reason })
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`No se pudo crear la apelacion: ${error.message}`);
  return data;
}

export async function getAppeals(guildId, { userId = null, status = null, limit = 20 } = {}) {
  let query = supabase
    .from('appeals')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (userId) query = query.eq('user_id', userId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(`No se pudieron leer las apelaciones: ${error.message}`);
  return data ?? [];
}

export async function decideAppeal(guildId, appealId, status, reviewerId, reviewerTag, decision) {
  const { data, error } = await supabase
    .from('appeals')
    .update({
      status,
      reviewer_id: reviewerId,
      reviewer_tag: reviewerTag,
      decision,
      decided_at: new Date().toISOString()
    })
    .eq('guild_id', guildId)
    .eq('id', appealId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`No se pudo resolver la apelacion: ${error.message}`);
  return data;
}
