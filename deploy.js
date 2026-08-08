require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('fs');

const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// Cargar comandos
const commands = [];
const files = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));

for (const file of files) {
  console.log("📄 cargando:", file);

  const command = require(`./commands/${file}`);

  if (!command?.data) {
    console.log("❌ SIN DATA:", file);
    continue;
  }

  try {
    commands.push(command.data.toJSON());
    console.log("✔ OK:", file);
  } catch (err) {
    console.log("💥 ERROR EN:", file);
    console.error(err);
    process.exit(1);
  }
}

// REST con token desde Render / env
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("🚀 Registrando comandos...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ Comandos registrados!");
  } catch (error) {
    console.error("❌ Error registrando comandos:", error);
  }
})();