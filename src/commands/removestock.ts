import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { removeStock, searchInventory } from "../db";
import { isManager } from "../services/permissions";
import { refreshInventory } from "../services/inventoryService";

export const data = new SlashCommandBuilder()
  .setName("removestock")
  .setDescription(
    "Toglie manualmente materiali dall'inventario disponibile, senza passare da una poll (solo manager)"
  )
  .addStringOption((opt) =>
    opt
      .setName("nome")
      .setDescription("Nome dell'oggetto")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("quantita")
      .setDescription("Quanti pezzi togliere")
      .setRequired(true)
      .setMinValue(1)
  );

export async function autocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused();
  const results = searchInventory(interaction.guildId!, focused);
  await interaction.respond(
    results.map((it) => ({
      name: `${it.name} (${it.quantity} disponibili)`.slice(0, 100),
      value: it.name,
    }))
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
  const name = interaction.options.getString("nome", true).trim();
  const qty = interaction.options.getInteger("quantita", true);

  // Non si può togliere più di quanto sia DISPONIBILE (esclude ciò che è già riservato in poll attive).
  const ok = removeStock(guildId, name, qty);
  if (!ok) {
    await interaction.reply({
      content: `❌ Non ci sono **${qty}x ${name}** disponibili da togliere (potrebbero essere finiti, non esistere, o parte della quantità è già riservata in una poll attiva). Controlla \`/refreshinventory\`.`,
      ephemeral: true,
    });
    return;
  }

  await refreshInventory(interaction.client, guildId);

  await interaction.reply({
    content: `✅ Tolti **${qty}x ${name}** dall'inventario.`,
    ephemeral: true,
  });
}
