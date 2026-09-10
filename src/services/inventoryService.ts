import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { getConfig, listInventory, updateConfig } from "../db";

const MAX_EMBEDS_PER_MESSAGE = 10;

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
    const shown = items.slice(0, MAX_EMBEDS_PER_MESSAGE);
    embeds = shown.map((it) => {
      const reservedPart = it.reserved > 0 ? ` (${it.reserved} in poll)` : "";
      const embed = new EmbedBuilder()
        .setTitle(it.name)
        .setDescription(`**${it.quantity}** disponibili${reservedPart}`)
        .setColor(0x1abc9c);
      if (it.icon_url) embed.setThumbnail(it.icon_url);
      return embed;
    });

    if (items.length > MAX_EMBEDS_PER_MESSAGE) {
      content = `⚠️ Mostrati solo i primi ${MAX_EMBEDS_PER_MESSAGE} oggetti su ${items.length} (limite Discord: massimo 10 embed per messaggio).`;
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
