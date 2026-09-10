import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getPoints } from "../db";

export const data = new SlashCommandBuilder()
  .setName("mypoints")
  .setDescription("Controlla quanti punti loot hai");

export async function execute(interaction: ChatInputCommandInteraction) {
  const points = getPoints(interaction.guildId!, interaction.user.id);
  await interaction.reply({
    content: `Hai attualmente **${points}** punti loot.`,
    ephemeral: true,
  });
}
