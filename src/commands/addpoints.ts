import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { addPoints } from "../db";
import { isManager } from "../services/permissions";
import { refreshLeaderboard } from "../services/leaderboardService";

export const data = new SlashCommandBuilder()
  .setName("addpoints")
  .setDescription("Assegna punti loot ai partecipanti di una run (solo manager)")
  .addIntegerOption((opt) =>
    opt
      .setName("punti")
      .setDescription("Quanti punti assegnare a ciascun partecipante")
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption((opt) =>
    opt
      .setName("partecipanti")
      .setDescription("Menziona tutti i partecipanti, es: @Tizio @Caio @Sempronio")
      .setRequired(true)
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

  const amount = interaction.options.getInteger("punti", true);
  const raw = interaction.options.getString("partecipanti", true);

  const userIds = [...raw.matchAll(/<@!?(\d+)>/g)].map((m) => m[1]);
  const uniqueIds = [...new Set(userIds)];

  if (uniqueIds.length === 0) {
    await interaction.reply({
      content:
        "❌ Non ho trovato nessuna menzione valida. Usa @nome per taggare i partecipanti.",
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guildId!;
  for (const userId of uniqueIds) {
    addPoints(guildId, userId, amount);
  }

  await refreshLeaderboard(interaction.client, guildId);

  await interaction.reply({
    content: `✅ Aggiunti **${amount}** punti a: ${uniqueIds
      .map((id) => `<@${id}>`)
      .join(", ")}`,
    // Mostra i tag come testo/link ma senza generare una notifica agli utenti citati.
    allowedMentions: { users: [] },
  });
}
