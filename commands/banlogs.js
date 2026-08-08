const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const config = require('../config.json');
const fs = require('fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banlogs')
    .setDescription('Show all sanction logs (STAFF ONLY)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {

    // 🔐 ROLE CHECK
    if (!interaction.member.roles.cache.has(config.roles.Staff)) {
      return interaction.reply({
        content: "You do not have permission to run this command",
        ephemeral: true
      });
    }

    let storage;
    try {
      storage = JSON.parse(fs.readFileSync('./storage.json', 'utf-8'));
    } catch {
      storage = { bans: [] };
    }

    const bans = storage.bans || [];

    if (bans.length === 0) {
      return interaction.reply({
        content: "📭 No sanctions found.",
        ephemeral: true
      });
    }

    const description = bans
      .slice()
      .reverse()
      .map((b, i) => {

        const typeEmoji =
          b.type === "permanent" ? "🔴" :
          b.type === "blacklist" ? "⚫" : "🟠";

        return (
          `**#${i + 1} ${typeEmoji} ${b.type.toUpperCase()}**\n` +
          `👤 <@${b.userId}>\n` +
          `📝 ${b.reason}\n` +
          `⏳ ${b.time || "N/A"}\n`
        );
      })
      .join("\n");

    const finalDesc = description.length > 4000
      ? description.slice(0, 4000) + "\n...\n(more logs truncated)"
      : description;

    const embed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setTitle("📋 Ban Logs (All Time)")
      .setDescription(finalDesc)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};