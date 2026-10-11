import { Events } from 'discord.js';
import { getSettings } from '../database/db.js';
import { inspectMessage } from '../services/antispam.js';

export const name = Events.MessageCreate;

export async function execute(message) {
  if (message.author.bot || !message.guild || message.system) return;

  try {
    const settings = await getSettings(message.guild.id);
    await inspectMessage(message, settings);
  } catch (error) {
    console.error('[messageCreate]', error.message);
  }
}
