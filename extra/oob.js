const { TextChannel } = require("discord.js");

/**
 * @param {string} str Stroobng toob ooboobb
 * @returns {string} Ooboobb'd stroobng
 */
const oob = str => str
    .replace(/[aeiou]/g, "oob")
    .replace(/[AEIOU]/g, "OOB");

/**
 * @param {TextChannel} channel Choobnnoobl toob roobply oobn
 * @param {string} content Coobntoobnt toob ooboobb
 */
function oobCmd(channel, content) {
    const oobd = oob(content);
    if (oobd.length > 2000) {
        channel.send(oob("Too long"));
        return;
    }

    channel.send(oobd, {
        disableMentions: "all",
    });
}

module.exports = oobCmd;
