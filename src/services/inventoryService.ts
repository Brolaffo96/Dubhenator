import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { getConfig, listInventory, updateConfig } from "../db";

const MAX_DESCRIPTION_CHARS = 3500;
const MAX_EMBEDS_PER_MESSAGE = 10;

function formatLine(it: { name: string; quantity: number; reserved: number }) {
  const reservedPart = it.reserved > 0 ? ` (${it.reserved} in poll)` : "";
  return `🔹 **${it.name}** — ${it.quantity} disponibili${reservedPart}`;
}

export async function refreshInventory(client: Client, guildId: string) {
  const cfg = getConfig(guildId);
  if (!cfg.inventory_channel_id) return;

  const items = listInventory(guildId);

  let embeds: EmbedBuilder[];
  let content: string | undefined;

  if (items.length === 0) {
    embeds = [
      new EmbedBuilder()
        .setTitle("📦 Inventario di gilda")
        .setDescription("Inventario vuoto.")
        .setColor(0x1abc9c),
    ];
  } else {
    // Impacchetta le righe in blocchi di testo sotto il limite di caratteri di una
    // description, poi un embed per blocco (quasi sempre uno solo basta).
    const chunks: string[] = [];
    let current = "";
    for (const it of items) {
      const line = formatLine(it);
      if (current && current.length + 1 + line.length > MAX_DESCRIPTION_CHARS) {
        chunks.push(current);
        current = line;
      } else {
        current = current ? `${current}\n${line}` : line;
      }
    }
    if (current) chunks.push(current);

    const shownChunks = chunks.slice(0, MAX_EMBEDS_PER_MESSAGE);
    embeds = shownChunks.map((description, idx) => {
      const embed = new EmbedBuilder().setColor(0x1abc9c).setDescription(description);
      if (idx === 0) embed.setTitle("📦 Inventario di gilda");
      return embed;
    });

    if (chunks.length > MAX_EMBEDS_PER_MESSAGE) {
      content = `⚠️ Inventario troppo grande per essere mostrato interamente (limite Discord: massimo ${MAX_EMBEDS_PER_MESSAGE} embed per messaggio).`;
    }
  }

  try {
    const channel = (await client.channels.fetch(
      cfg.inventory_channel_id
    )) as TextChannel | null;
    if (!channel) return;

    if (cfg.inventory_message_id) {
      try {
        const msg = await channel.messages.fetch(cfg.inventory_message_id);
        await msg.edit({ content: content ?? "", embeds });
        return;
      } catch {
        // messaggio non più esistente, ne creiamo uno nuovo sotto
      }
    }

    const sent = await channel.send({ content, embeds });
    updateConfig(guildId, { inventory_message_id: sent.id });
  } catch (err) {
    console.error("Errore refreshInventory:", err);
  }
}
