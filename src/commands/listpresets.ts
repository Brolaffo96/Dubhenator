import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { listPresets } from "../db";

export const data = new SlashCommandBuilder()
  .setName("listpresets")
  .setDescription("Mostra tutti i preset oggetto salvati");

export async function execute(interaction: ChatInputCommandInteraction) {
  const presets = listPresets(interaction.guildId!);

  if (presets.length === 0) {
    await interaction.reply({
      content: "Nessun preset salvato. Creane uno con `/addpreset`.",
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("📦 Preset oggetto salvati")
    .setDescription(presets.map((p) => `• **${p.name}**`).join("\n"))
    .setColor(0x9b59b6);

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
