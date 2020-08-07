const { Client, Message } = require("discord.js");
const config = require("../config.json");

const awaitReply = (textChannel, userId) => {
    return new Promise(resolve => {
        const collector = textChannel.createMessageCollector(
            m => m.author.id === userId,
            { max: 1, time: 15 * 1000 },
        );
        collector.on("collect", msg => resolve(msg));
        collector.on("end", () => resolve(null));
    });
};

/**
 * @param {Client} client
 * @param {Message} message
 */
async function deletemessages(client, message) {
    // Ask for the user whose message we'll be deleting
    message.channel.send("Whose messages are we deleting?");
    const userAnswer = await awaitReply(message.channel, message.author.id);

    if (!userAnswer || !userAnswer.content || userAnswer.content === "cancel") {
        message.channel.send("Cancelled");
        return;
    }

    const userIdMatch = userAnswer.content.match(/^(?:<@!?)?(\d+)>?$/);
    if (!userIdMatch) {
        message.channel.send("No idea who that is tbh");
        return;
    }

    const userId = userIdMatch[1];

    // Ask for the channel where we'll be deleting the messages
    message.channel.send("Which channel are we deleting messages in?");
    const channelAnswer = await awaitReply(message.channel, message.author.id);

    if (!channelAnswer || !channelAnswer.content || channelAnswer.content === "cancel") {
        message.channel.send("Cancelled");
        return;
    }

    const channelIdMatch = channelAnswer.content.match(/^(?:<#)?(\d+)>?$/);
    const channelId = channelIdMatch && channelIdMatch[1];
    const channel = channelId && message.channel.guild.channels.cache.get(channelId);
    if (!channel) {
        message.channel.send("No idea what channel that is tbh");
        return;
    }

    // Ask for the earliest date we'll look for messages to delete
    message.channel.send("And finally, how far back should we look? Date format YYYY-MM-DD");
    const dateAnswer = await awaitReply(message.channel, message.author.id);

    if (!dateAnswer || !dateAnswer.content || dateAnswer === "cancel") {
        message.channel.send("Cancelled");
        return;
    }

    const dateMatch = dateAnswer.content.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
        message.channel.send("No idea what that date is tbh");
        return;
    }

    let [y, m, d] = dateMatch.slice(1).map(v => parseInt(v, 10));

    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
        message.channel.send("No idea what that date is tbh");
        return;
    }

    // Confirm
    const pad = str => ("00" + str).slice(-2);
    const formattedDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    message.channel.send(`So, to confirm: delete messages from <@!${userId}> (\`${userId}\`) in channel <#${channel.id}> (\`${channel.id}\`), going back until ${formattedDate}? Answer OK to continue.`);

    const confirmAnswer = await awaitReply(message.channel, message.author.id);
    if (!confirmAnswer || !confirmAnswer.content || confirmAnswer.content !== "OK") {
        message.channel.send("Cancelled");
        return;
    }

    // Finally, start deleting messages!
    const infoMessage = await message.channel.send("Deleting messages. Send `cancel` to cancel.");

    let cancelled = false;
    const cancelCollector = message.channel.createMessageCollector(
        m => m.author.id === message.author.id && m.content === "cancel",
        { max: 1 },
    );
    cancelCollector.on("collect", msg => {
        message.channel.send("Stopping deletion...");
        cancelled = true;
    });

    const batchSize = 50;
    const endTimestamp = +date;
    let deleted = 0;
    let lastMessageId = infoMessage.id;

    let canNotify = false;
    setTimeout(() => canNotify = true, 5000);

    deleteLoop:
    while (true) {
        const messagesToCheck = await channel.messages.fetch({ limit: batchSize, before: lastMessageId });

        for (const messageToCheck of messagesToCheck.values()) {
            if (cancelled) break deleteLoop;

            lastMessageId = messageToCheck.id;
            if (messageToCheck.author.id !== userId) continue;
            if (messageToCheck.createdTimestamp < endTimestamp) break deleteLoop;

            console.log(`Deleting ${messageToCheck.channel.id}-${messageToCheck.id}`);
            try {
                await messageToCheck.delete();
            } catch (e) {
                message.channel.send("Got an error, cancelling! Check the logs channel for more information.");
                break deleteLoop;
            }

            deleted++;

            if (canNotify) {
                (await infoMessage).edit({ content: `Deleting messages... ${deleted} deleted so far` });
                canNotify = false;
                setTimeout(() => canNotify = true, 5000);
            }
        }

        if (messagesToCheck.size < batchSize) {
            // Reached the end of the channel
            break;
        }
    }

    cancelCollector.stop();
    (await infoMessage).delete().catch(() => {});
    message.channel.send(`Done! Deleted ${deleted} messages from <@!${userId}> in <#${channel.id}>.`);
}

module.exports = deletemessages;
