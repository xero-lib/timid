import { ChannelType, Client,IntentsBitField, MessageReaction, SlashCommandBuilder, User } from "discord.js";

require("dotenv").config();

const client = new Client({ intents: [
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildModeration,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.Guilds
] });

await client.login(process.env.TOKEN);


// for use in future with slash commands
// let commands = new Map<string, Command>();
// import data, { execute } from "./commands/bulk_delete";

class Command { // probably more efficient as an interface, but might not cooperate with Map
    data: SlashCommandBuilder;
    execute: Function;

    constructor(data: SlashCommandBuilder, execute: Function) {
        this.data = data;
        this.execute = execute;
    }
}

const collectorFilter = (reaction: MessageReaction, user: User) => {
    const member = reaction.message.guild?.members.cache.get(user.id);
    if (!member) return false;
    return (["✅", "❌"].includes(reaction.emoji.name ?? "UNAVAILABLE") && member.permissions.has("Administrator") && user.id != client.user?.id) ?? false;
}

client.on("ready", () => console.log("Online."));

client.on("messageCreate", async (message) => {
    if (message.channel.type != ChannelType.GuildText || !message.content.startsWith("!/") || message.author.bot) return;
    const command = message.content.split(/!\//)[1];
    if (command.length == 0) return;
    const args = command.split(' ');

    if (!message.member?.permissions.has("Administrator")) {
        message.reply("You do not have permission to use this command.");
        return;
    }

    if (args[0].trim() == "bulk_delete_to_id" && /^\d+$/.test(args[1])) {
        await message.channel.messages.fetch(args[1]).then(async (m) => {
            if (message.channel.type != ChannelType.GuildText) return;

            // bulk delete as many as possible
            let m_remaining = false;
            do {
                let messages = await message.channel.messages.fetch({ after: m.id, before: message.id, limit: 99 });
                if (messages.size == 0) return;
                m_remaining = (await message.channel.bulkDelete(messages, true)).size != messages.size;
            }  while (!m_remaining);

            while (true) {
                let messages = await message.channel.messages.fetch({ after: m.id, before: message.id, limit: 99 });
                if (messages.size == 0) break;
                for (let [id, m] of messages) {
                    if (!m.deletable) {
                        console.log(id, m.content);
                    }
                    await m.delete();
                }
                console.log("removed", messages.size);
            }
            message.reply("Bulk delete complete.");
        }).catch(() => {
            if (message.channel.type != ChannelType.GuildText) return;
            message.reply(`Unable to find message with the ID \`${args[1]}\` in ${message.channel.name}`);
        });

        return;
    }

    // bulk delete (often inaccurate)
    if (args[0].trim() == "bulk_delete" && /^\d+$/.test(args[1])) {
        let reply = await message.reply(`Are you sure you want to purge the last ${args[1] != '1' ? `${args[1]} messages` : 'message'} from ${message.channel.name}?`);
        reply.react("✅").then(() => reply.react("❌"));
        reply.awaitReactions({ filter: collectorFilter, max: 1, time: 30000, errors: ['time'] })
            .then( async (collected) => {
                const reaction = collected.first();
                // have to check if is guild text again to appease the type gods
                if (reaction?.emoji.name === "✅" && message.channel.type == ChannelType.GuildText) {
                    let total = 2 + +args[1];
                    try {
                        while (total >= 100) {
                            let removed = (await message.channel.bulkDelete(99, true)).size;
                            total -= removed;
                            if (removed < 99) {
                                throw new Error("2 week limit reached");
                            }
                        }
                        
                        if (total > 0) {
                            await message.channel.bulkDelete(total);
                        }
                    } catch (bulk_delete_fail) {
                        try {
                            while (total >= 100) {
                                let messages = await message.channel.messages.fetch({ limit: 99, before: reply.id});
                                for (let [_id, m] of messages) {
                                    await m.delete();
                                    total -= 1;
                        
                                }
                            }

                            if (total > 0) {
                                let messages = await message.channel.messages.fetch({ limit: total, before: reply.id });
                                for (let [_id, message] of messages) {
                                    await message.delete();
                                }
                            }
                        } catch {
                            message.channel.send("Error during deletion, please try again.");
                            return;
                        }
                    }
                    message.channel.send("Bulk delete complete.");
                } else {
                    reply.reply("Deletion canceled.");
                    return; // not currently necessary but added for verbosity
                }
            }).catch((e) => {
                message.channel.send("Unable to bulk delete messages.");
            })
    }
})