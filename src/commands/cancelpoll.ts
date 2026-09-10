import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { getActivePollsForGuild, getPollById } from "../db";
import { isManager } from "../services/permissions";
import { cancelPoll } from "../services/pollService";

export const data = new SlashCommandBuilder()
  .setName("cancelpoll")
  .setDescription(
    "Annulla una poll di loot attiva senza estrarre nessun vincitore (solo manager)"
  )
  .addStringOption((opt) =>
    opt
      .setName("poll")
      .setDescription("Quale poll annullare")
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function autocomplete(interaction: AutocompleteInteraction) {
  const polls = getActivePollsForGuild(interaction.guildId!);
  const focused = interaction.options.getFocused().toLowerCase();
  const filtered = polls.filter((p) =>
    p.item_name.toLowerCase().includes(focused)
  );
  await interaction.respond(
    filtered.slice(0, 25).map((p) => ({
      name: `#${p.id} — ${p.item_name} x${p.item_qty} (chiude <t:${Math.floor(
        p.end_at / 1000
      )}:R>)`.slice(0, 100),
      value: String(p.id),
    }))
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

  const pollId = Number(interaction.options.getString("poll", true));
  const poll = getPollById(pollId);

  if (!poll || poll.guild_id !== interaction.guildId || poll.status !== "active") {
    await interaction.reply({
      content: "❌ Questa poll non esiste più o non è più attiva.",
      ephemeral: true,
    });
    return;
  }

  await cancelPoll(interaction.client, poll);

  await interaction.reply({
    content: `✅ Poll #${poll.id} (**${poll.item_name}**) annullata. Nessun vincitore estratto${
      poll.inventory_linked ? ", quantità tornata disponibile in inventario." : "."
    }`,
    ephemeral: true,
  });
}
