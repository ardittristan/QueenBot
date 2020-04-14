const path = require("path");
const Discord = require("discord.js");

//! Libraries
//* defines multipliers for string
const delayStringMultipliers = {
    w: 1000 * 60 * 60 * 24 * 7,
    d: 1000 * 60 * 60 * 24,
    h: 1000 * 60 * 60,
    m: 1000 * 60,
    s: 1000,
    x: 1,
};

//* converts string to datetime format
function convertDelayStringToMS(str, defaultUnit = "m") {
    const regex = /^([0-9]+)\s*([wdhms])?[a-z]*\s*/;
    let match;
    let ms = 0;

    str = str.trim();

    // tslint:disable-next-line
    while (str !== "" && (match = str.match(regex)) !== null) {
        ms += match[1] * ((match[2] && delayStringMultipliers[match[2]]) || delayStringMultipliers[defaultUnit]);
        str = str.slice(match[0].length);
    }

    // Invalid delay string
    if (str !== "") {
        return null;
    }

    return ms;
}

//* creates rich embed quote
async function createRichEmbed(message) {
    return new Promise((embedOut) => {
        setTimeout(() => {
            var embed = new Discord.MessageEmbed()
                .setFooter("#" + message.channel.name)
                .setTimestamp(new Date(message.createdTimestamp))
                .addField(String.fromCharCode(8203), `[Go to message](${message.url})`);
            if (message.author.avatarURL()) {
                embed.setAuthor(message.author.username, message.author.avatarURL());
            }
            else { embed.setAuthor(message.author.username); }
            if (message.content) {
                embed.setDescription(message.content);
            }

            if (message.attachments.array().length !== 0) {
                var attachment = message.attachments.first();
                var ext = path
                    .extname(attachment.name)
                    .slice(1)
                    .toLowerCase();
                if (["jpeg", "jpg", "png", "gif", "webp"].includes(ext)) {
                    embed.setImage(attachment.url);
                }
            }
            if (message.embeds.length !== 0 && message.embeds[0].type === 'image') {
                embed.setImage(message.embeds[0].thumbnail.url);
            }
            embedOut(embed);
        }, 1000, "Oops, something went wrong");
    });
}

module.exports.convertDelayStringToMS = convertDelayStringToMS;
module.exports.createRichEmbed = createRichEmbed;