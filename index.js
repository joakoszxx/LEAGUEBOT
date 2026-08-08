// index.js

require('dotenv').config();

const config = require('./config.json');
const { REST, Routes } = require('discord.js');
const { google } = require('googleapis');

const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot is running');
});

const {
  Client,
  GatewayIntentBits,
  Collection,
  Partials
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction
  ]
});

client.commands = new Collection();

let autoroleMessageId = null;

const auth = new google.auth.GoogleAuth({
  keyFile: 'google-credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({
  version: 'v4',
  auth
});

async function loadSquadsFromSheets() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.config.spreadsheet_id,
      range: `${config.config.sheetName}!C:K`   // C hasta K (Nombre, Equipo, Rol, Discord ID)
    });

    const rows = response.data.values || [];

    let storage;
    try {
      storage = JSON.parse(fs.readFileSync('./storage.json', 'utf-8'));
    } catch {
      storage = {
        tw: "closed",
        squads: {},
        teamManagers: {}
      };
    }

    storage.squads = {};
    storage.teamManagers = {};   // Reiniciamos managers

    for (const row of rows) {
      const robloxName = row[0];     // Columna C
      const team        = row[2];    // Columna E
      const role        = row[4];    // Columna G
      const playerId    = row[8];    // Columna K

      if (!team || !playerId) continue;

      // === Squads (todos los jugadores) ===
      if (!storage.squads[team]) {
        storage.squads[team] = [];
      }
      if (!storage.squads[team].includes(playerId)) {
        storage.squads[team].push(playerId);
      }

      // === Team Managers ===
      if (role && role.toUpperCase() === "MANAGER") {
        if (!storage.teamManagers) storage.teamManagers = {};
        storage.teamManagers[team] = playerId;   // Solo un manager por equipo
      }
    }

    fs.writeFileSync(
      './storage.json',
      JSON.stringify(storage, null, 2)
    );

    console.log("✅ Playersheet loaded from Google Sheets");
    console.log(`   → ${Object.keys(storage.squads).length} teams loaded`);
    console.log(`   → ${Object.keys(storage.teamManagers).length} managers detected`);

  } catch (err) {
    console.error("❌ Error restoring squads and managers:", err);
  }
}

// ====================== DEPLOY COMMANDS ======================

async function deployCommands() {

  const CLIENT_ID = process.env.CLIENT_ID;
  const GUILD_ID = process.env.GUILD_ID;

  if (!CLIENT_ID || !GUILD_ID) {
    console.warn("⚠️ CLIENT_ID o GUILD_ID no configurados");
    return;
  }

  const commands = [];
  const files = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));

  for (const file of files) {

    const command = require(`./commands/${file}`);

    if (command?.data) {
      commands.push(command.data.toJSON());
    }
  }

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {

    console.log("Registering commands...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log(`✅ ${commands.length} Commands registered successfully.`);

  } catch (err) {

    console.error("Error registering commands:", err);
  }
}

// ====================== LOAD COMMANDS ======================

const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));

for (const file of commandFiles) {

  try {

    const cmd = require(`./commands/${file}`);

    if (!cmd?.data?.name) {
      console.log(`Invalid file: ${file}`);
      continue;
    }

    client.commands.set(cmd.data.name, cmd);

    console.log(`Command loaded: ${file}`);

  } catch (err) {

    console.error(`Error loading ${file}:`, err);
  }
}

// ====================== INTERACTIONS ======================

client.on('interactionCreate', async interaction => {

  // ====================== SLASH COMMANDS ======================

  if (interaction.isChatInputCommand()) {

    const command = client.commands.get(interaction.commandName);

    if (command) {

      try {

        await command.execute(interaction, client);

      } catch (err) {

        console.error(err);

        await interaction.reply({
          content: 'There was an error while executing this command.',
          ephemeral: true
        });
      }
    }

    return;
  }

  // ====================== AUTOCOMPLETE ======================

  if (interaction.isAutocomplete()) {

    const command = client.commands.get(interaction.commandName);

    if (command?.autocomplete) {
      await command.autocomplete(interaction);
    }

    return;
  }

  // ====================== BUTTONS ======================

  if (interaction.isButton()) {

    const parts = interaction.customId.split(":");

    const action = parts[0];
    const playerId = parts[1];
    const team = parts[2];
    const position = parts[3] || "—";
    const managerId = parts[4];
    const region = parts[5] || "—";

    const isEmergency =
      action === "emergency_accept" ||
      action === "emergency_decline";

    const type =
      action === "emergency_accept"
        ? "accept"
        : action === "emergency_decline"
        ? "decline"
        : action;

    const playerTag = `<@${playerId}>`;

    const playerAvatar =
      interaction.client.users.cache.get(playerId)?.displayAvatarURL({
        size: 512,
        extension: 'png'
      }) || "https://cdn.discordapp.com/embed/avatars/0.png";

    // Solo el jugador puede usar botones

    if (interaction.user.id !== playerId) {

      return interaction.reply({
        content: "❌ Este contrato no te pertenece.",
        ephemeral: true
      });
    }

    let storage;

    try {

      storage = JSON.parse(
        fs.readFileSync('./storage.json', 'utf-8')
      );

    } catch {

      storage = {
        squads: {}
      };
    }

    let newEmbed;

          async function getRobloxUserId(username) {
      try {
        const response = await fetch('https://users.roblox.com/v1/usernames/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usernames: [username],
                excludeBannedUsers: true
            })
        });

        const data = await response.json();

        if (!data.data || data.data.length === 0) {
            return null;
        }

        return data.data[0].id;

    } catch (err) {
        console.error("Error fetching Roblox ID:", err);
        return null;
    }
}
    // ====================== ACCEPT ======================

    if (type === "accept") {

      if (!storage.squads) storage.squads = {};
      if (!storage.squads[team]) storage.squads[team] = [];

      if (!storage.squads[team].includes(playerId)) {
        storage.squads[team].push(playerId);
      }

      if (isEmergency) {

        if (!storage.emergencyUses) {
          storage.emergencyUses = {};
        }

        storage.emergencyUses[team] =
          (storage.emergencyUses[team] || 0) + 1;
      }

      fs.writeFileSync(
        './storage.json',
        JSON.stringify(storage, null, 2)
      );

      // ====================== GOOGLE SHEETS ======================

      let addedToSheets = false;

      // ====================== GOOGLE SHEETS APPEND ======================
try {
  let robloxUser;

try {
    const guild = await interaction.client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(playerId);

    robloxUser = member.displayName;
} catch {
    const user = await interaction.client.users.fetch(playerId);
    robloxUser = user.username;
}

  const robloxId = await getRobloxUserId(robloxUser); 

    const role = managerId === playerId ? "MANAGER" : "PLAYER";
    const sheetInfo = await sheets.spreadsheets.values.get({
    spreadsheetId: config.config.spreadsheet_id,
    range: `${config.config.sheetName}!A:A`
    });
    const row = (sheetInfo.data.values?.length || 0) + 1;

    await sheets.spreadsheets.values.append({
        spreadsheetId: config.config.spreadsheet_id,
        range: `${config.config.sheetName}!A1`,                    // ← Cambiar a A1
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',              // ← Muy importante
        requestBody: {
            values: [[
                "",                                         // A (CLASS)
                robloxId,                                   // B (USER ID)
                robloxUser,                                 // C (ROBLOX USER)
                `=BUSCARV("${team}",Datasheet!A:B,2,FALSO)`,// D (TEAM ICON)
                team,                                       // E (TEAM)
                `=BUSCARV("${role}",Datasheet!A:B,2,FALSO)`,// F (ROLE ICON)
                role,                                       // G (ROLE)
                `=BUSCARV(A${row},Datasheet!G:H,2,FALSO)`,  // H (WAGE)
                "0",                                        // I (PENALTY)
                `=H${row}-I${row}`,                         // J (TOTAL) 
                playerId,                                   // K (DISCORD ID)
                new Date().toLocaleString('es-PE')          // L - timestamp
            ]]
        }
    });

    console.log("✅ Jugador agregado correctamente a Google Sheets");
    addedToSheets = true;

} catch (err) {
    console.error("❌ Error Google Sheets:", err);
    addedToSheets = false;
}

      newEmbed = {
        color: 0x00ff00,
        title: "🤝 Contract Accepted!",
        description:
`**${playerTag}** has accepted the contract from **${team}**

**Position:** ${position}
**Region:** ${region}`,

        thumbnail: {
          url: playerAvatar
        },

        fields: [
          {
            name: "Player",
            value: `<@${playerId}>`,
            inline: true
          },
          {
            name: "Team",
            value: team,
            inline: true
          },
          {
            name: "Manager",
            value: `<@${managerId}>`,
            inline: true
          }
        ],

        footer: {
          text: `${config.config.leagueName} • ${new Date().toLocaleString('es-PE')}`
        },

        timestamp: new Date()
      };

      // SEND ACCEPTED TO CONTRACTS CHANNEL

      try {

        const contractsChannel =
          await interaction.client.channels.fetch(config.channels.contracts);

        if (contractsChannel) {

          await contractsChannel.send({
            embeds: [newEmbed]
          });
        }

      } catch (err) {

        console.error(err);
      }

      // LOG ACCEPT

      try {

        const logsChannel =
          await interaction.client.channels.fetch(config.channels.bot_logs);

        if (logsChannel) {

          let message =
            isEmergency
              ? `:white_check_mark: | <@${playerId}> accepted emergency contract with **${team}** (${position})`
              : `:white_check_mark: | <@${playerId}> accepted contract with **${team}** (${position})`;
          await logsChannel.send(message);
        }

      } catch (err) {

        console.error(err);
      }
    }

    // ====================== DECLINE ======================

    else if (type === "decline") {

      newEmbed = {
        color: 0xff0000,
        title: "❌ Contract Declined",
        description:
`**${playerTag}** declined the contract from **${team}**

**Position:** ${position}
**Region:** ${region}`,

        thumbnail: {
          url: playerAvatar
        },

        fields: [
          {
            name: "Player",
            value: `<@${playerId}>`,
            inline: true
          },
          {
            name: "Team",
            value: team,
            inline: true
          },
          {
            name: "Manager",
            value: `<@${managerId}>`,
            inline: true
          }
        ],

        footer: {
          text: `${config.config.leagueName} • ${new Date().toLocaleString('es-PE')}`
        },

        timestamp: new Date()
      };

      // LOG DECLINE

      try {

        const logsChannel =
          await interaction.client.channels.fetch(config.channels.bot_logs);

        if (logsChannel) {

          await logsChannel.send(
            `:x: | <@${playerId}> declined contract with **${team}** (${position})`
          );
        }

      } catch (err) {

        console.error(err);
      }
    }

    if (type === "accept") {

      await interaction.update({
        content: `✅ Contract accepted successfully, welcome to **${team}**!`,
        embeds: [newEmbed],
        components: []
      });

    } else {

      await interaction.update({
        content: `❌ Contract declined successfully`,
        embeds: [newEmbed],
        components: []
      });
    }
  }
});

// ====================== AUTO ROLES ======================
client.on("messageReactionAdd", async (reaction, user) => {
  if (!config.config.autoroles) return;

  if (user.bot) return;

  try {

    if (reaction.partial) await reaction.fetch();

    if (reaction.message.id !== autoroleMessageId) return;

    const roleId = config.roles.autoroleMap[reaction.emoji.name];

    if (!roleId) return;

    const member = await reaction.message.guild.members.fetch(user.id);

    await member.roles.add(roleId);

  } catch (err) {

    console.error("Autorole Add Error:", err);

  }

});

client.on("messageReactionRemove", async (reaction, user) => {
  if (!config.config.autoroles) return;

  if (user.bot) return;

  try {

    if (reaction.partial) await reaction.fetch();

    if (reaction.message.id !== autoroleMessageId) return;

    const roleId = config.roles.autoroleMap[reaction.emoji.name];

    if (!roleId) return;

    const member = await reaction.message.guild.members.fetch(user.id);

    await member.roles.remove(roleId);

  } catch (err) {

    console.error("Autorole Remove Error:", err);

  }

});

process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});

client.once('ready', async () => {

  await loadSquadsFromSheets();

  console.log(`🤖 ${client.user.tag} is online`);

  if (config.config.autoroles) {

  try {
    const channel = await client.channels.fetch(config.channels.autoroles);

    const message = await channel.send(
`⚽ \`Scrim Notifications\` - ***Get notified whenever a scrim is being hosted.***
⚔️ \`Friendlies Notifications\` - ***Get notified whenever someone is looking for a friendly.***
🔎 \`Scout Notifications\` - ***Get notified whenever a manager is looking for players.***
🎮 \`Gamenight Notifications\` - ***Get notified whenever a gamenight is being hosted.***
🎉 \`Giveaway Notifications\` - ***Get notified whenever a giveaway is being hosted.***
📸 \`Content Creation Notifications\` - ***Get notified whenever a content creator shares their work.***`
    );

    await message.react("⚽");
    await message.react("⚔️");
    await message.react("🔎");
    await message.react("🎮");
    await message.react("🎉");
    await message.react("📸");

    autoroleMessageId = message.id;

    console.log("AUTOROLE MESSAGE ID:", message.id);

  } catch (err) {
    console.error("Error setting up autorole message:", err);
  }

} else {
  
}

  try {

    const channel =
      await client.channels.fetch(config.channels.bot_logs);

    if (channel) {
      await channel.send("Bot Online");
    }

  } catch (err) {

    console.error("Error enviando mensaje de inicio:", err);
  }
});

// ====================== START ======================

deployCommands();

client.login(process.env.TOKEN);