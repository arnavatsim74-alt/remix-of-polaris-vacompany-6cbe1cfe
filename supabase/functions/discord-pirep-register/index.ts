import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") || "";
const DISCORD_APPLICATION_ID = Deno.env.get("DISCORD_APPLICATION_ID") || "";
const REGISTER_SECRET = Deno.env.get("DISCORD_REGISTER_SECRET") || "";

if (!DISCORD_BOT_TOKEN || !DISCORD_APPLICATION_ID) {
  console.error("Missing env vars. Required: DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID");
}

const COMMANDS = [
  {
    name: "pirep",
    description: "File a PIREP",
    options: [
      { name: "flight_number", description: "Flight number (e.g. RAM123)", type: 3, required: true },
      { name: "dep_icao", description: "Departure ICAO", type: 3, required: true },
      { name: "arr_icao", description: "Arrival ICAO", type: 3, required: true },
      { name: "operator", description: "Airline/operator", type: 3, required: true, autocomplete: true },
      { name: "aircraft", description: "Aircraft ICAO code", type: 3, required: true, autocomplete: true },
      {
        name: "flight_type",
        description: "Flight type",
        type: 3,
        required: true,
        choices: [
          { name: "Passenger", value: "passenger" },
          { name: "Cargo", value: "cargo" },
          { name: "Charter", value: "charter" },
        ],
      },
      { name: "flight_hours", description: "Flight duration in hours", type: 10, required: true },
      { name: "multiplier", description: "Flight hour multiplier (from backend)", type: 3, required: false, autocomplete: true },
      { name: "flight_date", description: "Flight date (YYYY-MM-DD)", type: 3, required: false },
    ],
  },
  { name: "get-events", description: "Get events in next 2 days and join from Discord" },
  { name: "leaderboard", description: "Show pilot leaderboard" },
  { name: "challange", description: "Show active challenges and participate" },
  { name: "notams", description: "Show active NOTAMs" },
  { name: "rotw", description: "Show routes of the week" },
  { name: "featured", description: "Show featured routes for today" },
];

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!DISCORD_BOT_TOKEN || !DISCORD_APPLICATION_ID) {
    return new Response("Missing Discord env vars", { status: 500 });
  }

  if (REGISTER_SECRET) {
    const provided = req.headers.get("x-register-secret") || "";
    if (provided !== REGISTER_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const url = `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(COMMANDS),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return Response.json({ ok: false, status: response.status, error: payload }, { status: 500 });
  }

  return Response.json({ ok: true, count: Array.isArray(payload) ? payload.length : 0, commands: payload });
});
