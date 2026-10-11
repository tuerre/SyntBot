import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value || value.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.EJEMPLO')) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia .env.example a .env y rellena los valores reales.`
    );
  }
  return value;
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('DISCORD_CLIENT_ID'),
  guildId: process.env.DISCORD_GUILD_ID?.trim() || null,
  supabaseUrl: required('SUPABASE_URL'),
  supabaseKey: required('SUPABASE_SERVICE_KEY'),
  ownerIds: (process.env.BOT_OWNER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  brandColor: process.env.BRAND_COLOR || '#5865F2'
};
