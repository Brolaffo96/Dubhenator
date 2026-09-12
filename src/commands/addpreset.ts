import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { getPreset } from "../db";
import { isManager } from "../services/permissions";
import { applyPresetFields } from "../services/presetService";

export const data = new SlashCommandBuilder()
  .setName("addpreset")
  .setDescription(
    "Salva/aggiorna un preset oggetto: nome, icona, punti e durata (solo manager)"
  )
  .addStringOption((opt) =>
    opt
      .setName("nome")
      .setDescription("Nome dell'oggetto, es: Piuma di Fenice")
      .setRequired(true)
      .setMaxLength(100)
  )
  .addAttachmentOption((opt) =>
    opt
      .setName("icona")
      .setDescription("Carica un'immagine/screenshot dal tuo PC (consigliato)")
  )
  .addStringOption((opt) =>
    opt
      .setName("icona_url")
      .setDescription("In alternativa: URL diretto dell'immagine, se non carichi un file")
  )
  .addIntegerOption((opt) =>
    opt
      .setName("punti_minimi")
      .setDescription("Punti minimi di default per questo oggetto (sovrascrivibile in /startpoll)")
      .setMinValue(0)
  )
  .addNumberOption((opt) =>
    opt
      .setName("durata_ore")
      .setDescription("Durata di default in ore per questo oggetto (sovrascrivibile in /startpoll)")
      .setMinValue(0.1)
  );

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

  // Ricerca case-insensitive: se esiste già un preset scritto con maiuscole/minuscole
  // diverse (es. "Mithril ore" invece di "Mithril Ore"), aggiorniamo quello invece di
  // crearne uno nuovo per errore di battitura.
  const existing = getPreset(guildId, typedName);
  const targetName = existing?.name ?? typedName;

  const result = await applyPresetFields(interaction, guildId, targetName, existing);
  if (!result) return; // errore già inviato da applyPresetFields

  const details = [
    result.iconUrl ? null : "senza icona",
    result.minPoints !== null ? `punti minimi ${result.minPoints}` : null,
    result.durationHours !== null ? `durata ${result.durationHours}h` : null,
  ].filter(Boolean);

  await interaction.reply({
    content: `✅ Preset **${targetName}** salvato${
      details.length ? ` (${details.join(", ")})` : ""
    }. Ora puoi usarlo in \`/startpoll\` selezionandolo dal campo "preset".`,
    ephemeral: true,
  });
}
