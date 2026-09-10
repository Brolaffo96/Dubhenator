import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { updateConfig } from "../db";
import { refreshInventory } from "../services/inventoryService";

export const data = new SlashCommandBuilder()
  .setName("setinventorychannel")
  .setDescription("Imposta il canale dove viene mostrato l'inventario di gilda")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption((opt) =>
    opt
      .setName("canale")
      .setDescription("Canale per l'inventario")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel("canale", true);
  // resettiamo l'id messaggio salvato: verrà ricreato nel nuovo canale
  updateConfig(interaction.guildId!, {
    inventory_channel_id: channel.id,
    inventory_message_id: null,
  });
  await refreshInventory(interaction.client, interaction.guildId!);
  await interaction.reply({
    content: `✅ Canale inventario impostato su <#${channel.id}>.`,
    ephemeral: true,
  });
}
