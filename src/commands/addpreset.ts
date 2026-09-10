import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { getPreset, upsertPreset } from "../db";
import { isManager } from "../services/permissions";

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
  const name = interaction.options.getString("nome", true).trim();
  const attachment = interaction.options.getAttachment("icona");
  const iconUrlOption = interaction.options.getString("icona_url");
  const minPointsOption = interaction.options.getInteger("punti_minimi");
  const durationHoursOption = interaction.options.getNumber("durata_ore");

  if (attachment && !attachment.contentType?.startsWith("image/")) {
    await interaction.reply({
      content: "❌ Il file allegato non sembra un'immagine.",
      ephemeral: true,
    });
    return;
  }

  // Se il preset esiste già e questo comando non specifica un campo, mantieni il valore
  // precedente invece di azzerarlo (utile per aggiornare solo l'icona senza toccare il resto).
  const existing = getPreset(guildId, name);
  const iconUrl = attachment?.url ?? iconUrlOption?.trim() ?? existing?.icon_url ?? null;
  const minPoints = minPointsOption ?? existing?.min_points ?? null;
  const durationHours = durationHoursOption ?? existing?.duration_hours ?? null;

  upsertPreset(guildId, name, iconUrl, minPoints, durationHours);

  const details = [
    iconUrl ? null : "senza icona",
    minPoints !== null ? `punti minimi ${minPoints}` : null,
    durationHours !== null ? `durata ${durationHours}h` : null,
  ].filter(Boolean);

  await interaction.reply({
    content: `✅ Preset **${name}** salvato${
      details.length ? ` (${details.join(", ")})` : ""
    }. Ora puoi usarlo in \`/startpoll\` selezionandolo dal campo "preset".`,
    ephemeral: true,
  });
}
