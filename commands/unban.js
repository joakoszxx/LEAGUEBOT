const { google } = require('googleapis');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const config = require('../config.json');
const CHANNEL_ID = config.channels.sanctions;
const STAFF_ROLE_ID = config.roles.Staff;

const auth = new google.auth.GoogleAuth({
  keyFile: 'google-credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({
  version: 'v4',
  auth
});

async function markPlayerAsUnbanned(playerId) {

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.config.spreadsheet_id,
    range: `${config.config.sheetName}!A:L`
  });

  const rows = response.data.values || [];

  for (let i = 0; i < rows.length; i++) {

    const row = rows[i];

    const sheetPlayerId = row[10]; // H

    if (sheetPlayerId === playerId) {

      const rowNumber = i + 1;

      await sheets.spreadsheets.values.update({
        spreadsheetId: config.config.spreadsheet_id,
        range: `${config.config.sheetName}!G${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [["PLAYER"]]
        }
      });

      return true;
    }
  }

  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Remove sanction from player (STAFF ONLY)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o =>
      o.setName('player')
        .setDescription('Player')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Reason for unban')
        .setRequired(false)
    ),

  async execute(interaction) {

    // CHECK STAFF ROLE
    if (!interaction.member.roles.cache.has(config.roles.Staff)) {
      return interaction.reply({
        content: "❌ You don't have permission to use this command.",
        ephemeral: true
      });
    }

    let storage = JSON.parse(fs.readFileSync('./storage.json', 'utf-8'));
    if (!storage.bans) storage.bans = [];

    const player = interaction.options.getUser('player');
    const reason = interaction.options.getString('reason') || "No reason provided";

    const index = storage.bans.findIndex(b => b.userId === player.id);

    if (index === -1) {
      return interaction.reply({
        content: "❌ Player is not sanctioned.",
        ephemeral: true
      });
    }

    const ban = storage.bans[index];

try {
  await interaction.guild.members.unban(
    player.id,
    `${reason}`
  );

  console.log(`✅ ${player.tag} ha sido desbaneado de Discord.`);
} catch (err) {
  if (err.code === 10026) {
    console.log(`ℹ️ ${player.tag} ya no estaba baneado de Discord.`);
  } else {
    console.error('❌ Error al desbanear de Discord:', err);

    return interaction.reply({
      content: '❌ No pude desbanear al jugador de Discord. Verifica que el bot tenga permiso de **Banear miembros**.',
      ephemeral: true
    });
  }
}

storage.bans.splice(index, 1);

fs.writeFileSync(
  './storage.json',
  JSON.stringify(storage, null, 2)
);

        try {

  const updated =
    await markPlayerAsUnbanned(player.id);

  if (updated) {
    console.log("✅ Player marked as UNBANNED in Sheets");
  } else {
    console.log("❌ Player not found in Sheets");
  }

} catch (err) {

  console.error("❌ Google Sheets Error:", err);
}

    const robloxUser = player.username.split(" ")[0];

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(":hammer: Unban Record")
      .addFields(
        { name: ":bust_in_silhouette: Player", value: `<@${player.id}> (${player.id})`, inline: true },
        { name: ":video_game: Roblox", value: robloxUser, inline: true },
        { name: ":clipboard: Previous Type", value: ban.type, inline: true },

        { name: ":pencil: Original Reason", value: ban.reason, inline: false },
        { name: ":white_check_mark: Unban Reason", value: reason, inline: false },

        { name: ":alarm_clock: Previous Time", value: ban.time || "N/A", inline: true },
        { name: ":hammer: Moderator", value: `<@${interaction.user.id}>`, inline: true }
      )
      .setTimestamp();

    const channel = await interaction.client.channels.fetch(CHANNEL_ID);

    await channel.send({ embeds: [embed] });

    await interaction.reply({
      content: "✅ Unban completed",
      ephemeral: true
    });
  }
};