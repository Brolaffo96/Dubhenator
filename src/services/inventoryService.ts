import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { getConfig, listInventory, updateConfig } from "../db";

export async function refreshInventory(client: Client, guildId: string) {
  const cfg = getConfig(guildId);
  if (!cfg.inventory_channel_id) return;

  const items = listInventory(guildId);

  const lines = items.length
    ? items.map((it) => {
        const reservedPart = it.reserved > 0 ? ` (${it.reserved} in poll)` : "";
        return `• **${it.name}** — ${it.quantity} disponibili${reservedPart}`;
      })
    : ["Inventario vuoto."];

  const embed = new EmbedBuilder()
    .setTitle("📦 Inventario di gilda")
    .setDescription(lines.join("\n"))
    .setColor(0x1abc9c)
    .setTimestamp(new Date());

  try {
    const channel = (await client.channels.fetch(
      cfg.inventory_channel_id
    )) as TextChannel | null;
    if (!channel) return;

    if (cfg.inventory_message_id) {
      try {
        const msg = await channel.messages.fetch(cfg.inventory_message_id);
        await msg.edit({ embeds: [embed] });
        return;
      } catch {
        // messaggio non più esistente, ne creiamo uno nuovo sotto
      }
    }

    const sent = await channel.send({ embeds: [embed] });
    updateConfig(guildId, { inventory_message_id: sent.id });
  } catch (err) {
    console.error("Errore refreshInventory:", err);
  }
}
