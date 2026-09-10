import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { addStock, getInventoryItem, getPreset } from "../db";
import { isManager } from "../services/permissions";
import { refreshInventory } from "../services/inventoryService";

export const data = new SlashCommandBuilder()
  .setName("addstock")
  .setDescription("Aggiunge materiali/oggetti all'inventario di gilda (solo manager)")
  .addStringOption((opt) =>
    opt
      .setName("nome")
      .setDescription("Nome dell'oggetto (usa lo stesso nome del preset se ne hai uno)")
      .setRequired(true)
      .setMaxLength(100)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("quantita")
      .setDescription("Quanti pezzi aggiungere")
      .setRequired(true)
      .setMinValue(1)
  )
  .addAttachmentOption((opt) =>
    opt.setName("icona").setDescription("Carica un'immagine/screenshot dal tuo PC")
  )
  .addStringOption((opt) =>
    opt
      .setName("icona_url")
      .setDescription("In alternativa: URL diretto dell'immagine")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!isManager(member)) {
    await interaction.reply({
      content: "❌ Non hai il ruolo necessario per usare questo comando.",
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guildId!;
  const name = interaction.options.getString("nome", true).trim();
  const qty = interaction.options.getInteger("quantita", true);
  const attachment = interaction.options.getAttachment("icona");
  const iconUrlOption = interaction.options.getString("icona_url");

  if (attachment && !attachment.contentType?.startsWith("image/")) {
    await interaction.reply({
      content: "❌ Il file allegato non sembra un'immagine.",
      ephemeral: true,
    });
    return;
  }

  // Se non viene fornita un'icona e l'oggetto esiste già in inventario, mantiene quella attuale.
  // Se è la prima volta e non viene fornita nessuna icona, riusa quella di un preset omonimo, se esiste.
  const existing = getInventoryItem(guildId, name);
  const preset = existing ? null : getPreset(guildId, name);
  const iconUrl =
    attachment?.url ?? iconUrlOption?.trim() ?? existing?.icon_url ?? preset?.icon_url ?? null;

  addStock(guildId, name, qty, iconUrl);
  await refreshInventory(interaction.client, guildId);

  await interaction.reply({
    content: `✅ Aggiunti **${qty}x ${name}** all'inventario.`,
    ephemeral: true,
  });
}
