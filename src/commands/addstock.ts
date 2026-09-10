import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { addStock, getPreset, searchPresets } from "../db";
import { isManager } from "../services/permissions";
import { refreshInventory } from "../services/inventoryService";

export const data = new SlashCommandBuilder()
  .setName("addstock")
  .setDescription("Aggiunge materiali all'inventario di gilda (solo manager)")
  .addStringOption((opt) =>
    opt
      .setName("preset")
      .setDescription("Scegli l'oggetto tra i preset salvati (crealo prima con /addpreset se manca)")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("quantita")
      .setDescription("Quanti pezzi aggiungere")
      .setRequired(true)
      .setMinValue(1)
  );

export async function autocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused();
  const results = searchPresets(interaction.guildId!, focused);
  await interaction.respond(
    results.map((p) => ({ name: p.name, value: p.name }))
  );
}

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
  const presetName = interaction.options.getString("preset", true);
  const qty = interaction.options.getInteger("quantita", true);

  // Requisito fondamentale: l'inventario può contenere SOLO oggetti già salvati come preset.
  // Così il nome che finisce in inventario è sempre identico, byte per byte, a quello che
  // /startpoll userà per collegare le poll allo stock — niente più "Mithril Ore" vs
  // "Mithrilore" trattati come due oggetti diversi per un errore di battitura.
  const preset = getPreset(guildId, presetName);
  if (!preset) {
    await interaction.reply({
      content: `❌ Non trovo un preset chiamato **${presetName}**. Crealo prima con \`/addpreset nome:"${presetName}" icona:...\`, poi riprova — così eviti che typo diversi creino voci di inventario separate per lo stesso oggetto.`,
      ephemeral: true,
    });
    return;
  }

  // Usiamo sempre il nome ESATTO salvato nel preset (non quello digitato dall'utente),
  // così eventuali differenze di maiuscole/spazi non creano comunque doppioni.
  addStock(guildId, preset.name, qty, preset.icon_url);
  await refreshInventory(interaction.client, guildId);

  await interaction.reply({
    content: `✅ Aggiunti **${qty}x ${preset.name}** all'inventario.`,
    ephemeral: true,
  });
}
