import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config/env.js';
import { assertDatabase } from './database/supabase.js';
import { loadCommands, loadEvents } from './core/loader.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,     // bienvenidas, anti-raid  → INTENT PRIVILEGIADO
    GatewayIntentBits.GuildMessages,    // anti-spam
    GatewayIntentBits.MessageContent,   // anti-spam (duplicados)  → INTENT PRIVILEGIADO
    GatewayIntentBits.GuildMessageReactions, // votaciones de sugerencias
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.GuildMember, Partials.Channel, Partials.Message, Partials.Reaction]
});

async function main() {
  console.log('Comprobando conexion con Supabase…');
  await assertDatabase();
  console.log('Supabase OK.');

  client.commands = await loadCommands();
  await loadEvents(client);

  await client.login(config.token);
}

client.on('error', (error) => console.error('[client error]', error));
client.on('shardError', (error) => console.error('[shard error]', error));
process.on('unhandledRejection', (error) => console.error('[unhandledRejection]', error));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log(`\nRecibido ${signal}, cerrando SyntBot…`);
    await client.destroy();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('\nNo se pudo iniciar SyntBot:\n ', error.message, '\n');
  process.exit(1);
});
