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
const { createRichEmbed, convertDelayStringToMS } = require("./libs/draglib");
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
    //* creates table for reminders
    db.run(/*sql*/`CREATE TABLE IF NOT EXISTS "Reminders" ("DateTime" INTEGER NOT NULL, "UserId" TEXT NOT NULL, "Reminder" TEXT NOT NULL)`, function (err) {
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
    remindCheck();
    console.log("Booted");
});

function getCommandParts(content) {
    const commandPartsSource = content.slice(pLength);
    const argsSeparatorMatch = commandPartsSource.match(/\s+/);
    let [command, argsString] = argsSeparatorMatch
        ? [commandPartsSource.slice(0, argsSeparatorMatch.index), commandPartsSource.slice(argsSeparatorMatch.index).trim()]
        : [commandPartsSource, ""];
    command = command.toLowerCase();
    const args = argsString.split(/\s+/g);

    return {
        command,
        argsString,
        args,
    };
}

//! Commands
client.on("message", async (message) => {
    if (!message.content.startsWith(config.prefix) || message.author.bot) return;

    const { command, argsString, args } = getCommandParts(message.content);
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
                ".birthday\n -posts link to birthday list\n\n" +
                ".remind <wdhm> <message>\n -adds reminder in set amount of time, example: .remind 4d2m <message>\n\n" +
                ".disconnect\n -disconnects you from your current vc channel\n\n" +
                ".oob\n -coobnvoobrt oob toobxt toob ooboobb\n\n" +
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
            if (argsString === "") return;

            if (message.channel.id === config.vctalk && message.member.voice.channel != undefined) {
                if (message.member.voice.channel.parentID === config.vccategory) {
                    message.member.voice.channel.setName(argsString);
                    logChannel.send(`${authr}` + " set voice channel name to: `" + message.content.slice(pLength + 6).trim() + "`");
                }
            }

            else {
                //* general channel rename
                config.renamable.forEach(function (entry) {
                    if (message.channel.id === entry) {
                        message.channel.setName(argsString);
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
            var emojiId = argsString;
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

        case "birthday":
            //#region
            message.channel.send(new Discord.MessageEmbed().addField(String.fromCharCode(8203), `[Birthday List](${config.birthdayurl})`));
            message.delete({ timeout: 1000 });
            break;
        //#endregion

        case "remindme":
        case "reminder":
        case "rem":
        case "remind":
            //* reminder tool
            //#region
            const [delayString, reminder = ""] = args;
            if (!delayString) return;
            var delay = new Date(Date.now() + convertDelayStringToMS(delayString));
            if (delay) {
                var author = authr.id;
                db.run(/*sql*/`INSERT INTO Reminders VALUES (?, ?, ?)`, [delay, author, reminder]);
                message.channel.send("You have set a reminder for: `" + delay.toISOString().replace(/T/, " ").replace(/\..+/, "`"));
            }
            break;
        //#endregion

        case "oob":
        case "ooboobb":
            //* oob
            //#region
            if (argsString === "") return;
            return require('./extra/oob')(message.channel, argsString);
            break;
        //#endregion
    }
});

//* admin commands
client.on("message", async (message) => {
    if (!message.content.startsWith(config.prefix) || message.author.bot || !(message.member.roles.cache.has(config.adminrole))) return;

    const { command, argsString, args } = getCommandParts(message.content);
    const authr = message.author;

    switch (command) {

        case "botavatar":
            getBufferFromUrl(argsString, function (_, _, body) {
                client.user.setAvatar(body);
            });

            break;

        case "deletemessages":
            require('./extra/deletemessages')(client, message);
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
        await messageReaction.message.fetch();
    }

    if (messageReaction.emoji.name !== "❤️" || guild.id !== messageReaction.message.guild.id) {
        // Wrong emoji or wrong server, bail
        return;
    }

    db.all(/*sql*/`SELECT MessageId FROM "Starred" WHERE MessageId = ? LIMIT 1`, [messageReaction.message.id], async function (err, rows) {
        if (rows.length === 1) {
            // Message is already starboarded, don't starboard it again
            return;
        }

        if (messageReaction.count >= Math.ceil(activeUsers * starDevider) + 1) {
            guild.channels.resolve(config.starboard).send({
                embed: await createRichEmbed(await messageReaction.message),
                disableEveryone: true,
            });
            db.run(/*sql*/`INSERT INTO Starred VALUES (?)`, [messageReaction.message.id]);
            starActive = false;
        }
    });

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
                    var timeout = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 1, 0, 0, 0) - now;
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

//* check if there are reminders to be send
async function remindCheck() {
    var currDateTime = Date.now();
    let sql = /*sql*/ `SELECT   DateTime,
                                UserId,
                                Reminder,
                                _rowid_ id
                        FROM Reminders
                        ORDER BY DateTime`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            throw err;
        } else
            if (rows.length !== 0) {
                rows.forEach((row) => {
                    if (currDateTime >= row.DateTime) {
                        guild.channels.resolve(config.defaultchannel).send("<@" + row.UserId + ">, **you asked me to remind you:** " + row.Reminder, { disableEveryone: true });
                        db.run(/*sql*/`DELETE FROM Reminders WHERE rowid=?`, row.id, function (err) {
                            if (err) {
                                return console.error(err.message);
                            }
                        });
                    }
                });
            }
    });
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
setInterval(remindCheck, 60000);
