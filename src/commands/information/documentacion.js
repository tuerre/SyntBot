import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  SlashCommandBuilder
} from 'discord.js';
import { baseEmbed, DIVIDER, theme } from '../../utils/theme.js';

const CATEGORIES = {
  moderacion: {
    label: 'Moderacion',
    description: 'Sanciones y herramientas para el equipo de moderacion.',
    commands: [
      '`/ban usuario [motivo] [borrar_dias]` — Banea a un usuario.',
      '`/unban usuario [motivo]` — Retira un ban usando el ID del usuario.',
      '`/kick usuario [motivo]` — Expulsa a un usuario.',
      '`/timeout usuario duracion [motivo]` — Aplica un timeout.',
      '`/untimeout usuario [motivo]` — Retira un timeout.',
      '`/warn usuario motivo` — Registra un aviso.',
      '`/warnings usuario` — Consulta los avisos de un usuario.',
      '`/clearwarns usuario [motivo]` — Limpia los avisos activos.',
      '`/purges cantidad` — Borra mensajes recientes.',
      '`/lockdown` / `/unlockdown` — Bloquea o desbloquea el canal actual.'
    ]
  },
  consulta: {
    label: 'Consultas',
    description: 'Informacion, historial y documentacion del servidor.',
    commands: [
      '`/serverinfo` — Muestra la informacion del servidor.',
      '`/userinfo [usuario]` — Muestra informacion de un usuario.',
      '`/history usuario [pagina] [tipo]` — Consulta infracciones.',
      '`/case ver numero` — Consulta un caso.',
      '`/audit [cantidad] [accion] [autor]` — Consulta la auditoria.',
      '`/modlogs moderador [accion]` — Consulta acciones de un moderador.',
      '`/modstats [dias] [moderador]` — Muestra estadisticas.',
      '`/apelacion crear` / `ver` / `decidir` — Gestiona apelaciones.',
      '`/documentacion` — Abre este menu.'
    ]
  },
  configuracion: {
    label: 'Configuracion',
    description: 'Ajustes del bot y del servidor.',
    commands: [
      '`/config ver` — Muestra la configuracion.',
      '`/config bienvenida` — Configura bienvenidas.',
      '`/config despedida` — Configura despedidas.',
      '`/config registros` — Configura el canal de logs.',
      '`/config alertas` — Configura el canal de alertas de seguridad.',
      '`/config sugerencias` — Configura el canal de sugerencias.',
      '`/config antispam` — Configura el anti-spam.',
      '`/config antiraid` — Configura el anti-raid.',
      '`/slowmode segundos` — Configura el modo lento del canal actual.'
    ]
  },
  seguridad: {
    label: 'Seguridad automatica',
    description: 'Protecciones disponibles y estado actual de cada sistema.',
    commands: [
      '✅ **Anti-spam:** detecta ráfagas, duplicados y exceso de menciones.',
      '✅ **Anti-raid:** detecta entradas masivas y cuentas demasiado nuevas.',
      '✅ **Sistema de apelaciones:** permite solicitar revisión de una sanción.',
      '🚧 **Puntos de infracción:** pendiente de reglas acumulables configurables.',
      '🚧 **AutoMod configurable:** pendiente de palabras, regex y enlaces.',
      '🚧 **Slowmode automático:** pendiente de activación por spam.',
      '🚧 **Filtro de palabras:** pendiente de listas blanca/negra y excepciones.',
      '🚧 **Cuarentena:** pendiente de aislamiento temporal por canales.',
      '🚧 **Detección de reincidencia:** pendiente de reglas entre periodos.',
      '🚧 **Contenido tóxico:** pendiente de clasificación y revisión.'
    ]
  },
  sanciones: {
    label: 'Escala de sanciones',
    description: 'Referencia de la progresión recomendada para infracciones.',
    commands: [
      '1️⃣ **Primera infracción:** advertencia registrada y explicación de la regla.',
      '2️⃣ **Segunda infracción:** timeout recomendado de 5 minutos.',
      '3️⃣ **Tercera infracción:** timeout recomendado de 1 hora y aviso al equipo.',
      '🔎 **Infracciones reiteradas o graves:** revisión de un moderador y posible expulsión o ban.',
      'ℹ️ Esta escala es una referencia; actualmente las sanciones se aplican mediante `/warn`, `/timeout`, `/kick` y `/ban`.'
    ]
  },
  comunidad: {
    label: 'Comunidad',
    description: 'Funciones para la participacion de los miembros.',
    commands: [
      '`/sugerencia texto` — Publica una sugerencia.',
      'Las sugerencias incluyen votos ✅ y ❌.',
      'Los usuarios con Gestionar servidor pueden cerrarlas con 🔒.'
    ]
  }
};

export const data = new SlashCommandBuilder()
  .setName('documentacion')
  .setDescription('Muestra la documentacion y los comandos del bot')
  .setDMPermission(false);

export async function execute(interaction) {
  return interaction.reply({
    embeds: [buildEmbed()],
    components: [buildMenu()]
  });
}

export async function handleSelect(interaction) {
  const category = CATEGORIES[interaction.values[0]];
  if (!category) return interaction.reply({ content: 'Categoria no disponible.', flags: 64 });
  await interaction.update({
    embeds: [buildEmbed(interaction.values[0])],
    components: [buildMenu(interaction.values[0])]
  });
}

function buildMenu(selected = null) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('documentacion:categoria')
      .setPlaceholder('Selecciona una categoria')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(Object.entries(CATEGORIES).map(([value, category]) => ({
        label: category.label,
        value,
        description: category.description,
        default: value === selected
      })))
  );
}

function buildEmbed(categoryKey = null) {
  const category = categoryKey ? CATEGORIES[categoryKey] : null;
  return baseEmbed({ color: theme.colors.brand })
    .setTitle(`${theme.icons.info}  Documentacion de SyntBot`)
    .setDescription(
      `${DIVIDER}\n` +
      'Selecciona una categoria en el menu para consultar los comandos disponibles.'
    )
    .addFields(category
      ? { name: `📖 ${category.label}`, value: category.commands.join('\n') }
      : { name: 'Categorias disponibles', value: Object.values(CATEGORIES).map((item) => `• **${item.label}** — ${item.description}`).join('\n') }
    )
    .setFooter({ text: 'Los permisos dependen del comando y del servidor.' });
}
