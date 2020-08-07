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

const dateInputToDate = (dateInput) => {
    const dateMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
        return null;
    }

    let [y, m, d] = dateMatch.slice(1).map(v => parseInt(v, 10));

    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
        return null;
    }

    return date;
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

    // Ask for the most recent date we'll use for deleting messages
    message.channel.send("How far back should we *start* looking? As in, what is the most recent date messages should be deleted on? Date format YYYY-MM-DD");
    const fromDateAnswer = await awaitReply(message.channel, message.author.id);

    if (!fromDateAnswer || !fromDateAnswer.content || fromDateAnswer === "cancel") {
        message.channel.send("Cancelled");
        return;
    }

    const fromDate = dateInputToDate(fromDateAnswer.content);
    if (!fromDate) {
        message.channel.send("No idea what that date is tbh");
        return;
    }

    fromDate.setHours(23);
    fromDate.setMinutes(59);
    fromDate.setSeconds(59);

    // Ask for the most distant date we'll look for messages to delete
    message.channel.send("And finally, how far back should we look? Date format YYYY-MM-DD");
    const toDateAnswer = await awaitReply(message.channel, message.author.id);

    if (!toDateAnswer || !toDateAnswer.content || toDateAnswer === "cancel") {
        message.channel.send("Cancelled");
        return;
    }

    const toDate = dateInputToDate(toDateAnswer.content);
    if (!toDate) {
        message.channel.send("No idea what that date is tbh");
        return;
    }

    // Confirm
    const pad = str => ("00" + str).slice(-2);
    const formattedFromDate = `${fromDate.getFullYear()}-${pad(fromDate.getMonth() + 1)}-${pad(fromDate.getDate())}`;
    const formattedToDate = `${toDate.getFullYear()}-${pad(toDate.getMonth() + 1)}-${pad(toDate.getDate())}`;
    message.channel.send(`So, to confirm:\nDelete messages from <@!${userId}> (\`${userId}\`) in channel <#${channel.id}> (\`${channel.id}\`) between ${formattedFromDate} and ${formattedToDate}?\n\nAnswer OK to continue.`);

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
    const fromTimestamp = +fromDate;
    const toTimestamp = +toDate;
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
            if (messageToCheck.createdTimestamp > fromTimestamp) continue; // Message is too new, keep looking
            if (messageToCheck.createdTimestamp < toTimestamp) break deleteLoop; // Message is too old, bail

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
