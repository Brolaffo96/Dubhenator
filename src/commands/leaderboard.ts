import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { refreshLeaderboard } from "../services/leaderboardService";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Forza l'aggiornamento della classifica punti nel canale configurato");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  await refreshLeaderboard(interaction.client, interaction.guildId!);
  await interaction.editReply("✅ Classifica aggiornata.");
}
