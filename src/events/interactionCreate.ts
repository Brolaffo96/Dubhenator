import { Client, Collection, Events, Interaction } from "discord.js";

export interface Command {
  data: { name: string; toJSON: () => unknown };
  execute: (interaction: any) => Promise<void>;
  autocomplete?: (interaction: any) => Promise<void>;
}

export function registerInteractionCreate(
  client: Client,
  commands: Collection<string, Command>
) {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error(
          `Errore autocomplete /${interaction.commandName}:`,
          err
        );
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Errore eseguendo /${interaction.commandName}:`, err);
      const payload = {
        content: "❌ Si è verificato un errore eseguendo il comando.",
        ephemeral: true,
      };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  });
}
