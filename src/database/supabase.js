import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export async function assertDatabase() {
  const { error } = await supabase.from('guild_settings').select('guild_id').limit(1);
  if (error) {
    throw new Error(
      `No se pudo conectar a Supabase (${error.message}). ` +
      'Revisa SUPABASE_URL / SUPABASE_SERVICE_KEY y que hayas ejecutado schema.sql.'
    );
  }
}
