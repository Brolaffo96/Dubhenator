import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { updateConfig } from "../db";

export const data = new SlashCommandBuilder()
  .setName("setlootchannel")
  .setDescription("Imposta il canale dove verranno pubblicate le poll di loot")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption((opt) =>
    opt
      .setName("canale")
      .setDescription("Canale per le poll di loot")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel("canale", true);
  updateConfig(interaction.guildId!, { loot_channel_id: channel.id });
  await interaction.reply({
    content: `✅ Canale loot impostato su <#${channel.id}>.`,
    ephemeral: true,
  });
}
