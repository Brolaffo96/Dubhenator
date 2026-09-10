import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { updateConfig } from "../db";
import { isManager } from "../services/permissions";

export const data = new SlashCommandBuilder()
  .setName("setdefaults")
  .setDescription("Imposta i valori di default per le nuove poll di loot (solo manager)")
  .addIntegerOption((opt) =>
    opt
      .setName("punti_minimi")
      .setDescription("Punti minimi di default richiesti per partecipare")
      .setMinValue(0)
  )
  .addNumberOption((opt) =>
    opt
      .setName("durata_ore")
      .setDescription("Durata di default della poll in ore")
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

  const minPoints = interaction.options.getInteger("punti_minimi");
  const durationHours = interaction.options.getNumber("durata_ore");

  if (minPoints === null && durationHours === null) {
    await interaction.reply({
      content: "❌ Specifica almeno un valore da aggiornare.",
      ephemeral: true,
    });
    return;
  }

  const fields: Record<string, number> = {};
  if (minPoints !== null) fields.default_min_points = minPoints;
  if (durationHours !== null) fields.default_duration_hours = durationHours;

  updateConfig(interaction.guildId!, fields);

  await interaction.reply({
    content: `✅ Default aggiornati.${
      minPoints !== null ? ` Punti minimi: **${minPoints}**.` : ""
    }${durationHours !== null ? ` Durata: **${durationHours}h**.` : ""}`,
    ephemeral: true,
  });
}
