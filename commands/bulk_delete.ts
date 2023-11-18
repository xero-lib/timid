import { SlashCommandBuilder, Interaction } from "discord.js";

/* Slash Command Placeholder */
export default new SlashCommandBuilder()
    .setName("delete_bulk")
    .setDescription("Deletes last N messages in the current channel.");

export const execute = async (interaction: Interaction) => {
    if (interaction.isRepliable()) {
        interaction.reply({ content: "Interaction Response!", ephemeral: true });
    }
}