import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API_BASE = "https://discord.com/api/v10";
const EVENT_REMINDER_CHANNEL_ID = "1427122161570807858";

type RegistrationRow = {
  assigned_dep_gate: string | null;
  assigned_arr_gate: string | null;
  discord_user_id: string | null;
  pilot: {
    user_id: string | null;
    full_name: string | null;
    pid: string | null;
    discord_user_id: string | null;
  } | null;
};

const toUtcHm = (iso: string) => {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
};

const createDiscordThread = async (botToken: string, eventName: string, startTimeIso: string) => {
  const threadName = `${eventName} • ${toUtcHm(startTimeIso)}`.slice(0, 100);

  const response = await fetch(`${DISCORD_API_BASE}/channels/${EVENT_REMINDER_CHANNEL_ID}/threads`, {
    method: "POST",
    headers: {
      "Authorization": `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: threadName,
      auto_archive_duration: 1440,
      type: 11,
      reason: "Auto-created 30-minute event reminder thread",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord thread creation failed (${response.status}): ${text}`);
  }

  return await response.json();
};

const postDiscordMessage = async (botToken: string, channelId: string, content: string) => {
  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord message post failed (${response.status}): ${text}`);
  }

  return await response.json();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const discordBotToken = Deno.env.get("DISCORD_BOT_TOKEN") || "";

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!discordBotToken) {
      return new Response(JSON.stringify({ error: "Missing DISCORD_BOT_TOKEN" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    const now = new Date();
    const inThirtyMinutes = new Date(now.getTime() + 30 * 60 * 1000);

    const { data: upcomingEvents, error: eventsError } = await supabase
      .from("events")
      .select("id,name,start_time,end_time,dep_icao,arr_icao,banner_url,aircraft_icao,aircraft_name")
      .eq("is_active", true)
      .gte("start_time", now.toISOString())
      .lte("start_time", inThirtyMinutes.toISOString())
      .order("start_time", { ascending: true });

    if (eventsError) throw eventsError;

    if (!upcomingEvents?.length) {
      return new Response(JSON.stringify({ success: true, message: "No events starting in the next 30 minutes." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventIds = upcomingEvents.map((e: any) => e.id);
    const { data: alreadyReminded, error: remindedError } = await supabase
      .from("event_discord_reminders")
      .select("event_id")
      .in("event_id", eventIds);

    if (remindedError) throw remindedError;

    const remindedEventIds = new Set((alreadyReminded || []).map((r: any) => r.event_id));
    const pendingEvents = upcomingEvents.filter((e: any) => !remindedEventIds.has(e.id));

    if (!pendingEvents.length) {
      return new Response(JSON.stringify({ success: true, message: "All upcoming events already reminded.", total: upcomingEvents.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ event_id: string; status: string; thread_id?: string; error?: string }> = [];

    for (const event of pendingEvents) {
      try {
        const { data: registrations, error: regError } = await supabase
          .from("event_registrations")
          .select("assigned_dep_gate,assigned_arr_gate,discord_user_id,pilot:pilots(user_id,full_name,pid,discord_user_id)")
          .eq("event_id", event.id)
          .order("registered_at", { ascending: true });

        if (regError) throw regError;

        const regRows = (registrations || []) as RegistrationRow[];
        const userIds = regRows.map((r) => r.pilot?.user_id).filter((id): id is string => Boolean(id));

        const identityIdMap = new Map<string, string>();
        const identityUsernameMap = new Map<string, string>();
        if (userIds.length) {
          const { data: identities } = await supabase
            .schema("auth")
            .from("identities")
            .select("user_id,provider_id,identity_data")
            .eq("provider", "discord")
            .in("user_id", userIds);

          for (const it of identities || []) {
            const row: any = it;
            if (row.user_id && row.provider_id) identityIdMap.set(row.user_id, row.provider_id);
            const iData = (row.identity_data || {}) as Record<string, any>;
            const uname = String(iData.global_name || iData.username || "").trim();
            if (row.user_id && uname) identityUsernameMap.set(row.user_id, uname);
          }
        }

        const authDisplayNameMap = new Map<string, string>();
        if (userIds.length) {
          const { data: authUsers } = await supabase
            .schema("auth")
            .from("users")
            .select("id,email,raw_user_meta_data")
            .in("id", userIds);

          for (const u of authUsers || []) {
            const row: any = u;
            const meta = (row.raw_user_meta_data || {}) as Record<string, any>;
            const display = String(meta.full_name || meta.name || meta.global_name || meta.preferred_username || row.email || "").trim();
            if (row.id && display) authDisplayNameMap.set(row.id, display);
          }
        }

        let aircraftDisplay = event.aircraft_name || event.aircraft_icao || "Any";
        if (event.aircraft_icao) {
          const { data: aircraftRows } = await supabase
            .from("aircraft")
            .select("livery")
            .eq("icao_code", event.aircraft_icao)
            .not("livery", "is", null);
          const livery = [...new Set((aircraftRows || []).map((r: any) => String(r.livery || "").trim()).filter(Boolean))][0];
          if (livery) aircraftDisplay = `${aircraftDisplay} (${livery})`;
        }

        const lines = regRows.length
          ? regRows.map((r) => {
              const userId = r.pilot?.user_id || "";
              const discordId = r.discord_user_id || r.pilot?.discord_user_id || (userId ? identityIdMap.get(userId) : undefined);
              const discordUsername = userId ? identityUsernameMap.get(userId) : undefined;
              const authDisplayName = userId ? authDisplayNameMap.get(userId) : undefined;
              const pilotName = r.pilot?.full_name || r.pilot?.pid || "Pilot";

              const display = discordId
                ? `**__<@${discordId}>__**`
                : discordUsername
                  ? `**__@${discordUsername}__**`
                  : `**__${authDisplayName || pilotName}__**`;

              return `• ${display} — DEP Gate: **${r.assigned_dep_gate || "TBD"}** | ARR Gate: **${r.assigned_arr_gate || "TBD"}**`;
            })
          : ["No pilots registered yet."];

        const thread = await createDiscordThread(discordBotToken, event.name || "Event", event.start_time);

        const header = [
          `## ✈️ ${event.name || "Event"}`,
          `**Route:** ${event.dep_icao || "----"} → ${event.arr_icao || "----"}`,
          `**Aircraft:** ${aircraftDisplay}`,
          `**Start (Zulu):** ${toUtcHm(event.start_time)}`,
          `**End (Zulu):** ${event.end_time ? toUtcHm(event.end_time) : "N/A"}`,
          event.banner_url ? `**Image:** ${event.banner_url}` : "",
          "",
          `### 🛬 Gate Assignments`,
        ].filter(Boolean).join("\n");

        await postDiscordMessage(discordBotToken, thread.id, `${header}\n${lines.join("\n")}`.slice(0, 1900));

        const { error: saveError } = await supabase
          .from("event_discord_reminders")
          .insert({ event_id: event.id, reminder_type: "t_minus_30m", thread_id: thread.id });

        if (saveError) throw saveError;

        results.push({ event_id: event.id, status: "ok", thread_id: thread.id });
      } catch (eventError: any) {
        console.error(`Failed handling event ${event.id}:`, eventError);
        results.push({ event_id: event.id, status: "error", error: String(eventError?.message || eventError) });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: pendingEvents.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("discord-event-reminder error:", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
