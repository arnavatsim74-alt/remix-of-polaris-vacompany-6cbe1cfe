import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nacl from "npm:tweetnacl@1.0.3";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!DISCORD_PUBLIC_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Required: DISCORD_PUBLIC_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const toHexBytes = (value: string) => {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < value.length; i += 2) bytes[i / 2] = parseInt(value.slice(i, i + 2), 16);
  return bytes;
};

const verifyDiscordRequest = async (req: Request, rawBody: string) => {
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  if (!signature || !timestamp || !DISCORD_PUBLIC_KEY) return false;

  const encoder = new TextEncoder();
  return nacl.sign.detached.verify(encoder.encode(timestamp + rawBody), toHexBytes(signature), toHexBytes(DISCORD_PUBLIC_KEY));
};

const parseOptions = (options: any[] = []) => {
  const map: Record<string, any> = {};
  for (const opt of options) map[opt.name] = opt.value;
  return map;
};

const toDiscordDate = (iso: string) => `<t:${Math.floor(new Date(iso).getTime() / 1000)}:f>`;

const getCurrentWeekStartISO = () => {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  now.setDate(now.getDate() - dow);
  now.setHours(0, 0, 0, 0);
  return now.toISOString().slice(0, 10);
};

const getOperators = async () => {
  const { data } = await supabase.from("site_settings").select("value").eq("key", "pirep_operators").maybeSingle();
  const raw = data?.value || "RAM,SU,ATR";
  return raw.split(",").map((x: string) => x.trim()).filter(Boolean).slice(0, 25);
};

const searchAircraft = async (query: string) => {
  let request = supabase.from("aircraft").select("icao_code,name").order("icao_code").limit(25);
  const q = query.trim();
  if (q) request = request.or(`icao_code.ilike.%${q}%,name.ilike.%${q}%`);
  const { data, error } = await request;
  if (error) {
    console.error("Failed to fetch aircraft for autocomplete", error);
    return [];
  }
  return data || [];
};

const getMultipliers = async () => {
  const { data } = await supabase.from("multiplier_configs").select("name,value").eq("is_active", true).order("value", { ascending: true });
  return (data || [])
    .map((m: any) => ({ name: String(m.name || "").trim(), value: Number(m.value || 1) }))
    .filter((m: any) => m.name && Number.isFinite(m.value))
    .slice(0, 25);
};

const resolveMultiplierValue = async (input: string | null | undefined) => {
  if (!input) return 1;
  const normalizedInput = String(input).trim();
  if (!normalizedInput) return 1;

  const parsed = Number(normalizedInput);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;

  const multipliers = await getMultipliers();
  return (
    multipliers.find((m: any) => m.name.toLowerCase() === normalizedInput.toLowerCase())?.value ||
    multipliers.find((m: any) => `${m.name} (${m.value.toFixed(1)}x)`.toLowerCase() === normalizedInput.toLowerCase())?.value ||
    1
  );
};

const resolvePilotByDiscordUser = async (discordUserId: string, discordUsername?: string | null) => {
  const { data: identities } = await supabase.schema("auth").from("identities").select("user_id").eq("provider", "discord").eq("provider_id", discordUserId).limit(1);
  const authUserId = identities?.[0]?.user_id;
  if (authUserId) {
    const { data } = await supabase.from("pilots").select("id,pid,full_name").eq("user_id", authUserId).maybeSingle();
    if (data?.id) return data;
  }

  const { data: legacy } = await supabase.from("pilots").select("id,pid,full_name").eq("discord_user_id", discordUserId).maybeSingle();
  if (legacy?.id) return legacy;

  if (discordUsername) {
    const normalized = String(discordUsername).replace(/^@+/, "").trim();
    const { data } = await supabase.from("pilots").select("id,pid,full_name").ilike("discord_username", normalized).maybeSingle();
    if (data?.id) return data;
  }

  return null;
};

const getPilotFromInteraction = async (body: any) => {
  const discordUserId = body.member?.user?.id || body.user?.id;
  if (!discordUserId) return null;
  const discordUsername = body.member?.user?.username || body.user?.username || null;
  return resolvePilotByDiscordUser(discordUserId, discordUsername);
};

const handlePirep = async (body: any) => {
  const options = parseOptions(body.data?.options || []);
  const pilot = await getPilotFromInteraction(body);

  if (!pilot?.id) {
    return Response.json({
      type: 4,
      data: { content: "No pilot profile is linked to your Discord sign-in yet. Sign in to the VA site with Discord first (or set discord username in profile settings).", flags: 64 },
    });
  }

  const multiplierValue = await resolveMultiplierValue(options.multiplier);
  const { error } = await supabase.from("pireps").insert({
    flight_number: String(options.flight_number || "").toUpperCase(),
    dep_icao: String(options.dep_icao || "").toUpperCase(),
    arr_icao: String(options.arr_icao || "").toUpperCase(),
    operator: String(options.operator || ""),
    aircraft_icao: String(options.aircraft || "").toUpperCase(),
    flight_type: String(options.flight_type || "passenger"),
    flight_hours: Number(options.flight_hours || 0),
    flight_date: options.flight_date || new Date().toISOString().slice(0, 10),
    multiplier: multiplierValue,
    pilot_id: pilot.id,
    status: "pending",
  });

  if (error) return Response.json({ type: 4, data: { content: `Failed to file PIREP: ${error.message}`, flags: 64 } });

  return Response.json({
    type: 4,
    data: {
      content: `✅ PIREP filed: **${String(options.flight_number).toUpperCase()}** (${String(options.dep_icao).toUpperCase()} → ${String(options.arr_icao).toUpperCase()})${multiplierValue !== 1 ? ` with ${multiplierValue.toFixed(1)}x multiplier` : ""}`,
      flags: 64,
    },
  });
};

const handleGetEvents = async () => {
  const now = new Date();
  const until = new Date(now);
  until.setDate(until.getDate() + 2);

  const { data: events } = await supabase
    .from("events")
    .select("id,name,description,start_time,server,dep_icao,arr_icao,banner_url,aircraft_icao,aircraft_name")
    .eq("is_active", true)
    .gte("start_time", now.toISOString())
    .lte("start_time", until.toISOString())
    .order("start_time", { ascending: true })
    .limit(5);

  if (!events?.length) return Response.json({ type: 4, data: { content: "No events in the next 2 days.", flags: 64 } });

  const embeds = events.map((event: any) => ({
    title: event.name,
    description: [event.description || "Group event", `**Route:** ${event.dep_icao} → ${event.arr_icao}`, `**Time:** ${toDiscordDate(event.start_time)}`, `**Server:** ${event.server}`, event.aircraft_icao ? `**Aircraft:** ${event.aircraft_name || event.aircraft_icao}` : ""].filter(Boolean).join("\n"),
    image: event.banner_url ? { url: event.banner_url } : undefined,
  }));

  const components = events.map((event: any) => ({ type: 1, components: [{ type: 2, style: 1, label: `Participate • ${event.dep_icao}-${event.arr_icao}`.slice(0, 80), custom_id: `event_join:${event.id}` }] }));
  return Response.json({ type: 4, data: { embeds, components, flags: 64 } });
};

const handleLeaderboard = async () => {
  const { data: pilots } = await supabase.from("pilots").select("pid,full_name,total_hours").order("total_hours", { ascending: false }).limit(10);
  if (!pilots?.length) return Response.json({ type: 4, data: { content: "Leaderboard is empty.", flags: 64 } });
  const lines = pilots.map((p: any, idx: number) => `${idx + 1}. **${p.full_name}** (${p.pid}) — ${Number(p.total_hours || 0).toFixed(1)}h`);
  return Response.json({ type: 4, data: { content: `🏆 **Leaderboard**\n${lines.join("\n")}`, flags: 64 } });
};

const handleChallengeList = async () => {
  const { data: challenges } = await supabase.from("challenges").select("id,name,description,destination_icao,image_url").eq("is_active", true).order("created_at", { ascending: false }).limit(5);
  if (!challenges?.length) return Response.json({ type: 4, data: { content: "No active challenges.", flags: 64 } });

  const embeds = challenges.map((c: any) => ({ title: c.name, description: [c.description || "", c.destination_icao ? `Destination: **${c.destination_icao}**` : ""].filter(Boolean).join("\n"), image: c.image_url ? { url: c.image_url } : undefined }));
  const components = challenges.map((c: any) => ({ type: 1, components: [{ type: 2, style: 1, label: "Participate", custom_id: `challenge_accept:${c.id}` }] }));
  return Response.json({ type: 4, data: { embeds, components, flags: 64 } });
};

const handleNotams = async () => {
  const nowIso = new Date().toISOString();
  const { data: notams } = await supabase.from("notams").select("title,content,priority").eq("is_active", true).or(`expires_at.is.null,expires_at.gte.${nowIso}`).order("created_at", { ascending: false }).limit(8);
  if (!notams?.length) return Response.json({ type: 4, data: { content: "No active NOTAMs.", flags: 64 } });
  const lines = notams.map((n: any) => `• **[${String(n.priority || "normal").toUpperCase()}] ${n.title}**\n${String(n.content).slice(0, 160)}${String(n.content).length > 160 ? "…" : ""}`);
  return Response.json({ type: 4, data: { content: `📢 **NOTAMs**\n${lines.join("\n\n")}`, flags: 64 } });
};

const handleRotw = async () => {
  const { data: rotw } = await supabase.from("routes_of_week").select("day_of_week,route:routes(route_number,dep_icao,arr_icao,aircraft_icao)").eq("week_start", getCurrentWeekStartISO()).order("day_of_week", { ascending: true });
  if (!rotw?.length) return Response.json({ type: 4, data: { content: "No routes of the week set.", flags: 64 } });
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const lines = rotw.map((r: any) => {
    const route = Array.isArray(r.route) ? r.route[0] : r.route;
    return `• **${dayNames[r.day_of_week] || "Day"}** — ${route?.route_number || "N/A"}: ${route?.dep_icao || "----"} → ${route?.arr_icao || "----"} (${route?.aircraft_icao || "N/A"})`;
  });
  return Response.json({ type: 4, data: { content: `🗺️ **Routes of the Week**\n${lines.join("\n")}`, flags: 64 } });
};

const handleFeatured = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("daily_featured_routes").select("route:routes(route_number,dep_icao,arr_icao,aircraft_icao,livery)").eq("featured_date", today).limit(5);
  if (!data?.length) return Response.json({ type: 4, data: { content: "No featured routes for today.", flags: 64 } });
  const lines = data.map((i: any) => {
    const route = Array.isArray(i.route) ? i.route[0] : i.route;
    return `• **${route?.route_number || "N/A"}** ${route?.dep_icao || "----"} → ${route?.arr_icao || "----"} | ${route?.aircraft_icao || "N/A"}${route?.livery ? ` (${route.livery})` : ""}`;
  });
  return Response.json({ type: 4, data: { content: `⭐ **Featured Routes (${today})**\n${lines.join("\n")}`, flags: 64 } });
};

const handleJoinEventButton = async (body: any, eventId: string) => {
  const pilot = await getPilotFromInteraction(body);
  if (!pilot?.id) return Response.json({ type: 4, data: { content: "No pilot mapping found. Link Discord in profile settings first.", flags: 64 } });

  const { data, error } = await supabase.rpc("register_for_event", { p_event_id: eventId, p_pilot_id: pilot.id });
  if (error) return Response.json({ type: 4, data: { content: `Could not join event: ${error.message}`, flags: 64 } });

  return Response.json({ type: 4, data: { content: `✅ Registered for event. Departure gate: **${data?.assigned_dep_gate || "TBD"}**, Arrival gate: **${data?.assigned_arr_gate || "TBD"}**`, flags: 64 } });
};

const handleAcceptChallengeButton = async (body: any, challengeId: string) => {
  const pilot = await getPilotFromInteraction(body);
  if (!pilot?.id) return Response.json({ type: 4, data: { content: "No pilot mapping found for your Discord account.", flags: 64 } });

  const { data: existing } = await supabase.from("challenge_completions").select("id").eq("pilot_id", pilot.id).eq("challenge_id", challengeId).maybeSingle();
  if (existing?.id) return Response.json({ type: 4, data: { content: "You already accepted this challenge.", flags: 64 } });

  const { error } = await supabase.from("challenge_completions").insert({ pilot_id: pilot.id, challenge_id: challengeId, status: "incomplete", completed_at: null } as any);
  if (error) return Response.json({ type: 4, data: { content: `Could not accept challenge: ${error.message}`, flags: 64 } });

  return Response.json({ type: 4, data: { content: "✅ Challenge accepted. Good luck, Captain!", flags: 64 } });
};

serve(async (req) => {
  const rawBody = await req.text();
  const valid = await verifyDiscordRequest(req, rawBody);
  if (!valid) return new Response("invalid request signature", { status: 401 });

  const body = JSON.parse(rawBody);
  if (body.type === 1) return Response.json({ type: 1 });

  if (body.type === 4) {
    const focused = body.data?.options?.find((o: any) => o.focused);
    if (!focused) return Response.json({ type: 8, data: { choices: [] } });

    if (focused.name === "operator") {
      const choices = (await getOperators()).filter((o) => o.toLowerCase().includes(String(focused.value || "").toLowerCase())).slice(0, 25).map((o) => ({ name: o, value: o }));
      return Response.json({ type: 8, data: { choices } });
    }

    if (focused.name === "aircraft") {
      const choices = (await searchAircraft(String(focused.value || ""))).map((a: any) => ({ name: `${a.icao_code} - ${a.name || "Unknown"}`.slice(0, 100), value: a.icao_code }));
      return Response.json({ type: 8, data: { choices } });
    }

    if (focused.name === "multiplier") {
      const q = String(focused.value || "").toLowerCase();
      const choices = (await getMultipliers()).filter((m: any) => m.name.toLowerCase().includes(q) || `${m.value}`.includes(q)).slice(0, 25).map((m: any) => ({ name: `${m.name} (${m.value.toFixed(1)}x)`.slice(0, 100), value: m.name }));
      return Response.json({ type: 8, data: { choices } });
    }

    return Response.json({ type: 8, data: { choices: [] } });
  }

  if (body.type === 3) {
    const customId = String(body.data?.custom_id || "");
    if (customId.startsWith("event_join:")) return handleJoinEventButton(body, customId.slice("event_join:".length));
    if (customId.startsWith("challenge_accept:")) return handleAcceptChallengeButton(body, customId.slice("challenge_accept:".length));
    return Response.json({ type: 4, data: { content: "Unknown button action.", flags: 64 } });
  }

  if (body.type === 2) {
    const commandName = body.data?.name;
    if (commandName === "pirep") return handlePirep(body);
    if (commandName === "get-events") return handleGetEvents();
    if (commandName === "leaderboard") return handleLeaderboard();
    if (commandName === "challange") return handleChallengeList();
    if (commandName === "notams") return handleNotams();
    if (commandName === "rotw") return handleRotw();
    if (commandName === "featured") return handleFeatured();
  }

  return Response.json({ type: 4, data: { content: "Unsupported command", flags: 64 } });
});
