import "dotenv/config";
import express from "express";
import {
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

const required = ["DISCORD_TOKEN", "DISCORD_APPLICATION_ID", "ACADEMY_SHARED_SECRET"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing Railway variable: ${name}`);
}

const commandChannelId = process.env.ACADEMY_COMMAND_CHANNEL_ID;
const auditChannelId = process.env.ACADEMY_AUDIT_CHANNEL_ID;
const staffRoleIds = new Set((process.env.ACADEMY_STAFF_ROLE_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
const commands = [];
let nextCommandId = 1;

const commandDefinitions = [
  new SlashCommandBuilder().setName("academy-status").setDescription("Check the Discord to Roblox command bridge."),
  new SlashCommandBuilder().setName("view-progress").setDescription("View an online trainee's current academy progress.")
    .addStringOption((option) => option.setName("username").setDescription("Exact Roblox username").setRequired(true)),
  new SlashCommandBuilder().setName("promote").setDescription("Promote an online trainee by one academy rank.")
    .addStringOption((option) => option.setName("username").setDescription("Exact Roblox username").setRequired(true)),
  new SlashCommandBuilder().setName("reset-progress").setDescription("Reset an online trainee's academy progress.")
    .addStringOption((option) => option.setName("username").setDescription("Exact Roblox username").setRequired(true)),
  new SlashCommandBuilder().setName("skip-module").setDescription("Mark one module complete for an online trainee.")
    .addStringOption((option) => option.setName("username").setDescription("Exact Roblox username").setRequired(true))
    .addStringOption((option) => option.setName("module").setDescription("Module to complete").setRequired(true)
      .addChoices(
        { name: "Rules Training", value: "Module1" },
        { name: "Scenario Training", value: "Module2" },
        { name: "Commands Training", value: "Module3" },
        { name: "Final Test", value: "Module4" },
      )),
  new SlashCommandBuilder().setName("send-lobby").setDescription("Return an online player to the academy lobby.")
    .addStringOption((option) => option.setName("username").setDescription("Exact Roblox username").setRequired(true)),
].map((command) => command.toJSON());

function isAuthorized(interaction) {
  if (commandChannelId && interaction.channelId !== commandChannelId) return false;
  if (staffRoleIds.size === 0) return interaction.memberPermissions?.has("Administrator") ?? false;
  return interaction.member?.roles?.cache?.some((role) => staffRoleIds.has(role.id)) ?? false;
}

function queueCommand(interaction, action, username, moduleId = null) {
  const request = {
    id: String(nextCommandId++),
    action,
    username,
    moduleId,
    requestedBy: interaction.user.tag,
    requestedAt: new Date().toISOString(),
  };
  commands.push(request);
  return request;
}

async function writeAudit(client, title, description, color = 0x9b59ff) {
  if (!auditChannelId) return;
  const channel = await client.channels.fetch(auditChannelId).catch(() => null);
  if (!channel?.isTextBased() || channel.type === ChannelType.DM) return;
  await channel.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp()] }).catch(() => null);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (readyClient) => {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (guildId) {
    // Remove the previous global registration so Discord does not show duplicates.
    await rest.put(Routes.applicationCommands(applicationId), { body: [] });
  }
  const registrationRoute = guildId
    ? Routes.applicationGuildCommands(applicationId, guildId)
    : Routes.applicationCommands(applicationId);
  await rest.put(registrationRoute, { body: commandDefinitions });
  console.log(`Discord bot ready as ${readyClient.user.tag}`);
  await writeAudit(readyClient, "Academy Bot Online", "The Discord command bridge is ready.", 0x57f287);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!isAuthorized(interaction)) {
    await interaction.reply({ content: "You do not have permission to use Academy commands here.", ephemeral: true });
    return;
  }

  if (interaction.commandName === "academy-status") {
    await interaction.reply({ content: `Bridge online. ${commands.length} command(s) waiting for a live Roblox server.`, ephemeral: true });
    return;
  }

  const username = interaction.options.getString("username", true).trim();
  const actionByName = {
    "view-progress": "ViewProgress",
    promote: "PromotePlayer",
    "reset-progress": "ResetProgress",
    "skip-module": "SkipModule",
    "send-lobby": "SendToLobby",
  };
  const request = queueCommand(interaction, actionByName[interaction.commandName], username, interaction.options.getString("module"));
  await interaction.reply({ content: `Queued **${interaction.commandName}** for **${username}**. It will run when that player is in a live server.`, ephemeral: true });
  await writeAudit(client, "Discord Command Queued", `**${interaction.user.tag}** queued \`${request.action}\` for **${username}**.`);
});

const app = express();
app.use(express.json({ limit: "100kb" }));

function verifyRoblox(req, res, next) {
  if (req.get("x-api-key") !== process.env.ACADEMY_SHARED_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

app.get("/health", (_req, res) => res.json({ ok: true, queued: commands.length }));

app.get("/roblox/commands", verifyRoblox, (_req, res) => {
  // A command is removed only once a live Roblox server has collected it.
  const batch = commands.splice(0, 10);
  res.json({ commands: batch });
});

app.post("/roblox/results", verifyRoblox, async (req, res) => {
  const results = Array.isArray(req.body?.results) ? req.body.results : [];
  for (const result of results) {
    const color = result.status === "success" ? 0x57f287 : 0xed4245;
    await writeAudit(client, "Roblox Command Result", `\`${result.action || "Unknown"}\` for **${result.username || "Unknown"}**: ${result.message || result.status}`, color);
  }
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => console.log("HTTP bridge listening"));
client.login(process.env.DISCORD_TOKEN);
