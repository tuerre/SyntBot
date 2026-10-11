import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getSettings, logAudit, updateSettings } from '../../database/db.js';
import { DIVIDER, baseEmbed, successEmbed, theme } from '../../utils/theme.js';
import { replyError, sendLog, timestamp } from '../../utils/utils.js';

const onOff = (value) => (value ? '🟢 activado' : '🔴 desactivado');
const channelOrNone = (id) => (id ? `<#${id}>` : '`sin definir`');

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configura el bot en este servidor')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)

  .addSubcommand((s) =>
    s.setName('ver').setDescription('Muestra la configuracion actual del servidor'))

  .addSubcommand((s) =>
    s.setName('bienvenida').setDescription('Configura los mensajes de bienvenida')
      .addBooleanOption((o) => o.setName('activar').setDescription('Activar o desactivar las bienvenidas'))
      .addChannelOption((o) =>
        o.setName('canal').setDescription('Canal donde se publican las bienvenidas')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addStringOption((o) =>
        o.setName('mensaje')
          .setDescription('Texto. Placeholders: {user} {username} {tag} {server} {memberCount}')
          .setMaxLength(1500))
      .addStringOption((o) => o.setName('imagen').setDescription('URL de imagen para el embed de bienvenida'))
      .addRoleOption((o) => o.setName('autorol').setDescription('Rol que se asigna automaticamente al entrar'))
      .addBooleanOption((o) => o.setName('dm').setDescription('Enviar tambien un mensaje privado al nuevo miembro'))
      .addStringOption((o) =>
        o.setName('mensaje_dm').setDescription('Texto del mensaje privado').setMaxLength(1500)))

  .addSubcommand((s) =>
    s.setName('despedida').setDescription('Configura los mensajes de despedida')
      .addBooleanOption((o) => o.setName('activar').setDescription('Activar o desactivar las despedidas'))
      .addChannelOption((o) =>
        o.setName('canal').setDescription('Canal donde se publican las despedidas')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addStringOption((o) =>
        o.setName('mensaje').setDescription('Texto de despedida. Placeholders iguales a la bienvenida').setMaxLength(1500)))

  .addSubcommand((s) =>
    s.setName('registros').setDescription('Define el canal de registros de moderacion')
      .addChannelOption((o) =>
        o.setName('canal').setDescription('Canal de logs (dejalo vacio para desactivar)')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))

  .addSubcommand((s) =>
    s.setName('alertas').setDescription('Define el canal de alertas de seguridad')
      .addChannelOption((o) =>
        o.setName('canal').setDescription('Canal para alertas de usuarios sospechosos y protecciones')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))

  .addSubcommand((s) =>
    s.setName('sugerencias').setDescription('Define el canal donde se publican las sugerencias')
      .addChannelOption((o) =>
        o.setName('canal').setDescription('Canal de sugerencias')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))

  .addSubcommand((s) =>
    s.setName('antispam').setDescription('Configura el filtro anti-spam')
      .addBooleanOption((o) => o.setName('activar').setDescription('Activar o desactivar el anti-spam'))
      .addIntegerOption((o) =>
        o.setName('mensajes').setDescription('Mensajes permitidos dentro de la ventana (2-20)')
          .setMinValue(2).setMaxValue(20))
      .addIntegerOption((o) =>
        o.setName('ventana').setDescription('Tamaño de la ventana en segundos (2-60)')
          .setMinValue(2).setMaxValue(60))
      .addIntegerOption((o) =>
        o.setName('duplicados').setDescription('Mensajes identicos seguidos permitidos (2-10)')
          .setMinValue(2).setMaxValue(10))
      .addIntegerOption((o) =>
        o.setName('menciones').setDescription('Menciones maximas por mensaje (2-20)')
          .setMinValue(2).setMaxValue(20))
      .addStringOption((o) =>
        o.setName('accion').setDescription('Que hacer al detectar spam')
          .addChoices(
            { name: 'Solo avisar', value: 'warn' },
            { name: 'Timeout', value: 'timeout' },
            { name: 'Expulsar', value: 'kick' },
            { name: 'Banear', value: 'ban' }
          ))
      .addIntegerOption((o) =>
        o.setName('minutos_timeout').setDescription('Minutos de timeout si la accion es timeout (1-1440)')
          .setMinValue(1).setMaxValue(1440)))

  .addSubcommand((s) =>
    s.setName('antiraid').setDescription('Configura la proteccion anti-raid')
      .addBooleanOption((o) => o.setName('activar').setDescription('Activar o desactivar el anti-raid'))
      .addIntegerOption((o) =>
        o.setName('entradas').setDescription('Entradas que disparan la alarma (3-50)')
          .setMinValue(3).setMaxValue(50))
      .addIntegerOption((o) =>
        o.setName('ventana').setDescription('Ventana en segundos para contar entradas (5-120)')
          .setMinValue(5).setMaxValue(120))
      .addStringOption((o) =>
        o.setName('accion').setDescription('Que hacer al detectar una raid')
          .addChoices(
            { name: 'Bloqueo del servidor (verificacion alta)', value: 'lockdown' },
            { name: 'Expulsar a los que entran', value: 'kick' },
            { name: 'Banear a los que entran', value: 'ban' }
          ))
      .addIntegerOption((o) =>
        o.setName('edad_minima').setDescription('Horas minimas de antiguedad de cuenta (0 = sin filtro)')
          .setMinValue(0).setMaxValue(720)));

/* Mapa opcion de Discord → columna de la base de datos */
const FIELD_MAP = {
  bienvenida: {
    activar: ['welcome_enabled', 'boolean'],
    canal: ['welcome_channel_id', 'channel'],
    mensaje: ['welcome_message', 'string'],
    imagen: ['welcome_image_url', 'string'],
    autorol: ['autorole_id', 'role'],
    dm: ['welcome_dm_enabled', 'boolean'],
    mensaje_dm: ['welcome_dm_message', 'string']
  },
  despedida: {
    activar: ['farewell_enabled', 'boolean'],
    canal: ['farewell_channel_id', 'channel'],
    mensaje: ['farewell_message', 'string']
  },
  registros: {
    canal: ['log_channel_id', 'channel']
  },
  alertas: {
    canal: ['alert_channel_id', 'channel']
  },
  sugerencias: {
    canal: ['suggestion_channel_id', 'channel']
  },
  antispam: {
    activar: ['antispam_enabled', 'boolean'],
    mensajes: ['antispam_max_messages', 'integer'],
    ventana: ['antispam_window_sec', 'integer'],
    duplicados: ['antispam_duplicates', 'integer'],
    menciones: ['antispam_max_mentions', 'integer'],
    accion: ['antispam_action', 'string'],
    minutos_timeout: ['antispam_timeout_min', 'integer']
  },
  antiraid: {
    activar: ['antiraid_enabled', 'boolean'],
    entradas: ['antiraid_join_count', 'integer'],
    ventana: ['antiraid_window_sec', 'integer'],
    accion: ['antiraid_action', 'string'],
    edad_minima: ['antiraid_min_age_hours', 'integer']
  }
};

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  await interaction.deferReply();

  if (sub === 'ver') return showConfig(interaction);

  const mapping = FIELD_MAP[sub];
  const patch = {};
  const changes = [];

  for (const [optionName, [column, type]] of Object.entries(mapping)) {
    let value;
    if (type === 'boolean') value = interaction.options.getBoolean(optionName);
    else if (type === 'integer') value = interaction.options.getInteger(optionName);
    else if (type === 'channel') value = interaction.options.getChannel(optionName)?.id ?? null;
    else if (type === 'role') value = interaction.options.getRole(optionName)?.id ?? null;
    else value = interaction.options.getString(optionName);

    if (value === null || value === undefined) continue;
    patch[column] = value;
    changes.push({ column, value });
  }

  if (!changes.length) {
    return replyError(
      interaction, 'Nada que cambiar',
      'Indica al menos una opcion. Usa `/config ver` para revisar la configuracion actual.'
    );
  }

  // Validaciones de permisos sobre los canales elegidos
  for (const key of ['welcome_channel_id', 'farewell_channel_id', 'log_channel_id', 'alert_channel_id', 'suggestion_channel_id']) {
    if (!patch[key]) continue;
    const channel = await interaction.guild.channels.fetch(patch[key]).catch(() => null);
    const perms = channel?.permissionsFor(interaction.guild.members.me);
    const requiredPermissions = [
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks
    ];
    if (key === 'suggestion_channel_id') {
      requiredPermissions.push(PermissionFlagsBits.AddReactions, PermissionFlagsBits.ManageMessages);
    }
    if (!requiredPermissions.every((permission) => perms?.has(permission))) {
      const extra = key === 'suggestion_channel_id'
        ? ' **Añadir reacciones** y **Gestionar mensajes**'
        : '';
      return replyError(
        interaction, 'No puedo escribir ahi',
        `Necesito **Enviar mensajes** e **Insertar enlaces**${extra} en <#${patch[key]}>.`
      );
    }
  }

  if (patch.autorole_id) {
    const role = await interaction.guild.roles.fetch(patch.autorole_id).catch(() => null);
    if (!role) return replyError(interaction, 'Rol invalido', 'No encuentro ese rol.');
    if (role.managed) return replyError(interaction, 'Rol invalido', 'Ese rol lo gestiona una integracion y no puedo asignarlo.');
    if (interaction.guild.members.me.roles.highest.comparePositionTo(role) <= 0) {
      return replyError(interaction, 'Jerarquia insuficiente', `Mi rol debe estar **por encima** de ${role}.`);
    }
  }

  try {
    await updateSettings(interaction.guild.id, patch);
  } catch (error) {
    return replyError(interaction, 'Error al guardar', error.message);
  }

  for (const change of changes) {
    await logAudit({
      guildId: interaction.guild.id,
      action: 'config.update',
      actor: interaction.user,
      metadata: { section: sub, setting: change.column, value: change.value }
    });
  }

  const summary = changes
    .map((c) => `• \`${c.column}\` → **${formatValue(c.column, c.value)}**`)
    .join('\n');

  const embed = successEmbed(
    `Configuracion de ${sub} actualizada`,
    `${summary}\n\n${DIVIDER}\nUsa \`/config ver\` para revisar todo.`
  ).setFooter({ text: `Cambiado por ${interaction.user.tag}` });

  await sendLog(interaction.guild, embed);
  return interaction.editReply({ embeds: [embed] });
}

function formatValue(column, value) {
  if (typeof value === 'boolean') return value ? 'activado' : 'desactivado';
  if (column.endsWith('_channel_id')) return `#${value}`;
  if (column === 'autorole_id') return `rol ${value}`;
  return String(value);
}

async function showConfig(interaction) {
  const s = await getSettings(interaction.guild.id);

  const embed = baseEmbed({ color: theme.colors.brand })
    .setAuthor({
      name: `${theme.icons.settings}  Configuracion de ${interaction.guild.name}`,
      iconURL: interaction.guild.iconURL({ size: 128 }) ?? undefined
    })
    .setDescription(`${DIVIDER}\nAjusta cualquier apartado con \`/config <apartado>\`.\n${DIVIDER}`)
    .addFields(
      {
        name: `${theme.icons.welcome} Bienvenidas`,
        value:
          `**Estado:** ${onOff(s.welcome_enabled)}\n` +
          `**Canal:** ${channelOrNone(s.welcome_channel_id)}\n` +
          `**Autorol:** ${s.autorole_id ? `<@&${s.autorole_id}>` : '`sin definir`'}\n` +
          `**DM:** ${onOff(s.welcome_dm_enabled)}\n` +
          `**Mensaje:**\n> ${(s.welcome_message ?? '—').slice(0, 300)}`
      },
      {
        name: '📤 Despedidas',
        value:
          `**Estado:** ${onOff(s.farewell_enabled)}\n` +
          `**Canal:** ${channelOrNone(s.farewell_channel_id)}\n` +
          `**Mensaje:**\n> ${(s.farewell_message ?? '—').slice(0, 300)}`
      },
      {
        name: `${theme.icons.audit} Registros`,
        value:
          `**Canal de logs:** ${channelOrNone(s.log_channel_id)}\n` +
          `**Canal de alertas:** ${channelOrNone(s.alert_channel_id)}`
      },
      {
        name: '💡 Sugerencias',
        value: `**Canal:** ${channelOrNone(s.suggestion_channel_id)}`
      },
      {
        name: '🚫 Anti-spam',
        value:
          `**Estado:** ${onOff(s.antispam_enabled)}\n` +
          `**Limite:** ${s.antispam_max_messages} mensajes / ${s.antispam_window_sec}s\n` +
          `**Duplicados:** ${s.antispam_duplicates} · **Menciones:** ${s.antispam_max_mentions}\n` +
          `**Accion:** \`${s.antispam_action}\`` +
          (s.antispam_action === 'timeout' ? ` (${s.antispam_timeout_min} min)` : '')
      },
      {
        name: `${theme.icons.raid} Anti-raid`,
        value:
          `**Estado:** ${onOff(s.antiraid_enabled)}\n` +
          `**Umbral:** ${s.antiraid_join_count} entradas / ${s.antiraid_window_sec}s\n` +
          `**Accion:** \`${s.antiraid_action}\`\n` +
          `**Edad minima de cuenta:** ${s.antiraid_min_age_hours ? `${s.antiraid_min_age_hours} h` : 'sin filtro'}` +
          (s.antiraid_active_until && new Date(s.antiraid_active_until) > new Date()
            ? `\n**⚠️ Bloqueo activo hasta** ${timestamp(s.antiraid_active_until, 'R')}`
            : '')
      }
    )
    .setFooter({ text: 'Los datos se guardan en Supabase (tabla guild_settings)' });

  return interaction.editReply({ embeds: [embed] });
}
