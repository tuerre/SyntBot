import { ActivityType, Events } from 'discord.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client) {
  const guilds = client.guilds.cache.size;

  console.log('─────────────────────────────────────────────');
  console.log(`  SyntBot conectado como ${client.user.tag}`);
  console.log(`  Servidores: ${guilds}`);
  console.log(`  Comandos cargados: ${client.commands.size}`);
  console.log('─────────────────────────────────────────────');

  client.user.setPresence({
    status: 'online',
    activities: [{ name: `moderando ${guilds} servidor(es)`, type: ActivityType.Custom, state: '📍 /help · tuerre.vercel.app' }]
  });
}
