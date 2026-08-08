const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const fs = require('fs');
const { google } = require('googleapis');
const config = require('../config.json');

const auth = new google.auth.GoogleAuth({
  keyFile: 'google-credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({
  version: 'v4',
  auth
});

async function playerExistsInSheets(discordId) {

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.config.spreadsheet_id,
    range: `${config.config.sheetName}!A:L`
  });

  const rows = response.data.values || [];

  return rows.some(row => row[10] === discordId);
}

module.exports = {

  data: new SlashCommandBuilder()

    .setName('emergency')
    .setDescription('Send an emergency contract to a player')

    .addUserOption(o =>
      o.setName('player')
        .setDescription('Player to sign')
        .setRequired(true)
    )

    .addStringOption(o =>
      o.setName('team')
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
      o.setName('position')
        .setDescription('Player position')
        .setRequired(true)
    )

    .addStringOption(o =>
      o.setName('region')
        .setDescription('Player region')
        .setRequired(true)
        .addChoices(
          { name: 'GMT', value: 'GMT' },
          { name: 'BRT', value: 'BRT' },
          { name: 'PST', value: 'PST' },
          { name: 'EST', value: 'EST' },
          { name: 'CET', value: 'CET' }
        )
    ),

  async execute(interaction) {

    await interaction.deferReply({
      ephemeral: true
    });

    let storage;

    try {

      storage = JSON.parse(
        fs.readFileSync('./storage.json', 'utf-8')
      );

    } catch {

      storage = {
        tw: "closed",
        squads: {},
        teamManagers: {},
        emergencyUses: {}
      };
    }

    if (!storage.emergencyUses) {
      storage.emergencyUses = {};
    }

    const player = interaction.options.getUser('player');
    const team = interaction.options.getString('team');
    const position = interaction.options.getString('position');
    const region = interaction.options.getString('region');

    // NO SIGN MANAGERS

try {

  const playerMember = await interaction.guild.members.fetch(player.id);

  if (playerMember.roles.cache.has(config.roles.Manager)) {

    return interaction.editReply(
      "❌ You cannot sign a player who is a Manager."
    );

  }

} catch (err) {

  console.error("Manager role check error:", err);

}

    // NO SELF SIGN

    if (interaction.user.id === player.id) {

      return interaction.editReply(
        "You cannot sign yourself."
      );
    }

    // MANAGER CHECK

    const managerId = storage.teamManagers?.[team];

    if (!managerId) {

      return interaction.editReply(
        "This team has no manager assigned."
      );
    }

    if (interaction.user.id !== managerId) {

      return interaction.editReply(
        "You are not the manager of this team."
      );
    }

    // MAX 3 EMERGENCIES

    const used = storage.emergencyUses[team] || 0;

    if (used >= 3) {

      return interaction.editReply(
        "This team already used all 3 emergency contracts."
      );
    }

// CHECK GOOGLE SHEETS
const alreadySigned = await playerExistsInSheets(player.id);

if (alreadySigned) {

  return interaction.editReply(
    "Player already has a team."
  );

}

    const emoji = config.teams[team] || "🏴";

    const row = new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId(
          `emergency_accept:${player.id}:${team}:${position}:${interaction.user.id}:${region}`
        )
        .setLabel("Accept Emergency Contract")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🚨"),

      new ButtonBuilder()
        .setCustomId(
          `emergency_decline:${player.id}:${team}:${position}:${interaction.user.id}:${region}`
        )
        .setLabel("Decline Emergency Contract")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌")
    );

    const playerAvatar =
      interaction.client.users.cache.get(player.id)?.displayAvatarURL({
        size: 512,
        extension: 'png'
      }) || "https://cdn.discordapp.com/embed/avatars/0.png";

    const embed = {

      color: 0xffaa00,

      title: "🚨 Emergency Contract Offer",

      description:
`**${interaction.user}** has sent you an emergency contract offer

**Position:** ${position}
**Region:** ${region}`,

      fields: [
        {
          name: "Player",
          value: `${player}`,
          inline: true
        },
        {
          name: "Team",
          value: `${emoji} ${team}`,
          inline: true
        },
        {
          name: "Manager",
          value: `${interaction.user}`,
          inline: true
        }
      ],

      thumbnail: {
        url: playerAvatar
      },
    };

    try {

      await player.send({
        content: `${player}, **${interaction.user.username}** has sent you an emergency contract in ${config.leagueName}!`,
        embeds: [embed],
        components: [row]
      });

    } catch {

      return interaction.editReply(
        "Couldn't DM this player."
      );
    }

    await interaction.editReply(
      `Emergency contract sent successfully (${used + 1}/3 used)`
    );
  }
};