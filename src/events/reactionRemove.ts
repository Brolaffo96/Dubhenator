import {
  Client,
  Events,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from "discord.js";
import { getConfig, getPollByMessageId, removeParticipant } from "../db";

async function resolvePartials(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) {
  if (reaction.partial) reaction = await reaction.fetch();
  if (user.partial) user = await user.fetch();
  return { reaction: reaction as MessageReaction, user: user as User };
}

export function registerReactionRemove(client: Client) {
  client.on(Events.MessageReactionRemove, async (rawReaction, rawUser) => {
    if (rawUser.bot) return;

    let reaction: MessageReaction, user: User;
    try {
      ({ reaction, user } = await resolvePartials(rawReaction, rawUser));
    } catch (err) {
      console.error("Errore fetch reazione partial (remove):", err);
      return;
    }

    const message = reaction.message;
    if (!message.guildId) return;
    const cfg = getConfig(message.guildId);

    if (reaction.emoji.name !== cfg.join_emoji) return;

    const poll = getPollByMessageId(message.id);
    if (!poll) return;

    // L'utente ha tolto la sua reaction: si ritira volontariamente dalla poll
    removeParticipant(poll.id, user.id);
  });
}
