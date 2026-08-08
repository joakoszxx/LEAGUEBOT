const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency'),

  async execute(interaction, client) {

    const sent = await interaction.reply({
      content: "🏓 Pinging...",
      fetchReply: true
    });

    const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = client.ws.ping;
    
    const embed = new EmbedBuilder()
      .setColor(0x8000FF)
      .setTitle("🏓 Pong!")
      .addFields(
        { name: "📡 Latency", value: `${roundtripLatency}ms`, inline: true },
        { name: "💓 API", value: `${wsLatency}ms`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({
      content: null,
      embeds: [embed]
    });
  }
};