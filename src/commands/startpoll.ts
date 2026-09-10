import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import {
  createPoll,
  getConfig,
  getInventoryItem,
  getPreset,
  reserveStock,
  searchPresets,
} from "../db";
import { isManager } from "../services/permissions";
import { buildPollEmbed } from "../services/pollService";
import { refreshInventory } from "../services/inventoryService";

export const data = new SlashCommandBuilder()
  .setName("startpoll")
  .setDescription("Avvia una nuova poll di assegnazione loot (solo manager)")
  .addIntegerOption((opt) =>
    opt
      .setName("quantita")
      .setDescription("Quantità disponibile")
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption((opt) =>
    opt
      .setName("preset")
      .setDescription("Scegli un preset oggetto salvato (nome + icona precompilati)")
      .setAutocomplete(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("oggetto")
      .setDescription("Nome dell'oggetto (obbligatorio solo se non usi un preset)")
  )
  .addAttachmentOption((opt) =>
    opt
      .setName("icona")
      .setDescription("Carica un'immagine/screenshot (ignorato se usi un preset)")
  )
  .addStringOption((opt) =>
    opt
      .setName("icona_url")
      .setDescription("In alternativa: URL diretto dell'immagine (ignorato se usi un preset)")
  )
  .addIntegerOption((opt) =>
    opt
      .setName("punti_minimi")
      .setDescription("Punti minimi per partecipare (default: quello configurato)")
      .setMinValue(0)
  )
  .addNumberOption((opt) =>
    opt
      .setName("durata_ore")
      .setDescription("Durata della poll in ore (default: quella configurata)")
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
  const cfg = getConfig(guildId);

  if (!cfg.loot_channel_id) {
    await interaction.reply({
      content: "❌ Devi prima impostare il canale loot con `/setlootchannel`.",
      ephemeral: true,
    });
    return;
  }

  const presetName = interaction.options.getString("preset");
  let itemName = interaction.options.getString("oggetto");
  const attachment = interaction.options.getAttachment("icona");
  let iconUrl = attachment?.url ?? interaction.options.getString("icona_url");
  let presetMinPoints: number | null = null;
  let presetDurationHours: number | null = null;

  if (presetName) {
    const preset = getPreset(guildId, presetName);
    if (!preset) {
      await interaction.reply({
        content: `❌ Non trovo un preset chiamato **${presetName}**. Usa \`/listpresets\` per vedere quelli disponibili.`,
        ephemeral: true,
      });
      return;
    }
    itemName = preset.name;
    iconUrl = preset.icon_url;
    presetMinPoints = preset.min_points;
    presetDurationHours = preset.duration_hours;
  }

  if (!itemName) {
    await interaction.reply({
      content:
        "❌ Devi specificare un `preset` oppure il campo `oggetto` con il nome dell'item.",
      ephemeral: true,
    });
    return;
  }

  const qty = interaction.options.getInteger("quantita", true);
  // Priorità: valore esplicito nel comando > valore salvato nel preset > default di gilda
  const minPoints =
    interaction.options.getInteger("punti_minimi") ??
    presetMinPoints ??
    cfg.default_min_points;
  const durationHours =
    interaction.options.getNumber("durata_ore") ??
    presetDurationHours ??
    cfg.default_duration_hours;

  const channel = (await interaction.client.channels.fetch(
    cfg.loot_channel_id
  )) as TextChannel | null;

  if (!channel) {
    await interaction.reply({
      content: "❌ Il canale loot configurato non esiste più.",
      ephemeral: true,
    });
    return;
  }

  // Se esiste una voce di inventario con lo stesso nome, la poll vi si collega:
  // la quantità viene "riservata" (tolta dal disponibile) finché la poll non si
  // conclude (rilasciata se nessuno vince, tolta per sempre al riscatto del premio).
  const inventoryItem = getInventoryItem(guildId, itemName);
  let inventoryLinked = false;
  if (inventoryItem) {
    const reserved = reserveStock(guildId, itemName, qty);
    if (!reserved) {
      await interaction.reply({
        content: `❌ Nell'inventario risultano solo **${inventoryItem.quantity}** ${itemName} disponibili (escluso quanto già in altre poll), non **${qty}**. Controlla \`/addstock\` o riduci la quantità.`,
        ephemeral: true,
      });
      return;
    }
    inventoryLinked = true;
  }

  const endAt = Date.now() + durationHours * 60 * 60 * 1000;
  const embed = buildPollEmbed({
    item_name: itemName,
    item_qty: qty,
    icon_url: iconUrl,
    min_points: minPoints,
    end_at: endAt,
  });

  // Il mention del ruolo va nel "content" del messaggio (fuori dall'embed):
  // i mention dentro un embed NON generano una notifica/ping all'utente.
  const pingContent = cfg.notify_role_id ? `<@&${cfg.notify_role_id}>` : undefined;

  const msg = await channel.send({
    content: pingContent,
    embeds: [embed],
    allowedMentions: { roles: cfg.notify_role_id ? [cfg.notify_role_id] : [] },
  });
  await msg.react(cfg.join_emoji);

  createPoll({
    guild_id: guildId,
    channel_id: channel.id,
    message_id: msg.id,
    item_name: itemName,
    item_qty: qty,
    icon_url: iconUrl,
    min_points: minPoints,
    end_at: endAt,
    inventory_linked: inventoryLinked,
  });

  if (inventoryLinked) {
    await refreshInventory(interaction.client, guildId);
  }

  await interaction.reply({
    content: `✅ Poll avviata in <#${channel.id}> per **${qty}x ${itemName}** (chiude tra ${durationHours}h, minimo ${minPoints} punti).${
      inventoryLinked ? " Quantità riservata dall'inventario." : ""
    }`,
    ephemeral: true,
  });
}
