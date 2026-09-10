import "dotenv/config";
import { REST, Routes } from "discord.js";
import fs from "fs";
import path from "path";

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    console.error("❌ DISCORD_TOKEN e CLIENT_ID sono obbligatori nel file .env");
    process.exit(1);
  }

  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((f) => f.endsWith(".js"));

  const body: unknown[] = [];
  for (const file of commandFiles) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const command = require(path.join(commandsPath, file));
    body.push(command.data.toJSON());
  }

  const rest = new REST().setToken(token);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body,
    });
    console.log(
      `✅ Registrati ${body.length} comandi sulla guild ${guildId} (istantaneo).`
    );
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    console.log(
      `✅ Registrati ${body.length} comandi globalmente (propagazione fino a 1h).`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
