import { REST, Routes } from 'discord.js';
import { config } from './config/env.js';
import { loadCommands } from './core/loader.js';

const commands = await loadCommands();
const body = [...commands.values()].map((c) => c.data.toJSON());

const rest = new REST({ version: '10' }).setToken(config.token);

try {
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  console.log(`Registrando ${body.length} comando(s) ${config.guildId ? `en el servidor ${config.guildId}` : 'de forma global'}…`);
  const data = await rest.put(route, { body });

  console.log('\nComandos registrados:');
  for (const command of data) console.log(`  /${command.name}`);
  if (!config.guildId) console.log('\nAviso: los comandos globales pueden tardar hasta 1 hora en aparecer.');
} catch (error) {
  console.error('\nError al registrar los comandos:');
  console.error(error.rawError ? JSON.stringify(error.rawError, null, 2) : error.message);
  process.exit(1);
}
