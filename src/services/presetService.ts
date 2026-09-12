import { ChatInputCommandInteraction } from "discord.js";
import { ItemPreset, upsertPreset } from "../db";
import { deleteIconIfLocal, downloadIcon } from "./iconStorage";

export interface PresetFieldsResult {
  iconUrl: string | null;
  minPoints: number | null;
  durationHours: number | null;
}

/**
 * Legge le opzioni icona/punti minimi/durata dall'interazione e salva il preset
 * `targetName` (che deve già essere il nome esatto/originale, non quello digitato
 * dall'utente se stiamo aggiornando un preset esistente con una scrittura diversa).
 * I campi non specificati mantengono il valore di `existing`. Ritorna null se ha già
 * risposto con un errore (allegato non valido o download fallito).
 */
export async function applyPresetFields(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  targetName: string,
  existing: ItemPreset | undefined
): Promise<PresetFieldsResult | null> {
  const attachment = interaction.options.getAttachment("icona");
  const iconUrlOption = interaction.options.getString("icona_url");
  const minPointsOption = interaction.options.getInteger("punti_minimi");
  const durationHoursOption = interaction.options.getNumber("durata_ore");

  if (attachment && !attachment.contentType?.startsWith("image/")) {
    await interaction.reply({
      content: "❌ Il file allegato non sembra un'immagine.",
      ephemeral: true,
    });
    return null;
  }

  let iconUrl: string | null;
  if (attachment) {
    // Scarichiamo subito il file: l'URL che Discord dà per un allegato ha una firma
    // con scadenza, non può essere salvato così com'è nel database a lungo termine.
    try {
      iconUrl = await downloadIcon(attachment.url, guildId, targetName);
    } catch (err) {
      console.error("Errore scaricando l'icona del preset:", err);
      await interaction.reply({
        content: "❌ Non sono riuscito a scaricare l'icona allegata. Riprova.",
        ephemeral: true,
      });
      return null;
    }
  } else {
    iconUrl = iconUrlOption?.trim() ?? existing?.icon_url ?? null;
  }

  // Se stiamo sostituendo un'icona locale precedente con una diversa, elimina il file
  // vecchio per non accumulare file orfani sul disco.
  if (existing?.icon_url && existing.icon_url !== iconUrl) {
    deleteIconIfLocal(existing.icon_url);
  }

  const minPoints = minPointsOption ?? existing?.min_points ?? null;
  const durationHours = durationHoursOption ?? existing?.duration_hours ?? null;

  upsertPreset(guildId, targetName, iconUrl, minPoints, durationHours);

  return { iconUrl, minPoints, durationHours };
}
