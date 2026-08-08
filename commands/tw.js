const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');
const config = require('../config.json');
const fs = require('fs');

const ALLOWED_ROLE = config.roles.Staff;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tw')
    .setDescription('Open or close transfer window (STAFF ONLY)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('state')
        .setDescription('State')
        .setRequired(true)
        .addChoices(
          { name: 'opened', value: 'opened' },
          { name: 'closed', value: 'closed' }
        )
    ),

  async execute(interaction) {

    // verificar rol
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE)) {
      return interaction.reply({
        content: "You do not have the permission to run this command",
        ephemeral: true
      });
    }

    const state = interaction.options.getString('state');

    let storage = JSON.parse(fs.readFileSync('./storage.json'));

    storage.tw = state;

    fs.writeFileSync('./storage.json', JSON.stringify(storage, null, 2));

    await interaction.reply(`${interaction.user} has ${state} the Transfer Window!`);
  }
};