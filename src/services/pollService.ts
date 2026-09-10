import { Client, EmbedBuilder, TextChannel } from "discord.js";
import {
  PollRow,
  getConfig,
  getExpiredActivePolls,
  getParticipants,
  getPoints,
  releaseStock,
  removePoints,
  saveWinner,
  setPollStatus,
} from "../db";
import { refreshLeaderboard } from "./leaderboardService";
import { refreshInventory } from "./inventoryService";

export function buildPollEmbed(poll: {
  item_name: string;
  item_qty: number;
  icon_url: string | null;
  min_points: number;
  end_at: number;
}) {
  const embed = new EmbedBuilder()
    .setTitle(`🎁 Loot roll: ${poll.item_name}`)
    .setDescription(
      [
        `**Quantità:** ${poll.item_qty}`,
        `**Punti minimi richiesti:** ${poll.min_points}`,
        `**Chiusura:** <t:${Math.floor(poll.end_at / 1000)}:R> (<t:${Math.floor(
          poll.end_at / 1000
        )}:F>)`,
        "",
        "Reagisci a questo messaggio per iscriverti. Le tue chance di vincere sono proporzionali ai punti che hai in classifica al momento della chiusura — devi avere almeno i punti minimi anche in quel momento, non solo ora.",
      ].join("\n")
    )
    .setColor(0x3498db);

  if (poll.icon_url) embed.setThumbnail(poll.icon_url);
  return embed;
}

/**
 * Estrazione pesata: ogni partecipante ha probabilità proporzionale ai suoi punti attuali.
 */
function weightedPick(
  weights: { userId: string; points: number }[]
): { userId: string; points: number } {
  const total = weights.reduce((s, w) => s + w.points, 0);

  // Se per qualche motivo tutti hanno 0 punti attuali, fallback a estrazione equa
  if (total <= 0) {
    return weights[Math.floor(Math.random() * weights.length)];
  }

  let roll = Math.random() * total;
  for (const w of weights) {
    roll -= w.points;
    if (roll <= 0) return w;
  }
  return weights[weights.length - 1];
}

export async function checkAndEndPolls(client: Client) {
  const expired = getExpiredActivePolls();
  for (const poll of expired) {
    await endPoll(client, poll);
  }
}

async function closeWithNoWinner(
  client: Client,
  poll: PollRow,
  channel: TextChannel | null,
  reason: string
) {
  setPollStatus(poll.id, "ended");
  if (poll.inventory_linked) {
    releaseStock(poll.guild_id, poll.item_name, poll.item_qty);
    await refreshInventory(client, poll.guild_id);
  }
  if (channel) {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🎁 Loot roll chiuso: ${poll.item_name}`)
          .setDescription(reason)
          .setColor(0x95a5a6),
      ],
    });
  }
}

/**
 * Chiude una poll (per scadenza naturale o forzata manualmente) ed estrae il vincitore.
 * Esclude dall'estrazione chi, AL MOMENTO DELLA CHIUSURA, non ha più almeno i punti minimi
 * richiesti (es. li ha già spesi vincendo un'altra poll conclusa poco prima) — evita che
 * qualcuno possa "vincere" più premi di quanti i suoi punti coprano davvero.
 */
export async function endPoll(client: Client, poll: PollRow) {
  try {
    const channel = (await client.channels.fetch(
      poll.channel_id
    )) as TextChannel | null;

    const participantIds = getParticipants(poll.id);

    // Cancella sempre il messaggio di iscrizione, poll chiusa
    if (channel) {
      try {
        const regMsg = await channel.messages.fetch(poll.message_id);
        await regMsg.delete();
      } catch {
        /* già cancellato o non trovato, ignora */
      }
    }

    if (participantIds.length === 0) {
      await closeWithNoWinner(
        client,
        poll,
        channel,
        "Nessun partecipante si è iscritto: nessun vincitore."
      );
      return;
    }

    // IMPORTANTE: punti attuali, presi ORA (possono essere cambiati da altre poll concluse nel frattempo)
    const allWeights = participantIds.map((userId) => ({
      userId,
      points: getPoints(poll.guild_id, userId),
    }));

    // Solo chi ha ancora almeno il minimo richiesto può essere estratto
    const eligible = allWeights.filter((w) => w.points >= poll.min_points);

    if (eligible.length === 0) {
      await closeWithNoWinner(
        client,
        poll,
        channel,
        "Nessuno degli iscritti aveva più punti sufficienti al momento della chiusura (probabilmente spesi vincendo altre poll nel frattempo): nessun vincitore."
      );
      return;
    }

    const winner = weightedPick(eligible);
    const total = eligible.reduce((s, w) => s + w.points, 0);

    // Sottrae al vincitore i punti "costo" della poll (non scende sotto 0)
    removePoints(poll.guild_id, winner.userId, poll.min_points);

    setPollStatus(poll.id, "ended");

    if (channel) {
      const participantsDesc = eligible
        .map((w) => {
          const pct =
            total > 0
              ? ((w.points / total) * 100).toFixed(1)
              : (100 / eligible.length).toFixed(1);
          const crown = w.userId === winner.userId ? " 👑" : "";
          return `<@${w.userId}> — ${w.points} punti (${pct}%)${crown}`;
        })
        .join("\n");

      const excludedIds = allWeights
        .filter((w) => w.points < poll.min_points)
        .map((w) => w.userId);

      const announceEmbed = new EmbedBuilder()
        .setTitle(`🎉 Vincitore: ${poll.item_name}`)
        .setDescription(
          [
            `Congratulazioni <@${winner.userId}>!`,
            `Ha vinto **${poll.item_qty}x ${poll.item_name}** (costo: ${poll.min_points} punti, ora detratti).`,
            "",
            "**Partecipanti e chance:**",
            participantsDesc,
            ...(excludedIds.length > 0
              ? [
                  "",
                  `*Esclusi per punti insufficienti al momento della chiusura: ${excludedIds
                    .map((id) => `<@${id}>`)
                    .join(", ")}*`,
                ]
              : []),
            "",
            `Un manager deve reagire con l'emoji sotto quando il premio è stato consegnato, per archiviare questo messaggio.`,
          ].join("\n")
        )
        .setColor(0x2ecc71);

      if (poll.icon_url) announceEmbed.setThumbnail(poll.icon_url);

      // Il mention del vincitore va nel "content", fuori dall'embed: i mention dentro
      // un embed non generano notifica/ping, solo un link cliccabile senza avviso.
      const announceMsg = await channel.send({
        content: `🎉 <@${winner.userId}>`,
        embeds: [announceEmbed],
        allowedMentions: { users: [winner.userId] },
      });
      const cfg = getConfig(poll.guild_id);
      await announceMsg.react(cfg.redeem_emoji);

      saveWinner(poll.id, winner.userId, channel.id, announceMsg.id);
      // Nota: se la poll era collegata all'inventario, la quantità resta "riservata"
      // finché un manager non conferma la consegna con l'emoji di riscatto — a quel
      // punto viene tolta definitivamente (vedi reactionAdd.ts).
    }

    await refreshLeaderboard(client, poll.guild_id);
  } catch (err) {
    console.error(`Errore chiudendo la poll ${poll.id}:`, err);
  }
}

/**
 * Annulla una poll attiva manualmente (es. creata per errore): nessun vincitore,
 * il messaggio di iscrizione viene cancellato ed eventuale scorta riservata torna disponibile.
 */
export async function cancelPoll(client: Client, poll: PollRow) {
  const channel = (await client.channels
    .fetch(poll.channel_id)
    .catch(() => null)) as TextChannel | null;

  if (channel) {
    try {
      const regMsg = await channel.messages.fetch(poll.message_id);
      await regMsg.delete();
    } catch {
      /* già cancellato o non trovato, ignora */
    }
  }

  setPollStatus(poll.id, "cancelled");

  if (poll.inventory_linked) {
    releaseStock(poll.guild_id, poll.item_name, poll.item_qty);
    await refreshInventory(client, poll.guild_id);
  }
}
