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

const COLORS = {
  BLUE: 0x3498db,
  GREEN: 0x2ecc71,
  RED: 0xe74c3c,
  ORANGE: 0xe67e22,
} as const;

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
  return nacl.sign.detached.verify(
    encoder.encode(timestamp + rawBody),
    toHexBytes(signature),
    toHexBytes(DISCORD_PUBLIC_KEY),
  );
};

const embedResponse = ({
  title,
  description,
  color,
  fields,
  imageUrl,
  ephemeral = false,
}: {
  title: string;
  description: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  imageUrl?: string;
  ephemeral?: boolean;
}) =>
  Response.json({
    type: 4,
    data: {
      embeds: [
        {
          title,
          description,
          color,
          fields,
          image: imageUrl ? { url: imageUrl } : undefined,
          timestamp: new Date().toISOString(),
        },
      ],
      ...(ephemeral ? { flags: 64 } : {}),
    },
  });

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

const titleCaseRank = (rank: string | null | undefined) => {
  if (!rank) return "Unknown";
  return rank
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

const getOperators = async () => {
  const { data } = await supabase.from("site_settings").select("value").eq("key", "pirep_operators").maybeSingle();
  const raw = data?.value || "RAM,SU,ATR";
  return raw.split(",").map((x: string) => x.trim()).filter(Boolean).slice(0, 25);
};

const searchAircraft = async (query: string) => {
  let request = supabase.from("aircraft").select("icao_code,name,livery").order("icao_code").limit(25);
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
  const { data } = await supabase
    .from("multiplier_configs")
    .select("name,value")
    .eq("is_active", true)
    .order("value", { ascending: true });

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
  const { data: identities } = await supabase
    .schema("auth")
    .from("identities")
    .select("user_id")
    .eq("provider", "discord")
    .eq("provider_id", discordUserId)
    .limit(1);

  const authUserId = identities?.[0]?.user_id;
  if (authUserId) {
    const { data } = await supabase.from("pilots").select("id,pid,full_name").eq("user_id", authUserId).maybeSingle();
    if (data?.id) return data;
  }

  const { data: legacy } = await supabase
    .from("pilots")
    .select("id,pid,full_name")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();
  if (legacy?.id) return legacy;

  if (discordUsername) {
    const normalized = String(discordUsername).replace(/^@+/, "").trim();
    const { data } = await supabase
      .from("pilots")
      .select("id,pid,full_name")
      .ilike("discord_username", normalized)
      .maybeSingle();
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

const pickGate = (available: string[] | null, used: Set<string>) => {
  if (!available?.length) return null;
  const gate = available.find((g) => !!g && !used.has(g)) || available[0];
  return gate || null;
};

const joinEventWithFallback = async (eventId: string, pilotId: string, discordUserId?: string | null) => {
  const { data: existing } = await supabase
    .from("event_registrations")
    .select("assigned_dep_gate,assigned_arr_gate")
    .eq("event_id", eventId)
    .eq("pilot_id", pilotId)
    .maybeSingle();

  if (existing) {
    if (discordUserId) {
      await supabase
        .from("event_registrations")
        .update({ discord_user_id: discordUserId })
        .eq("event_id", eventId)
        .eq("pilot_id", pilotId)
        .is("discord_user_id", null);
    }
    return existing;
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("register_for_event", {
    p_event_id: eventId,
    p_pilot_id: pilotId,
  });

  if (!rpcError) {
    if (discordUserId) {
      await supabase
        .from("event_registrations")
        .update({ discord_user_id: discordUserId })
        .eq("event_id", eventId)
        .eq("pilot_id", pilotId)
        .is("discord_user_id", null);
    }
    return rpcData;
  }

  if (!String(rpcError.message || "").toLowerCase().includes("not allowed")) {
    throw rpcError;
  }

  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("available_dep_gates,available_arr_gates")
    .eq("id", eventId)
    .maybeSingle();

  if (eventErr || !event) throw rpcError;

  const { data: regs, error: regsErr } = await supabase
    .from("event_registrations")
    .select("assigned_dep_gate,assigned_arr_gate")
    .eq("event_id", eventId);

  if (regsErr) throw regsErr;

  const usedDep = new Set((regs || []).map((r: any) => r.assigned_dep_gate).filter(Boolean));
  const usedArr = new Set((regs || []).map((r: any) => r.assigned_arr_gate).filter(Boolean));

  const assigned_dep_gate = pickGate((event as any).available_dep_gates || null, usedDep);
  const assigned_arr_gate = pickGate((event as any).available_arr_gates || null, usedArr);

  const { data: inserted, error: insertErr } = await supabase
    .from("event_registrations")
    .insert({
      event_id: eventId,
      pilot_id: pilotId,
      assigned_dep_gate,
      assigned_arr_gate,
      registered_at: new Date().toISOString(),
      discord_user_id: discordUserId || null,
    })
    .select("assigned_dep_gate,assigned_arr_gate")
    .maybeSingle();

  if (insertErr) throw insertErr;
  return inserted;
};

const handlePirep = async (body: any) => {
  const options = parseOptions(body.data?.options || []);
  const pilot = await getPilotFromInteraction(body);

  if (!pilot?.id) {
    return embedResponse({
      title: "PIREP Filing Failed",
      description: "No pilot profile is linked to your Discord account. Sign in on the VA site with Discord (or set Discord username in profile settings).",
      color: COLORS.RED,
    });
  }

  const multiplierValue = await resolveMultiplierValue(options.multiplier);
  const selectedAircraftIcao = String(options.aircraft || "").toUpperCase();
  const { data: selectedAircraft } = await supabase
    .from("aircraft")
    .select("icao_code,livery")
    .eq("icao_code", selectedAircraftIcao)
    .maybeSingle();
  const aircraftWithLivery = `${selectedAircraftIcao}${selectedAircraft?.livery ? ` (${selectedAircraft.livery})` : ""}`;

  const { error } = await supabase.from("pireps").insert({
    flight_number: String(options.flight_number || "").toUpperCase(),
    dep_icao: String(options.dep_icao || "").toUpperCase(),
    arr_icao: String(options.arr_icao || "").toUpperCase(),
    operator: String(options.operator || ""),
    aircraft_icao: selectedAircraftIcao,
    flight_type: String(options.flight_type || "passenger"),
    flight_hours: Number(options.flight_hours || 0),
    flight_date: options.flight_date || new Date().toISOString().slice(0, 10),
    multiplier: multiplierValue,
    pilot_id: pilot.id,
    status: "pending",
  });

  if (error) {
    return embedResponse({
      title: "PIREP Filing Failed",
      description: error.message,
      color: COLORS.RED,
    });
  }

  return embedResponse({
    title: "PIREP Filed Successfully",
    description: `**${String(options.flight_number).toUpperCase()}** • ${String(options.dep_icao).toUpperCase()} → ${String(options.arr_icao).toUpperCase()}`,
    color: COLORS.GREEN,
    fields: [
      { name: "Pilot", value: pilot.full_name, inline: true },
      { name: "Aircraft", value: aircraftWithLivery || "N/A", inline: true },
      { name: "Operator", value: String(options.operator || "N/A"), inline: true },
      { name: "Hours", value: `${Number(options.flight_hours || 0).toFixed(1)}h`, inline: true },
      { name: "Multiplier", value: `${multiplierValue.toFixed(1)}x`, inline: true },
      { name: "Status", value: "Pending Review", inline: true },
    ],
  });
};

const handleGetEvents = async () => {
  const now = new Date();
  const until = new Date(now);
  until.setDate(until.getDate() + 2);

  const { data: events } = await supabase
    .from("events")
    .select("id,name,description,start_time,end_time,server,dep_icao,arr_icao,banner_url,aircraft_icao,aircraft_name")
    .eq("is_active", true)
    .gte("start_time", now.toISOString())
    .lte("start_time", until.toISOString())
    .order("start_time", { ascending: true })
    .limit(5);

  if (!events?.length) {
    return embedResponse({
      title: "Upcoming Events",
      description: "No events scheduled in the next 2 days.",
      color: COLORS.BLUE,
    });
  }

  const embeds = events.map((event: any) => ({
    title: `✈️ ${event.name}`,
    description: event.description || "Join this upcoming community event.",
    color: COLORS.BLUE,
    fields: [
      { name: "Route", value: `${event.dep_icao} → ${event.arr_icao}`, inline: true },
      { name: "Server", value: event.server, inline: true },
      { name: "Start", value: toDiscordDate(event.start_time), inline: false },
      { name: "End", value: toDiscordDate(event.end_time), inline: false },
      { name: "Aircraft", value: event.aircraft_name || event.aircraft_icao || "Any", inline: true },
    ],
    image: event.banner_url ? { url: event.banner_url } : undefined,
    footer: { text: "Use the Participate button below to auto-assign your gates." },
  }));

  const components = events.map((event: any) => ({
    type: 1,
    components: [
      {
        type: 2,
        style: 1,
        label: `Participate • ${event.dep_icao}-${event.arr_icao}`.slice(0, 80),
        custom_id: `event_join:${event.id}`,
      },
    ],
  }));

  return Response.json({ type: 4, data: { embeds, components } });
};

const handleLeaderboard = async () => {
  const { data: pilots, error } = await supabase
    .from("pilots")
    .select("pid,full_name,total_hours,current_rank")
    .order("total_hours", { ascending: false })
    .limit(5);

  if (error) {
    return embedResponse({ title: "Leaderboard Error", description: error.message, color: COLORS.RED });
  }

  if (!pilots?.length) {
    return embedResponse({ title: "Leaderboard", description: "No pilots found.", color: COLORS.BLUE });
  }

  const lines = pilots
    .map((p: any, idx: number) => `${idx + 1}. **${p.full_name}** (${p.pid}) • ${titleCaseRank(p.current_rank)} • ${Number(p.total_hours || 0).toFixed(1)}h`)
    .join("\n");

  return embedResponse({
    title: "🏆 Top 5 Pilot Leaderboard",
    description: lines,
    color: COLORS.BLUE,
  });
};

const handleChallengeList = async () => {
  const { data: challenges } = await supabase
    .from("challenges")
    .select("id,name,description,destination_icao,image_url")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!challenges?.length) {
    return embedResponse({ title: "Challenges", description: "No active challenges right now.", color: COLORS.BLUE });
  }

  const embeds = challenges.map((c: any) => ({
    title: `🎯 ${c.name}`,
    description: c.description || "Community challenge",
    color: COLORS.BLUE,
    fields: c.destination_icao ? [{ name: "Destination", value: c.destination_icao, inline: true }] : [],
    image: c.image_url ? { url: c.image_url } : undefined,
  }));

  const components = challenges.map((c: any) => ({
    type: 1,
    components: [{ type: 2, style: 1, label: "Participate", custom_id: `challenge_accept:${c.id}` }],
  }));

  return Response.json({ type: 4, data: { embeds, components } });
};

const notamColor = (priority: string | null | undefined) => {
  const p = String(priority || "").toLowerCase();
  if (p.includes("urgent") || p.includes("important")) return COLORS.RED;
  if (p.includes("warning")) return COLORS.ORANGE;
  return COLORS.BLUE;
};

const handleNotams = async () => {
  const nowIso = new Date().toISOString();
  const { data: notams } = await supabase
    .from("notams")
    .select("title,content,priority")
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(8);

  if (!notams?.length) {
    return embedResponse({ title: "NOTAMs", description: "No active NOTAMs.", color: COLORS.BLUE });
  }

  const embeds = notams.map((n: any) => ({
    title: `📢 ${n.title}`,
    description: String(n.content || "").slice(0, 350),
    color: notamColor(n.priority),
    fields: [{ name: "Priority", value: String(n.priority || "info").toUpperCase(), inline: true }],
  }));

  return Response.json({ type: 4, data: { embeds } });
};

const handleRotw = async () => {
  const { data: rotw } = await supabase
    .from("routes_of_week")
    .select("day_of_week,route:routes(route_number,dep_icao,arr_icao,aircraft_icao,livery,est_flight_time_minutes)")
    .eq("week_start", getCurrentWeekStartISO())
    .order("day_of_week", { ascending: true });

  if (!rotw?.length) {
    return embedResponse({ title: "Routes of the Week", description: "No routes are configured for this week.", color: COLORS.BLUE });
  }

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const lines = rotw.map((r: any) => {
    const route = Array.isArray(r.route) ? r.route[0] : r.route;
    return `**${dayNames[r.day_of_week] || "Day"}** — **${route?.route_number || "N/A"}** | ${route?.dep_icao || "----"} → ${route?.arr_icao || "----"} | ${route?.aircraft_icao || "N/A"}${route?.livery ? ` (${route.livery})` : ""} | ${route?.est_flight_time_minutes ? `${Math.floor(route.est_flight_time_minutes / 60)}:${String(route.est_flight_time_minutes % 60).padStart(2, "0")}` : "N/A"}`;
  });

  return embedResponse({ title: "🗺️ Routes of the Week", description: lines.join("\n"), color: COLORS.BLUE });
};

const handleFeatured = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("daily_featured_routes")
    .select("route:routes(route_number,dep_icao,arr_icao,aircraft_icao,livery)")
    .eq("featured_date", today)
    .limit(5);

  if (!data?.length) {
    return embedResponse({ title: "Featured Routes", description: "No featured routes for today.", color: COLORS.BLUE });
  }

  const lines = data.map((item: any) => {
    const route = Array.isArray(item.route) ? item.route[0] : item.route;
    return `• **${route?.route_number || "N/A"}** ${route?.dep_icao || "----"} → ${route?.arr_icao || "----"} | ${route?.aircraft_icao || "N/A"}${route?.livery ? ` (${route.livery})` : ""}`;
  });

  return embedResponse({ title: `⭐ Featured Routes (${today})`, description: lines.join("\n"), color: COLORS.BLUE });
};

const handleJoinEventButton = async (body: any, eventId: string) => {
  const pilot = await getPilotFromInteraction(body);
  if (!pilot?.id) {
    return embedResponse({ title: "Event Join Failed", description: "No pilot mapping found. Link Discord in profile settings first.", color: COLORS.RED });
  }

  try {
    const discordUserId = body.member?.user?.id || body.user?.id || null;
    const data = await joinEventWithFallback(eventId, pilot.id, discordUserId);

    // user-only plain confirmation (not embed) per requirement
    return Response.json({
      type: 4,
      data: {
        content: `✅ Joined event. Departure gate: ${data?.assigned_dep_gate || "TBD"}, Arrival gate: ${data?.assigned_arr_gate || "TBD"}`,
        flags: 64,
      },
    });
  } catch (error: any) {
    return embedResponse({
      title: "Event Join Failed",
      description: error?.message || "Could not join event.",
      color: COLORS.RED,
    });
  }
};

const handleAcceptChallengeButton = async (body: any, challengeId: string) => {
  const pilot = await getPilotFromInteraction(body);
  if (!pilot?.id) {
    return Response.json({
      type: 4,
      data: {
        content: "⚠️ No pilot mapping found for your Discord account.",
        flags: 64,
      },
    });
  }

  const { data: existing } = await supabase
    .from("challenge_completions")
    .select("id")
    .eq("pilot_id", pilot.id)
    .eq("challenge_id", challengeId)
    .maybeSingle();

  if (!existing?.id) {
    const { error } = await supabase.from("challenge_completions").insert({
      pilot_id: pilot.id,
      challenge_id: challengeId,
      status: "incomplete",
      completed_at: null,
    } as any);

    if (error) {
      return Response.json({
        type: 4,
        data: {
          content: `⚠️ Challenge action failed: ${error.message}`,
          flags: 64,
        },
      });
    }
  }

  // user-only plain confirmation (not embed) per requirement
  return Response.json({
    type: 4,
    data: {
      content: "✅ Challenge accepted.",
      flags: 64,
    },
  });
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
      const choices = (await getOperators())
        .filter((o) => o.toLowerCase().includes(String(focused.value || "").toLowerCase()))
        .slice(0, 25)
        .map((o) => ({ name: o, value: o }));
      return Response.json({ type: 8, data: { choices } });
    }

    if (focused.name === "aircraft") {
      const choices = (await searchAircraft(String(focused.value || ""))).map((a: any) => ({
        name: `${a.icao_code} - ${a.name || "Unknown"}${a.livery ? ` (${a.livery})` : ""}`.slice(0, 100),
        value: a.icao_code,
      }));
      return Response.json({ type: 8, data: { choices } });
    }

    if (focused.name === "multiplier") {
      const q = String(focused.value || "").toLowerCase();
      const choices = (await getMultipliers())
        .filter((m: any) => m.name.toLowerCase().includes(q) || `${m.value}`.includes(q))
        .slice(0, 25)
        .map((m: any) => ({ name: `${m.name} (${m.value.toFixed(1)}x)`.slice(0, 100), value: m.name }));
      return Response.json({ type: 8, data: { choices } });
    }

    return Response.json({ type: 8, data: { choices: [] } });
  }

  if (body.type === 3) {
    const customId = String(body.data?.custom_id || "");
    if (customId.startsWith("event_join:")) return handleJoinEventButton(body, customId.slice("event_join:".length));
    if (customId.startsWith("challenge_accept:")) return handleAcceptChallengeButton(body, customId.slice("challenge_accept:".length));
    return embedResponse({ title: "Action Failed", description: "Unknown button action.", color: COLORS.RED });
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

  return embedResponse({ title: "Unsupported Command", description: "This interaction type is not handled.", color: COLORS.RED });
});
