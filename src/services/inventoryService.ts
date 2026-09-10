import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { getConfig, listInventory, updateConfig } from "../db";

const FIELDS_PER_EMBED = 25;
const MAX_EMBEDS_PER_MESSAGE = 10;
const MAX_ITEMS = FIELDS_PER_EMBED * MAX_EMBEDS_PER_MESSAGE;

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
    const shown = items.slice(0, MAX_ITEMS);
    const chunks: (typeof shown)[] = [];
    for (let i = 0; i < shown.length; i += FIELDS_PER_EMBED) {
      chunks.push(shown.slice(i, i + FIELDS_PER_EMBED));
    }

    embeds = chunks.map((chunk, idx) => {
      const embed = new EmbedBuilder().setColor(0x1abc9c);
      if (idx === 0) embed.setTitle("📦 Inventario di gilda");
      embed.addFields(
        chunk.map((it) => {
          const reservedPart = it.reserved > 0 ? ` (${it.reserved} in poll)` : "";
          return {
            name: it.name,
            value: `**${it.quantity}** disponibili${reservedPart}`,
            inline: true,
          };
        })
      );
      return embed;
    });

    if (items.length > MAX_ITEMS) {
      content = `⚠️ Mostrati solo i primi ${MAX_ITEMS} oggetti su ${items.length} (limite Discord: massimo ${FIELDS_PER_EMBED} campi per embed, ${MAX_EMBEDS_PER_MESSAGE} embed per messaggio).`;
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
