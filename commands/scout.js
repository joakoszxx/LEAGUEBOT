const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const config = require('../config.json');
const fs = require('fs');
const SCOUT_PING_ROLE = config.roles.ScoutP;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scout')
    .setDescription('Create a scout announcement')
    .addStringOption(option =>
      option
        .setName('info')
        .setDescription('Scout information')
        .setRequired(true)
    ),

  async execute(interaction) {

    let storage;
    try {
      storage = JSON.parse(
        fs.readFileSync('./storage.json', 'utf8')
      );
    } catch {
      storage = { teamManagers: {} };
    }

    // Buscar si el usuario es DT
    const isManager = Object.values(
      storage.teamManagers || {}
    ).includes(interaction.user.id);

    if (!isManager) {
      return interaction.reply({
        content: '❌ Only registered managers can use this command.',
        ephemeral: true
      });
    }

    const info =
      interaction.options.getString('info');

    const member =
      await interaction.guild.members.fetch(
        interaction.user.id
      );

    const embed = new EmbedBuilder()
      .setColor(0x8000FF)
      .setAuthor({
        name: member.displayName,
        iconURL: member.displayAvatarURL()
      })
      .setDescription(info)
      .setFooter({
        text: `${config.leagueName} • ${new Date().toLocaleString('en-US')}`
      });

    const scoutChannel =
      await interaction.client.channels.fetch(
        config.channels.scouting
      );

await scoutChannel.send({
  content: `<@&${SCOUT_PING_ROLE}> 🔎 New scout by ${interaction.user}!`,
  embeds: [embed]
});

    await interaction.reply({
      content: '✅ Scout published',
      ephemeral: true
    });
  }
};