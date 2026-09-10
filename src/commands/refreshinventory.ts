import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { refreshInventory } from "../services/inventoryService";

export const data = new SlashCommandBuilder()
  .setName("refreshinventory")
  .setDescription("Forza l'aggiornamento del pannello inventario nel canale configurato");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  await refreshInventory(interaction.client, interaction.guildId!);
  await interaction.editReply("✅ Inventario aggiornato.");
}
