import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { getConfig, getLeaderboard, updateConfig } from "../db";

export async function refreshLeaderboard(client: Client, guildId: string) {
  const cfg = getConfig(guildId);
  if (!cfg.leaderboard_channel_id) return;

  const rows = getLeaderboard(guildId);

  const medals = ["🥇", "🥈", "🥉"];
  const lines = rows.length
    ? rows.map((r, i) => {
        const prefix = medals[i] ?? `${i + 1}.`;
        return `${prefix} <@${r.user_id}> — **${r.points}** punti`;
      })
    : ["Nessun partecipante ha ancora punti."];

  const embed = new EmbedBuilder()
    .setTitle("🏆 Classifica punti loot")
    .setDescription(lines.join("\n"))
    .setColor(0xf1c40f)
    .setTimestamp(new Date());

  try {
    const channel = (await client.channels.fetch(
      cfg.leaderboard_channel_id
    )) as TextChannel | null;
    if (!channel) return;

    if (cfg.leaderboard_message_id) {
      try {
        const msg = await channel.messages.fetch(cfg.leaderboard_message_id);
        await msg.edit({ embeds: [embed] });
        return;
      } catch {
        // il messaggio non esiste più, ne creiamo uno nuovo sotto
      }
    }

    const sent = await channel.send({ embeds: [embed] });
    updateConfig(guildId, { leaderboard_message_id: sent.id });
  } catch (err) {
    console.error("Errore refreshLeaderboard:", err);
  }
}
