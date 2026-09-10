import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { upsertPreset } from "../db";
import { isManager } from "../services/permissions";

export const data = new SlashCommandBuilder()
  .setName("addpreset")
  .setDescription(
    "Salva (o aggiorna) un preset oggetto con nome e icona, da riusare in /startpoll (solo manager)"
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

  const name = interaction.options.getString("nome", true).trim();
  const attachment = interaction.options.getAttachment("icona");
  const iconUrlOption = interaction.options.getString("icona_url");

  if (attachment && !attachment.contentType?.startsWith("image/")) {
    await interaction.reply({
      content: "❌ Il file allegato non sembra un'immagine.",
      ephemeral: true,
    });
    return;
  }

  const iconUrl = attachment?.url ?? iconUrlOption?.trim() ?? null;

  upsertPreset(interaction.guildId!, name, iconUrl);

  await interaction.reply({
    content: `✅ Preset **${name}** salvato${
      iconUrl ? "" : " (senza icona)"
    }. Ora puoi usarlo in \`/startpoll\` selezionandolo dal campo "preset".`,
    ephemeral: true,
  });
}
