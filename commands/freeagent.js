const { SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('freeagent')
    .setDescription('Post Free Agent')

    .addStringOption(o =>
      o.setName('position')
        .setDescription('Player position')
        .setRequired(true)
        .addChoices(
          { name: 'GK', value: 'GK' },
          { name: 'CB', value: 'CB' },
          { name: 'MC', value: 'MC' },
          { name: 'ST', value: 'ST' },
        )
    )

    .addStringOption(o =>
      o.setName('information')
        .setDescription('Extra info')
        .setRequired(false)
    ),

  async execute(interaction) {

    const user = interaction.user;
    const member = interaction.member;

    const position = interaction.options.getString('position');
    const info = interaction.options.getString('information') || 'No info';

    const displayName = member.nickname || user.username;

    const parts = displayName.trim().split(/\s+/);

    let robloxId = null;
    let robloxName = displayName;

    // Si el último argumento es número → usarlo
    if (!isNaN(parts[parts.length - 1])) {

      robloxId = parts.pop();
      robloxName = parts.join(' ');

    } else {

      // Buscar ID automáticamente usando username
      robloxName = displayName;

      try {

        const response = await fetch('https://users.roblox.com/v1/usernames/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            usernames: [robloxName],
            excludeBannedUsers: false
          })
        });

        const data = await response.json();

        if (data.data && data.data.length > 0) {
          robloxId = data.data[0].id.toString();
        }

      } catch (err) {
        console.error('Error buscando usuario Roblox:', err);
      }
    }

    const channel = interaction.guild.channels.cache.find(config.channels.free_agency); 

    if (!channel) {
      return interaction.reply({
        content: 'No encontré el canal "free_agency"',
        ephemeral: true
      });
    }

    const embed = {
      color: 0x64686e,
      title: robloxName,
      description: `**Free Agent**`,

      fields: [
        {
          name: "Roblox",
          value: robloxId
            ? `[**${robloxName}**](https://www.roblox.com/users/${robloxId}/profile)`
            : `**${robloxName}**`,
          inline: true
        },
        {
          name: "Discord",
          value: `<@${user.id}>`,
          inline: true
        },
        {
          name: "Position",
          value: position,
          inline: true
        },
        {
          name: "Information",
          value: info,
          inline: false
        }
      ],

      thumbnail: {
        url: user.displayAvatarURL({ size: 512, extension: 'png' })
      },

      timestamp: new Date().toISOString()
    };

    await channel.send({ embeds: [embed] });

    await interaction.reply({
      content: "✅ Free Agent sent",
      ephemeral: true
    });
  }
};