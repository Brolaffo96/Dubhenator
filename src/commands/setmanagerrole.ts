import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { updateConfig } from "../db";

export const data = new SlashCommandBuilder()
  .setName("setmanagerrole")
  .setDescription("Imposta il ruolo che può assegnare punti e avviare le poll di loot")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addRoleOption((opt) =>
    opt.setName("ruolo").setDescription("Il ruolo manager").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole("ruolo", true);
  updateConfig(interaction.guildId!, { manager_role_id: role.id });
  await interaction.reply({
    content: `✅ Ruolo manager impostato su <@&${role.id}>.`,
    ephemeral: true,
  });
}
