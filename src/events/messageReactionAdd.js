import { Events, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getSettings } from '../database/db.js';

const APPROVE = '✅';
const REJECT = '❌';
const CLOSE = '🔒';
const VOTE_EMOJIS = new Set([APPROVE, REJECT]);

export const name = Events.MessageReactionAdd;

export async function execute(reaction, user) {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();
    const message = reaction.message;
    if (message.partial) await message.fetch();
    if (!message.guild || !message.embeds.length || !isSuggestion(message)) return;

    const settings = await getSettings(message.guild.id);
    if (message.channel.id !== settings?.suggestion_channel_id) return;

    if (isClosed(message)) {
      await reaction.users.remove(user.id);
      return;
    }

    const emoji = reaction.emoji.name;
    if (emoji === CLOSE) {
      await closeSuggestion(message, reaction, user);
      return;
    }
    if (!VOTE_EMOJIS.has(emoji)) return;

    const otherEmoji = emoji === APPROVE ? REJECT : APPROVE;
    const otherReaction = message.reactions.cache.find((item) => item.emoji.name === otherEmoji);
    if (otherReaction) await otherReaction.users.remove(user.id);

    await updateVoteCounts(message);
  } catch (error) {
    console.error('[messageReactionAdd]', error.message);
  }
}

function isSuggestion(message) {
  return message.embeds[0]?.footer?.text?.startsWith('Sugerencia ·');
}

function isClosed(message) {
  return message.embeds[0]?.footer?.text?.startsWith('🔒 Cerrada ·');
}

async function closeSuggestion(message, reaction, user) {
  const member = await message.guild.members.fetch(user.id).catch(() => null);
  if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await reaction.users.remove(user.id);
    return;
  }

  await message.fetch();
  const embed = new EmbedBuilder(message.embeds[0])
    .setFields(withVoteField(message.embeds[0].fields, getVoteSummary(message)))
    .setFooter({ text: `🔒 Cerrada · ${getVoteSummary(message)} · ${message.embeds[0].footer.text.replace('Sugerencia · ', '')}` });

  await message.edit({ embeds: [embed] });
  await message.reactions.removeAll();
}

async function updateVoteCounts(message) {
  await message.fetch();
  const approve = message.reactions.cache.get(APPROVE)?.count ?? 0;
  const reject = message.reactions.cache.get(REJECT)?.count ?? 0;
  const original = message.embeds[0];
  const fields = withVoteField(
    original.fields,
    `✅ A favor: **${Math.max(0, approve - 1)}**\n❌ En contra: **${Math.max(0, reject - 1)}**`
  );

  const embed = new EmbedBuilder(original).setFields(fields);
  await message.edit({ embeds: [embed] });
}

function getVoteSummary(message) {
  const approve = message.reactions.cache.get(APPROVE)?.count ?? 0;
  const reject = message.reactions.cache.get(REJECT)?.count ?? 0;
  return `✅ ${Math.max(0, approve - 1)} · ❌ ${Math.max(0, reject - 1)}`;
}

function withVoteField(fields = [], value) {
  return [
    ...fields.filter((field) => field.name !== 'Votos'),
    { name: 'Votos', value }
  ];
}
