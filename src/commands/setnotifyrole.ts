import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { updateConfig } from "../db";

export const data = new SlashCommandBuilder()
  .setName("setnotifyrole")
  .setDescription(
    "Imposta il ruolo da menzionare quando si apre una nuova poll di loot"
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addRoleOption((opt) =>
    opt
      .setName("ruolo")
      .setDescription("Ruolo da menzionare (es. @LootRoll)")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole("ruolo", true);
  updateConfig(interaction.guildId!, { notify_role_id: role.id });
  await interaction.reply({
    content: `✅ Da ora ogni nuova poll menzionerà <@&${role.id}>.`,
    ephemeral: true,
  });
}
