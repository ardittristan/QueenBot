const { TextChannel } = require("discord.js");

/**
 * @param {string} str Stroobng toob ooboobb
 * @returns {string} Ooboobb'd stroobng
 */
const oob = str => str.replace(/[aeiouy]/g, "oob");

/**
 * @param {TextChannel} channel Choobnnoobl toob roobply oobn
 * @param {string} content Coobntoobnt toob ooboobb
 */
function oobCmd(channel, content) {
    const oobd = oob(content);
    if (oobd.length > 2000) {
        channel.sendMessage(oob("Too long"));
        return;
    }

    channel.sendMessage(oobd, {
        disableMentions: "all",
    });
}

module.exports = oobCmd;
