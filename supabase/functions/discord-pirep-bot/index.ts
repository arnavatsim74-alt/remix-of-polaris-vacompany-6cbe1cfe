import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nacl from "npm:tweetnacl@1.0.3";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY") || "";
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") || "";
const DISCORD_REGISTER_SECRET = Deno.env.get("DISCORD_REGISTER_SECRET") || "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!DISCORD_PUBLIC_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Required: DISCORD_PUBLIC_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

const RECRUITMENTS_CHANNEL_ID = "1474299044091265096";
const RECRUITMENTS_CATEGORY_ID = "1426656419758870693";
const RECRUITMENT_BUTTON_CUSTOM_ID = "recruitment_fly_high";
const RECRUITMENT_CALLSIGN_BUTTON_PREFIX = "recruitment_set_callsign:";
const RECRUITMENT_CALLSIGN_MODAL_PREFIX = "recruitment_callsign_modal:";
const RECRUITMENT_PRACTICAL_READY_PREFIX = "recruitment_practical_ready:";
const RECRUITMENT_PRACTICAL_CONFIRM_PREFIX = "recruitment_practical_confirm:";
const RECRUITMENT_PRACTICAL_REVIEW_PREFIX = "recruitment_practical_review:";
const RECRUITMENT_PRACTICAL_REVIEWER_ROLE_ID = "1427942885004808263";
const RECRUITMENT_STAFF_ROLE_ID = "1427942885004808263";

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
  const { data: authUserId, error: authLookupError } = await supabase.rpc("get_auth_user_id_by_discord", {
    p_discord_user_id: discordUserId,
  });
  if (authLookupError) throw authLookupError;

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

  const eventAircraftIcaos = Array.from(
    new Set(
      (events || [])
        .map((event: any) => String(event?.aircraft_icao || "").trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  const liveryByIcao = new Map<string, string>();
  if (eventAircraftIcaos.length) {
    const { data: aircraftRows } = await supabase
      .from("aircraft")
      .select("icao_code,livery")
      .in("icao_code", eventAircraftIcaos)
      .not("livery", "is", null);

    for (const row of aircraftRows || []) {
      const icao = String((row as any).icao_code || "").trim().toUpperCase();
      const livery = String((row as any).livery || "").trim();
      if (!icao || !livery) continue;
      if (!liveryByIcao.has(icao)) liveryByIcao.set(icao, livery);
    }
  }

  const embeds = events.map((event: any) => {
    const icao = String(event?.aircraft_icao || "").trim().toUpperCase();
    const eventAircraftName = String(event?.aircraft_name || "").trim();
    const livery = liveryByIcao.get(icao);
    const aircraftDisplay = eventAircraftName
      ? eventAircraftName
      : icao
        ? `${icao}${livery ? ` (${livery})` : ""}`
        : "Any";

    return {
      title: `✈️ ${event.name}`,
      description: event.description || "Join this upcoming community event.",
      color: COLORS.BLUE,
      fields: [
        { name: "Route", value: `${event.dep_icao} → ${event.arr_icao}`, inline: true },
        { name: "Server", value: event.server, inline: true },
        { name: "Start", value: toDiscordDate(event.start_time), inline: false },
        { name: "End", value: toDiscordDate(event.end_time), inline: false },
        { name: "Aircraft", value: aircraftDisplay, inline: true },
      ],
      image: event.banner_url ? { url: event.banner_url } : undefined,
      footer: { text: "Use the Participate button below to auto-assign your gates." },
    };
  });

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


const discordApi = async (path: string, init: RequestInit = {}) => {
  if (!DISCORD_BOT_TOKEN) throw new Error("Missing DISCORD_BOT_TOKEN");
  return fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
};

const createRecruitmentEmbed = async () => {
  const response = await discordApi(`/channels/${RECRUITMENTS_CHANNEL_ID}/messages`, {
    method: "POST",
    body: JSON.stringify({
      embeds: [{
        title: "AFLV Recruitments",
        description: "Click **Fly High** to open your recruitment ticket and start your entrance written exam.",
        color: COLORS.BLUE,
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 1,
          custom_id: RECRUITMENT_BUTTON_CUSTOM_ID,
          label: "Fly High",
        }],
      }],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Failed to create recruitment embed");
  return payload;
};

const resolveAuthUserFromDiscord = async (discordUserId: string) => {
  const { data, error } = await supabase.rpc("get_auth_user_id_by_discord", {
    p_discord_user_id: discordUserId,
  });
  if (error) throw error;
  return data || null;
};

const getRecruitmentExamId = async () => {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "recruitment_exam_id")
    .maybeSingle();

  if (error) throw error;
  if (!data?.value) throw new Error("Missing site setting: recruitment_exam_id");
  return String(data.value);
};

const ensureApplication = async (userId: string, discordUserId: string, username: string) => {
  const { data: existing } = await supabase
    .from("pilot_applications")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("pilot_applications").update({ discord_user_id: discordUserId }).eq("id", existing.id);
    return existing.id;
  }

  const fallbackEmail = `${discordUserId}@users.noreply.local`;
  const { data, error } = await supabase
    .from("pilot_applications")
    .insert({
      user_id: userId,
      email: fallbackEmail,
      full_name: username,
      experience_level: "Grade 2",
      preferred_simulator: "No",
      reason_for_joining: "Recruitment flow",
      discord_username: username,
      if_grade: "Grade 2",
      is_ifatc: "No",
      ifc_trust_level: "I don't know",
      age_range: "13-16",
      other_va_membership: "No",
      hear_about_aflv: "Discord Recruitment",
      discord_user_id: discordUserId,
      status: "pending",
    } as any)
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
};

const createRecruitmentChannel = async (guildId: string, discordUserId: string, username: string) => {
  const safeUsername = username.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 40) || discordUserId;
  const channelName = `recruitment-${safeUsername}-${discordUserId.slice(-4)}`;

  const response = await discordApi(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: channelName,
      type: 0,
      parent_id: RECRUITMENTS_CATEGORY_ID,
      permission_overwrites: [
        { id: guildId, type: 0, deny: "1024", allow: "0" },
        { id: discordUserId, type: 1, allow: "1024", deny: "0" },
        { id: RECRUITMENT_STAFF_ROLE_ID, type: 0, allow: "1024", deny: "0" },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Failed to create recruitment channel");
  return payload;
};

const getLatestRecruitmentCooldown = async (discordUserId: string) => {
  const { data, error } = await supabase
    .from("recruitment_exam_sessions")
    .select("completed_at, passed")
    .eq("discord_user_id", discordUserId)
    .eq("passed", false)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.completed_at) return null;

  const completedAt = new Date(data.completed_at).getTime();
  const nextEligibleAt = completedAt + (24 * 60 * 60 * 1000);
  const now = Date.now();
  if (now >= nextEligibleAt) return null;

  return Math.ceil((nextEligibleAt - now) / (60 * 1000));
};

const getLatestRecruitmentSession = async (discordUserId: string) => {
  const withMessage = await supabase
    .from("recruitment_exam_sessions")
    .select("id, completed_at, passed, recruitment_channel_id, exam_message_id")
    .eq("discord_user_id", discordUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!withMessage.error) return withMessage.data || null;

  // Backward compatibility if newest migration not applied yet.
  const fallback = await supabase
    .from("recruitment_exam_sessions")
    .select("id, completed_at, passed, recruitment_channel_id")
    .eq("discord_user_id", discordUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallback.error) throw fallback.error;
  return fallback.data ? { ...fallback.data, exam_message_id: null } : null;
};

const verifyAdminFromAuthHeader = async (authHeader: string | null) => {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: adminRole, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError || !adminRole) return null;
  return userData.user.id;
};

const getLatestRecruitmentSessionForUser = async (userId: string) => {
  const { data: app } = await supabase
    .from("pilot_applications")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!app?.id) return null;

  const { data: session } = await supabase
    .from("recruitment_exam_sessions")
    .select("recruitment_channel_id, discord_user_id")
    .eq("application_id", app.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return session || null;
};

const applyPracticalStatus = async (practicalId: string, status: "passed" | "failed") => {
  const { data: practical, error: practicalError } = await supabase
    .from("academy_practicals")
    .select("id, pilot_id, course_id, notes, status, pilots!academy_practicals_pilot_id_fkey(id, user_id, pid, full_name, discord_user_id)")
    .eq("id", practicalId)
    .maybeSingle();

  if (practicalError || !practical?.pilots) {
    throw new Error("Practical not found");
  }

  const updatePayload: Record<string, any> = {
    status,
    completed_at: new Date().toISOString(),
    result_notes: status === "passed" ? "Passed via recruitment Discord review action" : "Failed via recruitment Discord review action",
  };

  const { error: updateError } = await supabase
    .from("academy_practicals")
    .update(updatePayload)
    .eq("id", practicalId);

  if (updateError) {
    throw updateError;
  }

  const pilot = practical.pilots as any;
  const latestSession = await getLatestRecruitmentSessionForUser(String(pilot.user_id));
  const discordUserId = String(pilot.discord_user_id || latestSession?.discord_user_id || "");
  const channelId = String(latestSession?.recruitment_channel_id || "");

  if (status === "passed") {
    if (channelId) {
      await discordApi(`/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: `🎉 Congratulations <@${discordUserId}>! You passed your practical.
Please read the Pilot Guide here: <#1428000030521823293>.`,
        }),
      }).catch(() => null);

      if (discordUserId) {
        await discordApi(`/channels/${channelId}/permissions/${discordUserId}`, {
          method: "PUT",
          body: JSON.stringify({ type: 1, allow: "0", deny: "1024" }),
        }).catch(() => null);
      }
    }

    return { action: "pass_notification_sent", practical, discordUserId, channelId };
  }

  const nextAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("academy_practicals").insert({
    pilot_id: practical.pilot_id,
    course_id: practical.course_id,
    status: "scheduled",
    scheduled_at: nextAt,
    notes: `Auto-retest after failed practical (${new Date().toISOString()})`,
  });

  if (channelId) {
    await discordApi(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content: `❌ <@${discordUserId}> practical result: failed. You have a 24-hour cooldown. A retest practical has been auto-assigned for after cooldown.`,
      }),
    }).catch(() => null);
  }

  return { action: "fail_retest_assigned", practical, discordUserId, channelId };
};

const handlePracticalStatusAction = async (body: any, authHeader: string | null) => {
  const adminUserId = await verifyAdminFromAuthHeader(authHeader);
  if (!adminUserId) return new Response("Unauthorized", { status: 401 });

  const practicalId = String(body?.practicalId || "");
  const status = String(body?.status || "");
  if (!practicalId || !["passed", "failed"].includes(status)) {
    return new Response("Invalid practical payload", { status: 400 });
  }

  try {
    const result = await applyPracticalStatus(practicalId, status as "passed" | "failed");
    return Response.json({ ok: true, action: result.action, adminUserId });
  } catch (error: any) {
    const message = error?.message || "Could not update practical status";
    if (message === "Practical not found") return new Response(message, { status: 404 });
    return new Response(message, { status: 500 });
  }
};

const handlePracticalReviewButton = async (body: any, customId: string) => {
  const memberRoles = body.member?.roles || [];
  if (!memberRoles.includes(RECRUITMENT_PRACTICAL_REVIEWER_ROLE_ID)) {
    return Response.json({ type: 4, data: { content: "You are not allowed to review practicals.", flags: 64 } });
  }

  const [, status, practicalId] = customId.split(":");
  if (!practicalId || !["passed", "failed"].includes(status)) {
    return Response.json({ type: 4, data: { content: "Invalid practical review action.", flags: 64 } });
  }

  try {
    const result = await applyPracticalStatus(practicalId, status as "passed" | "failed");
    const color = status === "passed" ? COLORS.GREEN : COLORS.RED;
    const outcome = status === "passed" ? "PASSED" : "FAILED";

    return Response.json({
      type: 7,
      data: {
        embeds: [{
          title: "AFLV | Practical Review",
          color,
          description: `Practical review complete.
**Result:** ${outcome}`,
          fields: [
            { name: "Pilot", value: result.discordUserId ? `<@${result.discordUserId}>` : String((result.practical as any)?.pilots?.full_name || "Unknown"), inline: true },
            { name: "Practical ID", value: practicalId, inline: false },
          ],
          timestamp: new Date().toISOString(),
        }],
        components: [],
      },
    });
  } catch (error: any) {
    return Response.json({ type: 4, data: { content: error?.message || "Could not update practical status.", flags: 64 } });
  }
};

const sendInteractionFollowup = async (
  applicationId: string,
  interactionToken: string,
  content: string,
  ephemeral = false,
) => {
  await fetch(`https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, ...(ephemeral ? { flags: 64 } : {}) }),
  });
};

const processRecruitmentButton = async (body: any) => {
  const discordUserId = body.member?.user?.id;
  const username = body.member?.user?.username || "candidate";
  const guildId = body.guild_id;

  if (!discordUserId || !guildId) {
    return "Missing Discord user/guild context.";
  }

  const authUserId = await resolveAuthUserFromDiscord(discordUserId).catch(() => null);

  const examId = await getRecruitmentExamId();

  const lastSession = await getLatestRecruitmentSession(discordUserId);
  const cooldownMinutes = await getLatestRecruitmentCooldown(discordUserId);
  if (cooldownMinutes) {
    const hours = Math.floor(cooldownMinutes / 60);
    const minutes = cooldownMinutes % 60;
    return { content: `You need to wait before retest. Next exam link will be available in ${hours}h ${minutes}m.`, ephemeral: true };
  }

  const token = crypto.randomUUID();

  const { error: sessionError } = await supabase.from("recruitment_exam_sessions").insert({
    application_id: null,
    exam_id: examId,
    auth_user_id: authUserId,
    discord_user_id: discordUserId,
    token,
  });
  if (sessionError) {
    // Compatibility if application_id is still NOT NULL in DB.
    const message = String((sessionError as any)?.message || "").toLowerCase();
    if (message.includes("application_id") && authUserId) {
      const applicationId = await ensureApplication(authUserId, discordUserId, username);
      const { error: retryError } = await supabase.from("recruitment_exam_sessions").insert({
        application_id: applicationId,
        exam_id: examId,
        auth_user_id: authUserId,
        discord_user_id: discordUserId,
        token,
      });
      if (retryError) throw retryError;
    } else {
      throw sessionError;
    }
  }

  const channel = await createRecruitmentChannel(guildId, discordUserId, username);
  const examUrl = `${FRONTEND_URL.replace(/\/$/, "")}/academy/exam/${examId}?recruitmentToken=${encodeURIComponent(token)}`;

  if (lastSession?.passed === false && !cooldownMinutes && lastSession.recruitment_channel_id && lastSession.exam_message_id) {
    await discordApi(`/channels/${lastSession.recruitment_channel_id}/messages/${lastSession.exam_message_id}`, {
      method: "DELETE",
    }).catch(() => null);
  }

  const examMessageResponse = await discordApi(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: `<@${discordUserId}>`,
      embeds: [{
        title: "AFLV | Recruitment Written Test",
        color: COLORS.BLUE,
        description: [
          "Please complete your entrance written exam using the link below:",
          examUrl,
          "",
          "After you pass, click **Continue** below.",
          "**Note:** If you fail, there is a 24-hour cooldown before a new written test link is issued.",
        ].join("\n"),
        timestamp: new Date().toISOString(),
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 1,
          custom_id: `${RECRUITMENT_CALLSIGN_BUTTON_PREFIX}${token}`,
          label: "Continue",
        }],
      }],
    }),
  });

  const examMessagePayload = await examMessageResponse.json().catch(() => ({}));

  const updateWithMessage = await supabase
    .from("recruitment_exam_sessions")
    .update({ recruitment_channel_id: channel.id, exam_message_id: examMessagePayload?.id || null })
    .eq("token", token);

  if (updateWithMessage.error) {
    // Backward compatibility if exam_message_id column is not present yet.
    await supabase
      .from("recruitment_exam_sessions")
      .update({ recruitment_channel_id: channel.id })
      .eq("token", token);
  }

  return { content: `Recruitment channel created: <#${channel.id}>`, ephemeral: true };
};

const handleRecruitmentButton = (body: any) => {
  const interactionToken = String(body?.token || "");
  const applicationId = String(body?.application_id || "");

  const task = (async () => {
    if (!interactionToken || !applicationId) return;

    try {
      const result = await processRecruitmentButton(body);
      const payload = typeof result === "string" ? { content: result, ephemeral: false } : result;
      await sendInteractionFollowup(applicationId, interactionToken, payload.content, payload.ephemeral);
    } catch (error: any) {
      await sendInteractionFollowup(applicationId, interactionToken, error?.message || "Recruitment flow failed", true);
    }
  })();

  (globalThis as any).EdgeRuntime?.waitUntil?.(task);

  return Response.json({
    type: 5,
  });
};


const handleOpenCallsignModal = async (body: any, token: string) => {
  const discordUserId = body.member?.user?.id || body.user?.id;
  if (!discordUserId) {
    return Response.json({ type: 4, data: { content: "Missing Discord user context.", flags: 64 } });
  }

  if (!token) {
    return Response.json({ type: 4, data: { content: "Recruitment session not found. Please restart from Fly High.", flags: 64 } });
  }

  return Response.json({
    type: 9,
    data: {
      custom_id: `${RECRUITMENT_CALLSIGN_MODAL_PREFIX}${token}`.slice(0, 100),
      title: "Continue",
      components: [{
        type: 1,
        components: [{
          type: 4,
          custom_id: "preferred_callsign",
          label: "Preferred Callsign (AFLVXXX)",
          style: 1,
          min_length: 7,
          max_length: 7,
          required: true,
          placeholder: "AFLV123",
        }],
      }, {
        type: 1,
        components: [{
          type: 4,
          custom_id: "contact_email",
          label: "Registration Email (if not using Discord login)",
          style: 1,
          required: false,
          placeholder: "name@example.com",
        }],
      }],
    },
  });
};

const readModalInput = (body: any, customId: string) => {
  const rows = body.data?.components || [];
  for (const row of rows) {
    for (const comp of row.components || []) {
      if (comp.custom_id === customId) return String(comp.value || "");
    }
  }
  return "";
};

const handleSubmitCallsignModal = async (body: any, token: string) => {
  const discordUserId = body.member?.user?.id || body.user?.id;
  const username = body.member?.user?.username || body.user?.username || "User";
  const guildId = body.guild_id;
  if (!discordUserId) {
    return Response.json({ type: 4, data: { content: "Missing Discord user context.", flags: 64 } });
  }

  const preferredPid = readModalInput(body, "preferred_callsign").toUpperCase().trim();
  if (!/^AFLV[A-Z0-9]{3}$/.test(preferredPid)) {
    return Response.json({ type: 4, data: { content: "Invalid format. Use AFLVXXX (letters/numbers).", flags: 64 } });
  }

  const email = readModalInput(body, "contact_email").trim();

  const { data, error } = await supabase.rpc("complete_recruitment_with_pid", {
    p_token: token,
    p_pid: preferredPid,
    p_email: email || null,
  });

  if (error) {
    return Response.json({ type: 4, data: { content: error.message || "Could not set callsign.", flags: 64 } });
  }

  if (data?.approved && guildId) {
    await discordApi(`/guilds/${guildId}/members/${discordUserId}`, {
      method: "PATCH",
      body: JSON.stringify({ nick: `[${preferredPid}] ${username}`.slice(0, 32) }),
    }).catch(() => null);
  }

  if (data?.approved) {
    return Response.json({
      type: 4,
      data: {
        content: `✅ Approved! Callsign **${preferredPid}** assigned. Click below when you are ready for practical.`,
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 3,
            custom_id: `${RECRUITMENT_PRACTICAL_READY_PREFIX}${token}`,
            label: "Yes, I am ready for practical",
          }],
        }],
      },
    });
  }

  return Response.json({
    type: 4,
    data: {
      content: `📝 Callsign saved as **${preferredPid}**. Now register/login at https://crew-aflv.vercel.app/ (prefer Discord login). Then click the button below to continue.`,
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 1,
          custom_id: `${RECRUITMENT_PRACTICAL_CONFIRM_PREFIX}${token}`,
          label: "I have registered, continue",
        }],
      }],
    },
  });
};

const handleRecruitmentPracticalConfirm = async (_body: any, token: string) => {
  return Response.json({
    type: 4,
    data: {
      content: "Please confirm you are fully ready for practical assignment.",
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 3,
          custom_id: `${RECRUITMENT_PRACTICAL_READY_PREFIX}${token}`,
          label: "Yes, I am ready for practical",
        }],
      }],
    },
  });
};

const handleRecruitmentPracticalReady = async (body: any, token: string) => {
  const discordUserId = body.member?.user?.id || body.user?.id;
  if (!discordUserId) {
    return Response.json({ type: 4, data: { content: "Missing Discord user context.", flags: 64 } });
  }

  const { data: finalState, error: finalError } = await supabase.rpc("finalize_recruitment_registration", {
    p_token: token,
  });

  if (finalError) {
    return Response.json({ type: 4, data: { content: finalError.message || "Could not finalize recruitment registration.", flags: 64 } });
  }

  if (!finalState?.approved) {
    return Response.json({
      type: 4,
      data: {
        content: "You still need to register on Crew Center first. Register with Discord OR with your email used in the callsign form at https://crew-aflv.vercel.app/ then click again.",
        flags: 64,
      },
    });
  }

  const { data: sessionByToken } = await supabase
    .from("recruitment_exam_sessions")
    .select("auth_user_id")
    .eq("token", token)
    .maybeSingle();

  if (sessionByToken?.auth_user_id) {
    const { data: pilotRow } = await supabase
      .from("pilots")
      .select("id")
      .eq("user_id", sessionByToken.auth_user_id)
      .maybeSingle();

    if (pilotRow?.id) {
      const { data: failedPractical } = await supabase
        .from("academy_practicals")
        .select("completed_at")
        .eq("pilot_id", pilotRow.id)
        .eq("status", "failed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (failedPractical?.completed_at) {
        const nextAt = new Date(new Date(failedPractical.completed_at).getTime() + 24 * 60 * 60 * 1000);
        if (Date.now() < nextAt.getTime()) {
          return Response.json({
            type: 4,
            data: {
              content: `You failed practical recently. Please wait until ${nextAt.toLocaleString()} before continuing.`,
              flags: 64,
            },
          });
        }
      }
    }
  }

  const { data, error } = await supabase.rpc("assign_recruitment_practical", { p_token: token });
  if (error) {
    return Response.json({ type: 4, data: { content: error.message || "Could not assign practical.", flags: 64 } });
  }

  const pid = String(data?.pid || "AFLV");
  const shortPid = pid.replace(/^AFLV/i, "") || pid;
  const practicalId = String(data?.practical_id || "");

  return Response.json({
    type: 4,
    data: {
      embeds: [{
        title: "AFLV | Practical Assigned",
        color: COLORS.BLUE,
        description: "Your practical is assigned. Complete the task and wait for examiner review.",
        fields: [
          {
            name: "Practical Tasks",
            value: [
              "1. Spawn at any gate at UUBW.",
              "2. Taxi to RWY 30.",
              "3. Depart straight and transition to UUDD pattern for RWY 32L.",
              "4. Touch and go with proper UNICOM use.",
              "5. Transition to UUDD RWY 32R downwind.",
              "6. Touch and go, then depart to the northwest.",
              "7. Proceed direct \"MR\" Moscow Shr. VOR.",
              "8. Transition to pattern for landing at any runway at UUEE.",
              "9. Land, park, and exit.",
            ].join("\n"),
          },
          {
            name: "Aircraft / Callsign",
            value: `ATYP - C172\nCALLSIGN - Aeroflot ${shortPid}CR`,
          },
        ],
        timestamp: new Date().toISOString(),
      }],
      components: practicalId ? [{
        type: 1,
        components: [{
          type: 2,
          style: 3,
          custom_id: `${RECRUITMENT_PRACTICAL_REVIEW_PREFIX}passed:${practicalId}`,
          label: "Pass",
        }, {
          type: 2,
          style: 4,
          custom_id: `${RECRUITMENT_PRACTICAL_REVIEW_PREFIX}failed:${practicalId}`,
          label: "Fail",
        }],
      }] : [],
    },
  });
};

serve(async (req) => {
  try {
    if (!req.headers.get("x-signature-ed25519") && req.headers.get("authorization")) {
      const body = await req.json().catch(() => ({}));
      if (body?.action === "handle_practical_status") {
        return await handlePracticalStatusAction(body, req.headers.get("authorization"));
      }
      return Response.json({ ok: false, error: "Unsupported authenticated action" }, { status: 400 });
    }

    if (req.headers.get("x-register-secret")) {
      const provided = req.headers.get("x-register-secret") || "";
      if (!DISCORD_REGISTER_SECRET || provided !== DISCORD_REGISTER_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      try {
        const message = await createRecruitmentEmbed();
        return Response.json({ ok: true, messageId: message.id, channelId: RECRUITMENTS_CHANNEL_ID });
      } catch (error: any) {
        return Response.json({ ok: false, error: error?.message || "Failed to create recruitment embed" }, { status: 500 });
      }
    }

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
    try {
      if (customId.startsWith("event_join:")) return handleJoinEventButton(body, customId.slice("event_join:".length));
      if (customId.startsWith("challenge_accept:")) return handleAcceptChallengeButton(body, customId.slice("challenge_accept:".length));
      if (customId === RECRUITMENT_BUTTON_CUSTOM_ID) return handleRecruitmentButton(body);
      if (customId.startsWith(RECRUITMENT_CALLSIGN_BUTTON_PREFIX)) return handleOpenCallsignModal(body, customId.slice(RECRUITMENT_CALLSIGN_BUTTON_PREFIX.length));
      if (customId.startsWith(RECRUITMENT_PRACTICAL_CONFIRM_PREFIX)) return handleRecruitmentPracticalConfirm(body, customId.slice(RECRUITMENT_PRACTICAL_CONFIRM_PREFIX.length));
      if (customId.startsWith(RECRUITMENT_PRACTICAL_READY_PREFIX)) return handleRecruitmentPracticalReady(body, customId.slice(RECRUITMENT_PRACTICAL_READY_PREFIX.length));
      if (customId.startsWith(RECRUITMENT_PRACTICAL_REVIEW_PREFIX)) return handlePracticalReviewButton(body, customId);
    } catch (error: any) {
      return Response.json({ type: 4, data: { content: error?.message || "Action failed", flags: 64 } });
    }
    return embedResponse({ title: "Action Failed", description: "Unknown button action.", color: COLORS.RED });
  }

    if (body.type === 5) {
    const customId = String(body.data?.custom_id || "");
    try {
      if (customId.startsWith(RECRUITMENT_CALLSIGN_MODAL_PREFIX)) {
        return handleSubmitCallsignModal(body, customId.slice(RECRUITMENT_CALLSIGN_MODAL_PREFIX.length));
      }
    } catch (error: any) {
      return Response.json({ type: 4, data: { content: error?.message || "Modal action failed", flags: 64 } });
    }
    return embedResponse({ title: "Action Failed", description: "Unknown modal action.", color: COLORS.RED });
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
  } catch (error: any) {
    console.error("discord-pirep-bot unhandled error", error);

    // If this is a Discord interaction request, return a valid interaction response
    // so users don't see generic "This interaction failed".
    if (req.headers.get("x-signature-ed25519")) {
      return Response.json({
        type: 4,
        data: {
          content: error?.message || "Unexpected bot error. Please try again.",
          flags: 64,
        },
      });
    }

    return Response.json({ ok: false, error: error?.message || "Unexpected bot error" }, { status: 500 });
  }
});
