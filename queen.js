//! Imports
const { Database, OPEN_READWRITE, OPEN_CREATE } = require("sqlite3");
const Discord = require("discord.js");
const { existsSync, mkdirSync, unlinkSync } = require("fs");
const { execSync } = require('child_process');
const imageDownload = require('images-downloader').images;
const sharp = require('sharp');
const emojiExists = require('emoji-exists');
const twemojiParse = require('twemoji-parser').parse;
const getBufferFromUrl = require('request').defaults({ encoding: null }).get;
const svg2img = require('svg2img');
const { createRichEmbed } = require("./libs/draglib");
const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'], disabledEvents: ['TYPING_START'] });
const config = require("./config.json");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(config.spreadsheetid);






//! Globar vars
/** @type {number} */
const pLength = config.prefix.length;
/** @type {Discord.TextChannel} */
var logChannel;
/** @type {Discord.Guild} */
var guild;
var activeUsers = 1;
//* percentage of active needed for star + 1
var starDevider = 0.175;
//* amount of time passed without message to be considered inactive
var activeTime = 3600000;
var starActive = false;
//* pixel size of jumbo emotes
var jumboSize = 128;
var bdaySheet;
var daysSince1970Sheet;




//! Init temp folder
if (!existsSync("./tmp")) {
    mkdirSync("./tmp");
}


//! Init database
if (!existsSync("./db")) {
    mkdirSync("./db");
}
let db = new Database("./db/database.db", OPEN_READWRITE | OPEN_CREATE, (err) => {
    if (err) {
        console.error(err.message);
    }
    //* creates table for activity level
    db.run(/*sql*/`CREATE TABLE IF NOT EXISTS "Activity" ("DateTime" INTEGER NOT NULL, "UserId" TEXT NOT NULL)`, function (err) {
        if (err) {
            console.error(err.message);
        }
    });
    //* creates table for already starred messages
    db.run(/*sql*/`CREATE TABLE IF NOT EXISTS "Starred" ("MessageId" TEXT NOT NULL)`, function (err) {
        if (err) {
            console.error(err.message);
        }
    });
});





//! Startup code

client.login(config.token);

client.on("ready", () => {

    guild = client.guilds.resolve(config.guildid);
    logChannel = guild.channels.resolve(config.logchannel);

    activeUserCheck();
    console.log("Booted");
});



//! Commands
client.on("message", async (message) => {
    if (!message.content.startsWith(config.prefix) || message.author.bot) return;

    const args = message.content.slice(pLength).trim().split(/ +/g);
    const command = args.shift().toLocaleLowerCase();
    const authr = message.author;

    switch (command) {

        case "help":
            //* list commands
            //#region
            message.channel.send(
                "```" +
                "Commands:\n\n" +
                ".help\n -you're here, smh\n\n" +
                ".rename <name>\n -if put in general chat it renames the channel name\n\n" +
                ".rename <name>\n -if put in vc talk it renames the voice channel you're currently in\n\n" +
                ".jumbo <emoji>\n -makes emoji big" +
                ".toggleregion\n -toggles the voice region between europe and russia\n\n" +
                ".disconnect\n -disconnects you from your current vc channel\n\n" +
                "```"
            ).then(message =>
                message.delete({ timeout: 30000 })
            );
            message.delete({ timeout: 1000 });
            break;
        //#endregion

        case "rename":
            //* voice channel rename
            //#region
            if (message.channel.id === config.vctalk && message.member.voice.channel != undefined) {
                if (message.member.voice.channel.parentID === config.vccategory) {
                    message.member.voice.channel.setName(message.content.slice(pLength + 6).trim());
                    logChannel.send(`${authr}` + " set voice channel name to: `" + message.content.slice(pLength + 6).trim() + "`");
                }
            }

            else {
                //* general channel rename
                config.renamable.forEach(function (entry) {
                    if (message.channel.id === entry) {
                        message.channel.setName(message.content.slice(pLength + 6).trim());
                        logChannel.send(`${authr}` + " set " + message.channel.name + " name to: `" + message.content.slice(pLength + 6).trim() + "`");
                    }
                });
            }

            message.delete({ timeout: 1000 });
            break;
        //#endregion

        case "jumbo":
            //* big emotes
            //#region
            var emojiId = message.content.slice(pLength + 5).trim();
            if (emojiExists(emojiId)) {
                svg2img(twemojiParse(emojiId)[0].url, { width: jumboSize, height: jumboSize, preserveAspectRatio: true }, function (_, buffer) {
                    var attachment = new Discord.MessageAttachment(buffer, "unknown.png");
                    var embed = new Discord.MessageEmbed()
                        .setAuthor(message.author.username, message.author.avatarURL())
                        .attachFiles(attachment)
                        .setImage('attachment://unknown.png');
                    message.channel.send(embed);
                });
            } else
                if (message.content.includes("<a:")) {
                    var emojiId = message.content.match(/(?<=\<a:.*?:)([0-9]*?)(?=\>)/g);
                    if (emojiId != [] && emojiId != null) {
                        imageDownload([`https://cdn.discordapp.com/emojis/${emojiId[0]}.gif`], './tmp').then(result => {
                            execSync(`node "${__dirname}/node_modules/gifsicle/cli.js" --resize-width ${jumboSize} --colors 256 --no-warnings -o ${result[0].filename} ${result[0].filename}`);
                            var attachment = new Discord.MessageAttachment(result[0].filename, 'unknown.gif');
                            var embed = new Discord.MessageEmbed()
                                .setAuthor(message.author.username, message.author.avatarURL())
                                .attachFiles(attachment)
                                .setImage('attachment://unknown.gif');
                            message.channel.send(embed).then(() => {
                                unlinkSync(result[0].filename);
                            });
                        });
                    }
                } else {
                    var emojiId = message.content.match(/(?<=\<:.*?:)([0-9]*?)(?=\>)/g);
                    if (emojiId != [] && emojiId != null) {
                        imageDownload([`https://cdn.discordapp.com/emojis/${emojiId[0]}.png`], './tmp').then(async result => {
                            sharp(result[0].filename).resize(jumboSize).toBuffer().then(image => {
                                var attachment = new Discord.MessageAttachment(image, 'unknown.png');
                                var embed = new Discord.MessageEmbed()
                                    .setAuthor(message.author.username, message.author.avatarURL())
                                    .attachFiles(attachment)
                                    .setImage('attachment://unknown.png');
                                message.channel.send(embed).then(() => {
                                    unlinkSync(result[0].filename);
                                });
                            });
                        });
                    }
                }
            message.delete({ timeout: 1000 });
            break;
        //#endregion

        case "toggleregion":
            //* toggles region between russia and europe
            //#region
            if (guild.region === "europe") {
                guild.setRegion("russia");
            } else {
                guild.setRegion("europe");
            }
            logChannel.send(`${authr}` + " toggled the server region");
            message.delete({ timeout: 1000 });
            break;
        //#endregion

        case "disconnect":
            //* disconnects user from current connected voice channel
            //#region
            if (message.member.voice.channel != undefined) {
                guild.members.resolve(authr.id).voice.setChannel(null);
            }
            message.delete({ timeout: 1000 });
            break;
        //#endregion
    }
});

//* admin commands
client.on("message", async (message) => {
    if (!message.content.startsWith(config.prefix) || message.author.bot || !(message.member.roles.cache.has(config.adminrole))) return;

    const args = message.content.slice(pLength).trim().split(/ +/g);
    const command = args.shift().toLocaleLowerCase();
    const authr = message.author;

    switch (command) {

        case "botavatar":
            getBufferFromUrl(message.content.slice(pLength + 9).trim(), function (_, _, body) {
                client.user.setAvatar(body);
            });

            break;

    }
});
//? End of commands




//! Other events

client.on("emojiCreate", async (emoji) => {
    guild.channels.resolve(config.defaultchannel).send("New emoji - " + emoji.toString());
});

client.on("message", async (message) => {
    //* sets last activity on message
    //#region
    var exists = false;
    let sql = /*sql*/`SELECT    DateTime,
                                UserId,
                                _rowid_ id
                        FROM Activity
                        ORDER BY _rowid_`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return;
        }
        if (!message.author.bot) {
            rows.forEach(function (row) {
                if (row.UserId === message.author.id) {
                    db.run(/*sql*/`UPDATE Activity SET DateTime = ? WHERE rowid=?`, [message.createdTimestamp, row.id - 1]);
                    exists = true;
                }
            });
            if (!exists) {
                db.run(/*sql*/`INSERT INTO Activity (UserId, DateTime) VALUES (?, ?)`, [message.author.id, message.createdTimestamp]);
            }
        }
    });
    //#endregion
});

client.on("messageReactionAdd", async (messageReaction) => {
    //* Starboard
    //#region
    setTimeout(async function () { if (starActive) { starActive = false; } }, 10000);
    if (starActive) {
        while (starActive) {
            await sleep(500);
        }
    }
    starActive = true;
    if (messageReaction.partial) {
        try {
            await messageReaction.fetch().then(async function () {
                await messageReaction.message.fetch().then(async function () {
                    if (messageReaction.emoji.name === "❤️" && guild.id === messageReaction.message.guild.id) {
                        var exists = false;
                        db.all(/*sql*/`SELECT MessageId FROM "Starred" WHERE MessageId = ? LIMIT 1`, [messageReaction.message.id], async function (err, rows) {
                            if (rows.length === 1) { exists = true; }
                            if (messageReaction.count >= Math.ceil(activeUsers * starDevider) + 1 && !exists) {
                                guild.channels.resolve(config.starboard).send(await createRichEmbed(await messageReaction.message), { disableEveryone: true });
                                db.run(/*sql*/`INSERT INTO Starred VALUES (?)`, [messageReaction.message.id]);
                                starActive = false;
                            }
                        });
                    }
                });
            });
        } catch (error) {
            console.log("Something went wrong when fetching the reaction: ", error);
            starActive = false;
        }
    } else {
        if (messageReaction.emoji.name === "❤️" && guild.id === messageReaction.message.guild.id) {
            var exists = false;
            db.all(/*sql*/`SELECT MessageId FROM "Starred" WHERE MessageId = ? LIMIT 1`, [messageReaction.message.id], async function (err, rows) {
                if (rows.length === 1) { exists = true; }
                if (messageReaction.count >= Math.ceil(activeUsers * starDevider) + 1 && !exists) {
                    guild.channels.resolve(config.starboard).send(await createRichEmbed(await messageReaction.message, { disableEveryone: true }));
                    db.run(/*sql*/`INSERT INTO Starred VALUES (?)`, [messageReaction.message.id]);
                    starActive = false;
                }
            });
        }
    }
    starActive = false;
    //#endregion
});



//! Functions
//* sleep/timeout function
async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}


//* check for amount of users that are active
async function activeUserCheck() {
    var prevDateTime = Date.now() - activeTime;
    var localActiveUsers = 1;
    let sql = /*sql*/`SELECT    DateTime,
                                UserId
                        FROM Activity
                        ORDER BY _rowid_`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return;
        }
        rows.forEach(function (row) {
            if (row.DateTime >= prevDateTime) {
                localActiveUsers++;
            }
        });
        activeUsers = localActiveUsers;
        guild.channels.resolve(config.starboard).edit({ topic: `${Math.ceil(activeUsers * starDevider) + 1} hearts needed for heartboard` });
        guild.channels.resolve(config.logchannel).edit({ topic: `There are ${activeUsers} users active!` });
    });
}

//* init birthday sheet
async function sheetSetup() {
    doc.useApiKey(config.spreadsheetapikey)
        .then(async function () {
            doc.loadInfo()
                .then(async function () {
                    bdaySheet = doc.sheetsByIndex[0];
                    daysSince1970Sheet = doc.sheetsByIndex[1];
                    var now = new Date();
                    var timeout = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 2, 0, 0, 0) - now;
                    if (timeout < 0) {
                        timeout += 86400000;
                    }
                    setTimeout(function () {
                        checkBirthday();
                        setInterval(checkBirthday, 86400000);
                    }, timeout);
                });
        });
}

//* check for birthdays
async function checkBirthday() {
    var rows = await bdaySheet.getRows();
    var birthdayTimestamp = await daysSince1970Sheet.getRows();
    var curTime = new Date(Date.now());
    var curDay = curTime.getDate();
    var curMonth = curTime.getMonth();
    var birthdays = [];
    rows.forEach(function (row, id) {
        var day = birthdayTimestamp[id].day;
        var month = birthdayTimestamp[id].month;
        if (month == curMonth + 1 && day == curDay) {
            birthdays.push({ name: row.name, age: row.age });
        }
    });
    if (birthdays != []) {
        birthdays.forEach(data => {
            guild.channels.resolve(config.announcements).send(`It is ${data.name}'s birthay today! Happy ${data.age} years!`);
        });
    }
}
//? End of functions




//! database cleaning
async function dbVacuum() {
    db.run(/*sql*/`VACUUM "main"`);
}
dbVacuum;
setInterval(dbVacuum, 86400000);




process.on('unhandledRejection', err => {
    console.error(err);
    if (logChannel != undefined) {
        logChannel.send(`**ERROR**\n\`\`\`${err}\`\`\``);
    }
});



//! Intervals
setInterval(activeUserCheck, 600000);
sheetSetup();
