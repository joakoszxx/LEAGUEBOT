const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
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

const SHEET_GID = 43668147;

async function removeTeamFromSheet(team) {

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.config.spreadsheet_id,
    range: `${config.config.sheetName}!A:L`
  });

  const rows = response.data.values || [];

  const rowsToDelete = [];

  for (let i = 0; i < rows.length; i++) {

    const row = rows[i];

    const sheetTeam = row[4];

    if (sheetTeam === team) {
      rowsToDelete.push(i);
    }
  }

  rowsToDelete.reverse();

  for (const rowIndex of rowsToDelete) {

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.config.spreadsheet_id,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: SHEET_GID,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1
              }
            }
          }
        ]
      }
    });
  }

  return rowsToDelete.length;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disband')
    .setDescription('Disband a team (STAFF ONLY)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o =>
      o.setName('team')
        .setDescription('Team to disband')
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
        content: "You do not have permission to use this command",
        ephemeral: true
      });
    }

    let storage;
    try {
      storage = JSON.parse(fs.readFileSync('./storage.json', 'utf-8'));
    } catch {
      return interaction.reply({ content: "❌ Storage error", ephemeral: true });
    }

    const team = interaction.options.getString('team');

    if (!storage.teamManagers) storage.teamManagers = {};
    if (!storage.squads) storage.squads = {};

    const oldManagerId = storage.teamManagers[team];
    // ====================== REMOVE MANAGER ROLE ======================

if (oldManagerId) {

  try {

    const manager = await interaction.guild.members.fetch(oldManagerId);

    if (manager.roles.cache.has(config.roles.Manager)) {

      await manager.roles.remove(config.roles.Manager);

      console.log(`✅ Removed Manager role from ${manager.user.tag}`);

    }

  } catch (err) {

    console.error("❌ Error removing Manager role:", err);

  }

}

    delete storage.teamManagers[team];
    delete storage.squads[team];

    fs.writeFileSync('./storage.json', JSON.stringify(storage, null, 2));

    // ====================== REMOVE TEAM FROM GOOGLE SHEETS ======================

let removedRows = 0;

try {

  removedRows =
    await removeTeamFromSheet(team);

  console.log(`✅ Removed ${removedRows} players from Google Sheets`);

} catch (err) {

  console.error("❌ Google Sheets Error:", err);
}

    const logChannel = await interaction.client.channels.fetch(config.channels.bot_logs);

    if (logChannel) {
await logChannel.send(
  `:x: | <@${oldManagerId}> was disbanded from **${team}** by ${interaction.user}`
);
    }

    await interaction.reply(
      `💥 Team **${team}** has been disbanded successfully.`
    );
  }
};