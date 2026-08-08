const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('friendly')
    .setDescription('Find a friendly')
    .addStringOption(opt =>
      opt.setName('information')
        .setDescription('Friendly information')
        .setRequired(true)
    ),

  async execute(interaction) {

    const information = interaction.options.getString('information');

    const embed = new EmbedBuilder()
      .setColor(0x00ff44)
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setDescription(
        `⚽ **Looking for a Friendly Match!**\n\n` +
        information
      )
      .setFooter({
        text: `Friendly Request`
      })
      .setTimestamp();

    const channel = interaction.client.channels.cache.get(config.channels.friendlies);

    await interaction.reply({
      content: '✅ Friendly sent',
      ephemeral: true
    });

      await channel.send({
      content: `<@&${config.roles.FriendlyP}> 🤝 New friendly by ${interaction.user}!`,
      embeds: [embed]
    });
  }
};