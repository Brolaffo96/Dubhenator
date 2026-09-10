import "dotenv/config";
import fs from "fs";
import path from "path";
import cron from "node-cron";
import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { registerInteractionCreate, Command } from "./events/interactionCreate";
import { registerReactionAdd } from "./events/reactionAdd";
import { registerReactionRemove } from "./events/reactionRemove";
import { checkAndEndPolls } from "./services/pollService";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("❌ DISCORD_TOKEN mancante nel file .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User, Partials.Channel],
});

// --- Caricamento comandi ---
const commands = new Collection<string, Command>();
const commandsDir = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith(".js"))) {
  const command = require(path.join(commandsDir, file));
  commands.set(command.data.name, command);
}

registerInteractionCreate(client, commands);
registerReactionAdd(client);
registerReactionRemove(client);

client.once("ready", () => {
  console.log(`✅ Loggato come ${client.user?.tag}`);

  // Controlla ogni minuto se ci sono poll scadute da chiudere
  cron.schedule("* * * * *", () => {
    checkAndEndPolls(client).catch((err) =>
      console.error("Errore checkAndEndPolls:", err)
    );
  });
});

client.login(token);
