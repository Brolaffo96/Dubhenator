import {
  Client,
  Events,
  GuildMember,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from "discord.js";
import {
  addParticipant,
  getConfig,
  getPoints,
  getPollByMessageId,
  getWinnerByAnnounceMessageId,
  markRedeemed,
} from "../db";
import { isManager } from "../services/permissions";

async function resolvePartials(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) {
  if (reaction.partial) reaction = await reaction.fetch();
  if (user.partial) user = await user.fetch();
  return { reaction: reaction as MessageReaction, user: user as User };
}

export function registerReactionAdd(client: Client) {
  client.on(
    Events.MessageReactionAdd,
    async (rawReaction, rawUser) => {
      if (rawUser.bot) return;

      let reaction: MessageReaction, user: User;
      try {
        ({ reaction, user } = await resolvePartials(rawReaction, rawUser));
      } catch (err) {
        console.error("Errore fetch reazione partial:", err);
        return;
      }

      const message = reaction.message;
      if (!message.guildId) return;
      const guildId = message.guildId;
      const cfg = getConfig(guildId);
      const emoji = reaction.emoji.name;

      // --- Caso 1: iscrizione a una poll di loot ---
      if (emoji === cfg.join_emoji) {
        const poll = getPollByMessageId(message.id);
        if (!poll) return; // reazione su un messaggio qualsiasi, ignora

        const userPoints = getPoints(guildId, user.id);
        if (userPoints < poll.min_points) {
          // punti insufficienti: rimuoviamo la reaction e avvisiamo in DM
          try {
            await reaction.users.remove(user.id);
          } catch (err) {
            console.error("Impossibile rimuovere la reazione:", err);
          }
          try {
            await user.send(
              `❌ Non hai abbastanza punti per partecipare al loot roll per **${poll.item_name}**. ` +
                `Servono almeno **${poll.min_points}** punti, tu ne hai **${userPoints}**.`
            );
          } catch {
            // l'utente potrebbe avere i DM chiusi, ignoriamo
          }
          return;
        }

        addParticipant(poll.id, user.id);
        return;
      }

      // --- Caso 2: riscatto premio da parte di un manager ---
      if (emoji === cfg.redeem_emoji) {
        const winner = getWinnerByAnnounceMessageId(message.id);
        if (!winner) return;

        let member: GuildMember | null = null;
        try {
          member = await message.guild!.members.fetch(user.id);
        } catch {
          /* ignore */
        }

        if (!member || !isManager(member)) {
          try {
            await reaction.users.remove(user.id);
          } catch {
            /* ignore */
          }
          return;
        }

        markRedeemed(winner.poll_id);
        try {
          await message.delete();
        } catch {
          /* già cancellato */
        }
        return;
      }
    }
  );
}
