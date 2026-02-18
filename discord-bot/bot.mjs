import { Client, Events, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const {
  DISCORD_BOT_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env vars: DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const pirepCommand = new SlashCommandBuilder()
  .setName("pirep")
  .setDescription("File a PIREP directly from Discord")
  .addStringOption((o) => o.setName("flight_number").setDescription("Flight number (e.g. RAM123)").setRequired(true))
  .addStringOption((o) => o.setName("dep_icao").setDescription("Departure ICAO").setRequired(true))
  .addStringOption((o) => o.setName("arr_icao").setDescription("Arrival ICAO").setRequired(true))
  .addStringOption((o) => o.setName("operator").setDescription("Operator").setRequired(true).setAutocomplete(true))
  .addStringOption((o) => o.setName("aircraft").setDescription("Aircraft ICAO").setRequired(true).setAutocomplete(true))
  .addStringOption((o) =>
    o
      .setName("flight_type")
      .setDescription("Passenger or cargo")
      .setRequired(true)
      .addChoices({ name: "Passenger", value: "passenger" }, { name: "Cargo", value: "cargo" }),
  )
  .addNumberOption((o) => o.setName("flight_hours").setDescription("Flight time in hours").setRequired(true))
  .addStringOption((o) => o.setName("flight_date").setDescription("Date in YYYY-MM-DD (optional)").setRequired(false));

const registerCommands = async () => {
  const rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN);
  const payload = [pirepCommand.toJSON()];

  if (DISCORD_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), { body: payload });
    console.log(`Registered guild commands in ${DISCORD_GUILD_ID}`);
  } else {
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: payload });
    console.log("Registered global commands");
  }
};

const getOperators = async () => {
  const { data } = await supabase.from("site_settings").select("value").eq("key", "pirep_operators").maybeSingle();
  const raw = data?.value || "RAM,SU,ATR";
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 25);
};

const getAircraft = async () => {
  const { data } = await supabase.from("aircraft").select("icao_code,name").order("icao_code");
  return (data || []).slice(0, 1000);
};

const resolvePilotId = async (discordUserId) => {
  const { data, error } = await supabase
    .from("pilots")
    .select("id,pid,full_name")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  await registerCommands();
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused(true);

      if (focused.name === "operator") {
        const operators = await getOperators();
        const filtered = operators.filter((op) => op.toLowerCase().includes(focused.value.toLowerCase())).slice(0, 25);
        return interaction.respond(filtered.map((op) => ({ name: op, value: op })));
      }

      if (focused.name === "aircraft") {
        const aircraft = await getAircraft();
        const filtered = aircraft
          .filter((ac) => ac.icao_code.toLowerCase().includes(focused.value.toLowerCase()) || (ac.name || "").toLowerCase().includes(focused.value.toLowerCase()))
          .slice(0, 25)
          .map((ac) => ({ name: `${ac.icao_code} - ${ac.name || "Unknown"}`.slice(0, 100), value: ac.icao_code }));
        return interaction.respond(filtered);
      }

      return interaction.respond([]);
    }

    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "pirep") return;

    await interaction.deferReply({ ephemeral: true });

    const pilot = await resolvePilotId(interaction.user.id);
    if (!pilot?.id) {
      await interaction.editReply("Your Discord account is not linked to a pilot profile yet. Ask admin to set `pilots.discord_user_id` to your Discord user id.");
      return;
    }

    const flightNumber = interaction.options.getString("flight_number", true).toUpperCase().trim();
    const dep = interaction.options.getString("dep_icao", true).toUpperCase().trim();
    const arr = interaction.options.getString("arr_icao", true).toUpperCase().trim();
    const operator = interaction.options.getString("operator", true).trim();
    const aircraft = interaction.options.getString("aircraft", true).toUpperCase().trim();
    const flightType = interaction.options.getString("flight_type", true);
    const flightHours = interaction.options.getNumber("flight_hours", true);
    const flightDate = interaction.options.getString("flight_date") || new Date().toISOString().slice(0, 10);

    const { error } = await supabase.from("pireps").insert({
      flight_number: flightNumber,
      dep_icao: dep,
      arr_icao: arr,
      operator,
      aircraft_icao: aircraft,
      flight_type: flightType,
      flight_hours: flightHours,
      flight_date: flightDate,
      pilot_id: pilot.id,
      status: "pending",
    });

    if (error) {
      console.error(error);
      await interaction.editReply(`Failed to file PIREP: ${error.message}`);
      return;
    }

    await interaction.editReply(`✅ PIREP filed successfully for **${flightNumber}** (${dep} → ${arr}) as **pending** review.`);
  } catch (error) {
    console.error(error);
    if (interaction.isRepliable()) {
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply("Something went wrong while processing the command.");
        } else {
          await interaction.reply({ content: "Something went wrong while processing the command.", ephemeral: true });
        }
      } catch (_) {}
    }
  }
});

client.login(DISCORD_BOT_TOKEN);
