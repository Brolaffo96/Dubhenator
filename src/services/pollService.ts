import { Client, EmbedBuilder, TextChannel } from "discord.js";
import {
  PollRow,
  getConfig,
  getExpiredActivePolls,
  getParticipants,
  getPoints,
  removePoints,
  saveWinner,
  setPollStatus,
} from "../db";
import { refreshLeaderboard } from "./leaderboardService";

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
        "Reagisci a questo messaggio per iscriverti. Le tue chance di vincere sono proporzionali ai punti che hai in classifica.",
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

async function endPoll(client: Client, poll: PollRow) {
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
      setPollStatus(poll.id, "ended");
      if (channel) {
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`🎁 Loot roll chiuso: ${poll.item_name}`)
              .setDescription("Nessun partecipante si è iscritto: nessun vincitore.")
              .setColor(0x95a5a6),
          ],
        });
      }
      return;
    }

    // IMPORTANTE: punti attuali, presi ORA (possono essere cambiati da altre poll concluse nel frattempo)
    const weights = participantIds.map((userId) => ({
      userId,
      points: getPoints(poll.guild_id, userId),
    }));

    const winner = weightedPick(weights);
    const total = weights.reduce((s, w) => s + w.points, 0);

    // Sottrae al vincitore i punti "costo" della poll (non scende sotto 0)
    removePoints(poll.guild_id, winner.userId, poll.min_points);

    setPollStatus(poll.id, "ended");

    if (channel) {
      const participantsDesc = weights
        .map((w) => {
          const pct = total > 0 ? ((w.points / total) * 100).toFixed(1) : (100 / weights.length).toFixed(1);
          const crown = w.userId === winner.userId ? " 👑" : "";
          return `<@${w.userId}> — ${w.points} punti (${pct}%)${crown}`;
        })
        .join("\n");

      const announceEmbed = new EmbedBuilder()
        .setTitle(`🎉 Vincitore: ${poll.item_name}`)
        .setDescription(
          [
            `Congratulazioni <@${winner.userId}>!`,
            `Ha vinto **${poll.item_qty}x ${poll.item_name}** (costo: ${poll.min_points} punti, ora detratti).`,
            "",
            "**Partecipanti e chance:**",
            participantsDesc,
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
    }

    await refreshLeaderboard(client, poll.guild_id);
  } catch (err) {
    console.error(`Errore chiudendo la poll ${poll.id}:`, err);
  }
}
