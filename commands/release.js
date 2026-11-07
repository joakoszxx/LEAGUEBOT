const { SlashCommandBuilder } = require('discord.js');
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

async function removePlayerFromSheet(username, playerId, team) {

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.config.spreadsheet_id,
    range: `${config.config.sheetName}!A:M`
  });

  const rows = response.data.values || [];

  let rowIndex = -1;

  for (let i = 0; i < rows.length; i++) {

    const row = rows[i];

    const sheetUser = row[2]; // C
    const sheetTeam = row[4]; // E
    const sheetPlayerId = row[11]; // L

    if (
      sheetUser === username &&
      sheetTeam === team &&
      sheetPlayerId === playerId
    ) {

      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return false;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.config.spreadsheet_id,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: SHEET_GID,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        }
      ]
    }
  });

  return true;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('release')
    .setDescription('Release player')
    .addUserOption(o =>
      o
        .setName('player')
        .setDescription('Player to release')
        .setRequired(true)
    )
  .addStringOption(o =>
  o
    .setName('team')
    .setDescription('Team name')
    .setRequired(true)
    .addChoices(
      ...Object.keys(config.teams).map(t => ({
        name: t,
        value: t
      }))
    )
  )
    .addStringOption(o =>
      o
        .setName('reason')
        .setDescription('Reason for release')
        .setRequired(true)
    ),

  async execute(interaction) {
const isManager = interaction.member.roles.cache.has(config.roles.Manager);
const isStaff = interaction.member.roles.cache.has(config.roles.Staff);

if (!isManager && !isStaff) {
  return interaction.reply({
    content: "❌ You don't have permission to use this command.",
    ephemeral: true
  });
}
const releasedByIsStaff = isStaff && !isManager;

    if (isManager && !isStaff) {

      let twStorage;

      try {
        twStorage = JSON.parse(fs.readFileSync('./storage.json', 'utf-8'));
      } catch {
        twStorage = { tw: "closed" };
      }

      if (twStorage.tw !== "opened") {
        return interaction.reply({
          content: "❌ Transfer Window is closed.",
          ephemeral: true
        });
      }
    }

    const player = interaction.options.getUser('player');
    const team = interaction.options.getString('team');
    const reason = interaction.options.getString('reason');

    let storage;
    try {
      storage = JSON.parse(fs.readFileSync('./storage.json', 'utf-8'));
    } catch {
      storage = { squads: {} };
    }

    // CHECK PLAYER IS IN TEAM

if (!releasedByIsStaff) {

  const squad = storage.squads?.[team] || [];

  if (!squad.includes(player.id)) {
    return interaction.reply({
      content: "❌ This player is not in your team.",
      ephemeral: true
    });
  }

}

    if (storage.squads?.[team]) {
      storage.squads[team] = storage.squads[team].filter(id => id !== player.id);
    }

await interaction.deferReply({ ephemeral: true });

    fs.writeFileSync('./storage.json', JSON.stringify(storage, null, 2));

    // ====================== REMOVE FROM GOOGLE SHEETS ======================

let removedFromSheets = false;

try {

  const member =
  await interaction.guild.members.fetch(player.id);

  const removed =
  await removePlayerFromSheet(member.displayName, player.id, team);

  removedFromSheets = removed;

  if (removed) {

    console.log("✅ Player removed from Google Sheets");

  } else {

    console.log("❌ Player not found in Google Sheets");
  }

} catch (err) {

  console.error("❌ Google Sheets Error:", err);
}

    const playerAvatar = player.displayAvatarURL({
      size: 512,
      extension: 'png'
    });

    const emoji = config.teams?.[team] || "🏴";
    const channel = interaction.guild.channels.cache.get(config.channels.contracts);

    const embed = {
      color: 0xff0000,
      title: "📤 Player Released",
      description: `**${player}** has been released from **${team}**`,
      fields: [

        { name: "Player", value: `${player}`, inline: true },
        { name: "Team", value: `${emoji} ${team}`, inline: true },
        {
          name: "Released by",
          value: releasedByIsStaff
          ? `${interaction.user} (Staff)`
          : `${interaction.user} (Manager)`,
          inline: true
        },

        // Segunda fila (Reason ocupa toda la fila)
        { name: "Reason", value: reason, inline: false }
      ],
      footer: {
        text: `${config.config.leagueName} • ${new Date().toLocaleString('en-US')}`
      },

           thumbnail: {
            url: playerAvatar   // Aquí va el avatar del jugador
        },
    };

    await channel.send({ embeds: [embed] });
    const logChannel = await interaction.client.channels.fetch(config.channels.bot_logs);

if (logChannel) {
  let logMessage = releasedByIsStaff
  ? `:rotating_light: | ${player} force released from **${team}** by ${interaction.user}`
  : `:outbox_tray: | ${player} released from **${team}** by ${interaction.user}`;
  await logChannel.send(logMessage);
}

    await interaction.editReply("✅ Player released successfully");
  }
};
