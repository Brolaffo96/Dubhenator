import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { updateConfig } from "../db";
import { refreshLeaderboard } from "../services/leaderboardService";

export const data = new SlashCommandBuilder()
  .setName("setleaderboardchannel")
  .setDescription("Imposta il canale dove viene mostrata la classifica punti")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption((opt) =>
    opt
      .setName("canale")
      .setDescription("Canale per la classifica")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel("canale", true);
  // resettiamo l'id messaggio salvato: verrà ricreato nel nuovo canale
  updateConfig(interaction.guildId!, {
    leaderboard_channel_id: channel.id,
    leaderboard_message_id: null,
  });
  await refreshLeaderboard(interaction.client, interaction.guildId!);
  await interaction.reply({
    content: `✅ Canale classifica impostato su <#${channel.id}>.`,
    ephemeral: true,
  });
}
