import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { removePoints } from "../db";
import { isManager } from "../services/permissions";
import { refreshLeaderboard } from "../services/leaderboardService";

export const data = new SlashCommandBuilder()
  .setName("removepoints")
  .setDescription(
    "Toglie punti loot a uno o più utenti manualmente, per casi eccezionali (solo manager)"
  )
  .addIntegerOption((opt) =>
    opt
      .setName("punti")
      .setDescription("Quanti punti togliere a ciascun utente")
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption((opt) =>
    opt
      .setName("utenti")
      .setDescription("Menziona tutti gli utenti, es: @Tizio @Caio @Sempronio")
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
  const raw = interaction.options.getString("utenti", true);

  const userIds = [...raw.matchAll(/<@!?(\d+)>/g)].map((m) => m[1]);
  const uniqueIds = [...new Set(userIds)];

  if (uniqueIds.length === 0) {
    await interaction.reply({
      content:
        "❌ Non ho trovato nessuna menzione valida. Usa @nome per taggare gli utenti.",
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guildId!;
  for (const userId of uniqueIds) {
    removePoints(guildId, userId, amount);
  }

  await refreshLeaderboard(interaction.client, guildId);

  await interaction.reply({
    content: `✅ Tolti **${amount}** punti a: ${uniqueIds
      .map((id) => `<@${id}>`)
      .join(", ")}`,
  });
}
