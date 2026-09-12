import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { getPreset, searchPresets } from "../db";
import { isManager } from "../services/permissions";
import { applyPresetFields } from "../services/presetService";

export const data = new SlashCommandBuilder()
  .setName("editpreset")
  .setDescription(
    "Modifica un preset esistente, scegliendolo dal menu (solo manager)"
  )
  .addStringOption((opt) =>
    opt
      .setName("nome")
      .setDescription("Scegli il preset da modificare dal menu")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addAttachmentOption((opt) =>
    opt
      .setName("icona")
      .setDescription("Nuova immagine/screenshot dal tuo PC (lascia vuoto per non cambiarla)")
  )
  .addStringOption((opt) =>
    opt
      .setName("icona_url")
      .setDescription("In alternativa: nuovo URL diretto dell'immagine")
  )
  .addIntegerOption((opt) =>
    opt
      .setName("punti_minimi")
      .setDescription("Nuovi punti minimi di default (lascia vuoto per non cambiarli)")
      .setMinValue(0)
  )
  .addNumberOption((opt) =>
    opt
      .setName("durata_ore")
      .setDescription("Nuova durata di default in ore (lascia vuoto per non cambiarla)")
      .setMinValue(0.1)
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

  const guildId = interaction.guildId!;
  const typedName = interaction.options.getString("nome", true).trim();

  // A differenza di /addpreset, qui NON creiamo mai un preset nuovo: se il nome
  // digitato non corrisponde a nessuno esistente (anche a maiuscole/minuscole diverse),
  // rifiutiamo invece di crearne uno per errore.
  const existing = getPreset(guildId, typedName);
  if (!existing) {
    await interaction.reply({
      content: `❌ Non trovo un preset chiamato **${typedName}**. Scegli un nome dal menu che compare mentre scrivi, controlla \`/listpresets\`, oppure usa \`/addpreset\` se vuoi crearne uno nuovo.`,
      ephemeral: true,
    });
    return;
  }

  const result = await applyPresetFields(interaction, guildId, existing.name, existing);
  if (!result) return; // errore già inviato da applyPresetFields

  const details = [
    result.iconUrl ? null : "senza icona",
    result.minPoints !== null ? `punti minimi ${result.minPoints}` : null,
    result.durationHours !== null ? `durata ${result.durationHours}h` : null,
  ].filter(Boolean);

  await interaction.reply({
    content: `✅ Preset **${existing.name}** aggiornato${
      details.length ? ` (${details.join(", ")})` : ""
    }.`,
    ephemeral: true,
  });
}
