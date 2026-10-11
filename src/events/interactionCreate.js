import { Events } from 'discord.js';
import { errorEmbed } from '../utils/theme.js';

export const name = Events.InteractionCreate;

export async function execute(interaction) {
  if (interaction.isStringSelectMenu() && interaction.customId === 'documentacion:categoria') {
    const command = interaction.client.commands.get('documentacion');
    if (!command?.handleSelect) return;
    try {
      await command.handleSelect(interaction);
    } catch (error) {
      console.error('[documentacion]', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'No se pudo cargar esa categoria.', flags: 64 }).catch(() => null);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    console.warn(`[interactionCreate] comando desconocido: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[comando ${interaction.commandName}]`, error);

    const embed = errorEmbed(
      'Algo fallo al ejecutar el comando',
      `\`\`\`${String(error.message).slice(0, 500)}\`\`\`\n` +
      'Si se repite, revisa la consola del bot y la configuracion de Supabase.'
    );

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [embed] }).catch(() => null);
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 }).catch(() => null);
    }
  }
}
