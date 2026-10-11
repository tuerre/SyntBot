import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');

/** Carga todos los comandos de src/commands, incluidas sus categorias. */
export async function loadCommands() {
  const dir = path.join(ROOT, 'commands');
  const files = await findJavaScriptFiles(dir);
  const commands = new Map();

  for (const file of files) {
    const module = await import(pathToFileURL(file).href);
    if (!module.data || !module.execute) {
      console.warn(`[loader] ${path.relative(dir, file)} ignorado: falta "data" o "execute".`);
      continue;
    }
    if (commands.has(module.data.name)) {
      throw new Error(`Comando duplicado: /${module.data.name}`);
    }
    commands.set(module.data.name, module);
  }

  return commands;
}

async function findJavaScriptFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await findJavaScriptFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
  }

  return files;
}

/** Registra todos los eventos de src/events en el cliente. */
export async function loadEvents(client) {
  const dir = path.join(ROOT, 'events');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const module = await import(pathToFileURL(path.join(dir, file)).href);
    if (!module.name || !module.execute) {
      console.warn(`[loader] evento ${file} ignorado: falta "name" o "execute".`);
      continue;
    }
    if (module.once) client.once(module.name, (...args) => module.execute(...args));
    else client.on(module.name, (...args) => module.execute(...args));
  }
}
