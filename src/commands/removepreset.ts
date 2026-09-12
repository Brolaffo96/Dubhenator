import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { deletePreset, getPreset, searchPresets } from "../db";
import { isManager } from "../services/permissions";
import { deleteIconIfLocal } from "../services/iconStorage";

export const data = new SlashCommandBuilder()
  .setName("removepreset")
  .setDescription("Elimina un preset oggetto salvato (solo manager)")
  .addStringOption((opt) =>
    opt
      .setName("nome")
      .setDescription("Nome del preset da eliminare")
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function autocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused();
  const results = searchPresets(interaction.guildId!, focused);
  await interaction.respond(
    results.map((p) => ({ name: p.name, value: p.name }))
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

  const name = interaction.options.getString("nome", true);
  const existing = getPreset(interaction.guildId!, name);
  deletePreset(interaction.guildId!, name);
  deleteIconIfLocal(existing?.icon_url);

  await interaction.reply({
    content: `✅ Preset **${name}** eliminato (se esisteva).`,
    ephemeral: true,
  });
}
