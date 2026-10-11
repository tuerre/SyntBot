import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { createAppeal, decideAppeal, getAppeals } from '../../database/db.js';
import { baseEmbed, DIVIDER, successEmbed } from '../../utils/theme.js';
import { replyError, timestamp } from '../../utils/utils.js';

export const data = new SlashCommandBuilder()
  .setName('apelacion')
  .setDescription('Crea o gestiona apelaciones de moderacion')
  .addSubcommand((s) => s.setName('crear').setDescription('Presenta una apelacion')
    .addStringOption((o) => o.setName('motivo').setDescription('Motivo de la apelacion').setRequired(true).setMaxLength(1000))
    .addIntegerOption((o) => o.setName('caso').setDescription('Numero de caso relacionado').setMinValue(1)))
  .addSubcommand((s) => s.setName('ver').setDescription('Consulta tus apelaciones'))
  .addSubcommand((s) => s.setName('decidir').setDescription('Acepta o rechaza una apelacion')
    .addIntegerOption((o) => o.setName('id').setDescription('ID de la apelacion').setRequired(true).setMinValue(1))
    .addStringOption((o) => o.setName('estado').setDescription('Resultado').setRequired(true)
      .addChoices({ name: 'Aprobada', value: 'approved' }, { name: 'Rechazada', value: 'rejected' }))
    .addStringOption((o) => o.setName('respuesta').setDescription('Respuesta para el usuario').setRequired(true).setMaxLength(1000)))
  .setDMPermission(false);

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'decidir' && !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return replyError(interaction, 'Permiso insuficiente', 'Necesitas **Gestionar servidor**.');
  }
  await interaction.deferReply({ flags: sub === 'crear' || sub === 'ver' ? 64 : undefined });
  try {
    if (sub === 'crear') {
      const appeal = await createAppeal({
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        caseNumber: interaction.options.getInteger('caso'),
        reason: interaction.options.getString('motivo', true)
      });
      return interaction.editReply({ embeds: [successEmbed('Apelacion creada', `Tu apelacion **#${appeal.id}** fue enviada al equipo de moderacion.`)] });
    }
    if (sub === 'ver') {
      const appeals = await getAppeals(interaction.guild.id, { userId: interaction.user.id });
      const embed = baseEmbed().setTitle('📨 Mis apelaciones').setDescription(
        appeals.length ? appeals.map((a) => `**#${a.id}** · \`${a.status}\` · ${timestamp(a.created_at, 'R')}\n> ${a.reason}`).join('\n\n') : 'No tienes apelaciones.'
      );
      return interaction.editReply({ embeds: [embed] });
    }
    const id = interaction.options.getInteger('id', true);
    const status = interaction.options.getString('estado', true);
    const decision = interaction.options.getString('respuesta', true);
    const appeal = await decideAppeal(interaction.guild.id, id, status, interaction.user.id, interaction.user.tag, decision);
    if (!appeal) return replyError(interaction, 'Apelacion no disponible', 'No existe o ya fue resuelta.');
    return interaction.editReply({ embeds: [successEmbed('Apelacion actualizada', `La apelacion **#${id}** fue marcada como **${status}**.`)] });
  } catch (error) {
    return replyError(interaction, 'Error con la apelacion', error.message);
  }
}
