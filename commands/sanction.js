const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const config = require('../config.json');
const fs = require('fs');
const { google } = require('googleapis');

// ====================== GOOGLE SHEETS ======================

const auth = new google.auth.GoogleAuth({
  keyFile: 'google-credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({
  version: 'v4',
  auth
});

async function markPlayerAsBanned(playerId) {

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
          values: [["BANNED"]]
        }
      });

      return true;
    }
  }

  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sanction')
    .setDescription('Apply a sanction to a player (STAFF ONLY)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o =>
      o.setName('player')
        .setDescription('Player')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('type')
        .setDescription('Sanction type')
        .setRequired(true)
        .addChoices(
          { name: 'Permanent', value: 'permanent' },
          { name: 'Blacklist', value: 'blacklist' },
          { name: 'Temporary', value: 'temp' }
        )
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('Reason')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('bail')
        .setDescription('Bail amount')
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('time')
        .setDescription('Only temp (10m, 2h, 1d)')
        .setRequired(false)
    ),

  async execute(interaction) {

    // verificar rol
    if (!interaction.member.roles.cache.has(config.roles.Staff)) {
      return interaction.reply({
        content: "You do not have the permission to run this command",
        ephemeral: true
      });
    }

    let storage = JSON.parse(fs.readFileSync('./storage.json', 'utf-8'));
    if (!storage.bans) storage.bans = [];

    const player = interaction.options.getUser('player');
    const type = interaction.options.getString('type');
    const reason = interaction.options.getString('reason');
    const bail = interaction.options.getString('bail') || "N/A";
    const time = interaction.options.getString('time') || "N/A";
    const member = await interaction.guild.members.fetch(player.id).catch(() => null);

    const robloxUser = player.username.split(" ")[0];
    const now = new Date();

    const embed = new EmbedBuilder()
      .setColor(type === "permanent" ? 0xff0000 : type === "blacklist" ? 0x2b2d31 : 0xffa500)
      .setTitle(":hammer: Sanction - " + type.toUpperCase())
      .addFields(
        { name: ":bust_in_silhouette: Player", value: `<@${player.id}> (${player.id})`, inline: true },
        { name: ":video_game: Roblox", value: robloxUser, inline: true },
        { name: ":clipboard: Type", value: type, inline: true },

        { name: ":pencil: Reason", value: reason, inline: false },

        { name: ":alarm_clock: Expires", value: type === "temp" ? time : "N/A", inline: true },
        { name: ":moneybag: Bail", value: bail, inline: true },
        { name: ":hammer: Moderator", value: `<@${interaction.user.id}>`, inline: true }
      )
      .setFooter({
        text: `${config.config.leagueName} • ${now.toLocaleString('en-US')}`
      });

    // guardar sanción
    storage.bans.push({
      userId: player.id,
      type,
      reason,
      time,
      createdAt: now.getTime()
    });

    fs.writeFileSync('./storage.json', JSON.stringify(storage, null, 2));

    try {

  const updated =
    await markPlayerAsBanned(player.id);

  if (updated) {
    console.log("✅ Player marked as BANNED in Sheets");
  } else {
    console.log("❌ Player not found in Sheets");
  }

} catch (err) {

  console.error("❌ Google Sheets Error:", err);
}

    // temp auto unban
    if (type === "temp" && time !== "N/A") {
      const match = time.match(/(\d+)([mhd])/);

      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];

        let ms = 0;

        if (unit === "m") ms = value * 60000;
        if (unit === "h") ms = value * 3600000;
        if (unit === "d") ms = value * 86400000;

        setTimeout(() => {
          let data = JSON.parse(fs.readFileSync('./storage.json', 'utf-8'));

          data.bans = data.bans.filter(b => b.userId !== player.id);

          fs.writeFileSync('./storage.json', JSON.stringify(data, null, 2));
        }, ms);
      }
    }

    const channel = await interaction.client.channels.fetch(config.channels.sanctions);

    await channel.send({ embeds: [embed] });

    if (member) {

      if (type === "permanent" || type === "blacklist") {
        await member.ban({ reason: reason });
      }

      if (type === "temp") {
        await member.kick().catch(() => null);
      }
    }

    await interaction.reply({
      content: "✅ Sanction sent",
      ephemeral: true
    });
  }
};