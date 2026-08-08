const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { google } = require('googleapis');
const config = require('../config.json');

// ====================== GOOGLE SHEETS ======================

const auth = new google.auth.GoogleAuth({
  keyFile: 'google-credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({
  version: 'v4',
  auth
});

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
async function addManagerToSheet(username, team, playerId) {

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.config.spreadsheet_id,
    range: `${config.config.sheetName}!A:L`
  });

  const rows = response.data.values || [];

  const existing = rows.find(
    r => r[7] === playerId
  );

  if (existing) {
    return false;
  }

      const sheetInfo = await sheets.spreadsheets.values.get({
    spreadsheetId: config.config.spreadsheet_id,
    range: `${config.config.sheetName}!A:A`
    });
    const row = (sheetInfo.data.values?.length || 0) + 1;
  const robloxId = await getRobloxUserId(username); 
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.config.spreadsheet_id,
    range: `${config.config.sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        "", // CLASS
        robloxId, // USER ID
        username, // ROBLOX USER
        `=BUSCARV("${team}",Datasheet!A:B,2,FALSO)`, // TEAM ICON
        team, // TEAM
        `=BUSCARV("MANAGER",Datasheet!A:B,2,FALSO)`, // ROLE ICON
        "MANAGER", // ROLE
        `=BUSCARV(A${row},Datasheet!G:H,2,FALSO)`, // WAGE
        "0", // PENALTY
        `=H${row}-I${row}`, // TOTAL
        playerId, // DISCORD
        new Date().toLocaleString('es-PE') // I - timestamp
      ]]
    }
  });

  return true;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addmanager')
    .setDescription('Assign a manager to a team (STAFF ONLY)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o =>
      o.setName('dt')
        .setDescription('Manager')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('team')
        .setDescription('Team')
        .setRequired(true)
        .addChoices(
          ...Object.keys(config.teams).map(t => ({
            name: t,
            value: t
          }))
        )
    ),

  async execute(interaction) {

    // 🔐 ROLE CHECK
    if (!interaction.member.roles.cache.has(config.roles.Staff)) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true
      });
    }

    let storage;
    try {
      storage = JSON.parse(fs.readFileSync('./storage.json', 'utf-8'));
    } catch {
      storage = { tw: "closed", squads: {}, teamManagers: {} };
    }

    const dt = interaction.options.getUser('dt');
    const team = interaction.options.getString('team');

    if (!storage.teamManagers) storage.teamManagers = {};

    storage.teamManagers[team] = dt.id;

    fs.writeFileSync('./storage.json', JSON.stringify(storage, null, 2));

    try {

  const member =
    await interaction.guild.members.fetch(dt.id);

    await member.roles.add(config.roles.Manager);

  const added =
    await addManagerToSheet(
      member.displayName,
      team,
      dt.id
    );

  if (added) {

    console.log("✅ Manager added to Google Sheets");

  } else {

    console.log("❌ Manager already exists in Google Sheets");
  }

} catch (err) {

  console.error("❌ Google Sheets Error:", err);
}

    const logChannel = await interaction.client.channels.fetch(config.channels.bot_logs);

    if (logChannel) {
      await logChannel.send(
        `:white_check_mark: | ${dt} was assigned as manager of **${team}** by ${interaction.user}`
      );
    }

    await interaction.reply(
      `✅ ${dt} is now manager of **${team}**`
    );
  }
};