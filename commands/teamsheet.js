const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('teamsheet')
    .setDescription('Show team squad')
    .addStringOption(opt =>
      opt.setName('team')
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

    const team = interaction.options.getString('team');

    let storage;
    try {
      storage = JSON.parse(fs.readFileSync('./storage.json', 'utf-8'));
    } catch {
      storage = { squads: {}, teamManagers: {} };
    }

    const managerId = storage.teamManagers?.[team];

const squad = (storage.squads?.[team] || [])
  .filter(id => id !== managerId);

const emoji = config.teams[team] || "🏴";

// NO PLAYERS / NO MANAGER
if (!managerId && squad.length === 0) {
  return interaction.reply(
    "❌ This team has no players"
  );
}

    // 🧠 HEADER
    let lines = [];

    // [M] Manager
    if (managerId) {
      lines.push(`[M] <@${managerId}>`);
    } else {
      lines.push(`[M] —`);
    }

    // 🔢 Players 1–15
    for (let i = 0; i < 15; i++) {
      const player = squad[i];
      if (player) {
        lines.push(`${i + 1}- <@${player}>`);
      } else {
        lines.push(`${i + 1}- —`);
      }
    }

    const embed = {
      color: 0x8000FF,
      title: `${emoji} ${team} Squad`,
      description: lines.join('\n'),
      footer: {
        text: `Roster: ${squad.length}/16`
      }
    };

    await interaction.reply({ embeds: [embed] });
  }
};