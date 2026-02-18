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
      .select("id,name,start_time,dep_icao,arr_icao")
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
          .select("assigned_dep_gate,assigned_arr_gate,pilot:pilots(user_id,full_name,pid,discord_user_id)")
          .eq("event_id", event.id)
          .order("registered_at", { ascending: true });

        if (regError) throw regError;

        const regRows = (registrations || []) as RegistrationRow[];
        const userIds = regRows
          .map((r) => r.pilot?.user_id)
          .filter((id): id is string => Boolean(id));

        let identityMap = new Map<string, string>();
        if (userIds.length) {
          const { data: identities, error: identitiesError } = await supabase
            .schema("auth")
            .from("identities")
            .select("user_id,provider_id")
            .eq("provider", "discord")
            .in("user_id", userIds);

          if (!identitiesError && identities?.length) {
            identityMap = new Map(identities.map((it: any) => [it.user_id, it.provider_id]));
          }
        }

        const lines = regRows.length
          ? regRows.map((r) => {
              const pilotName = r.pilot?.full_name || r.pilot?.pid || "Pilot";
              const discordId = r.pilot?.discord_user_id || (r.pilot?.user_id ? identityMap.get(r.pilot.user_id) : undefined);
              const mention = discordId ? `<@${discordId}>` : pilotName;
              return `• ${mention} — DEP Gate: ${r.assigned_dep_gate || "TBD"} | ARR Gate: ${r.assigned_arr_gate || "TBD"}`;
            })
          : ["No pilots registered yet."];

        const thread = await createDiscordThread(discordBotToken, event.name || "Event", event.start_time);

        const header = [
          `Event starts in 30 minutes: **${event.name || "Event"}**`,
          `Route: ${event.dep_icao || "----"} → ${event.arr_icao || "----"}`,
          `Start: ${toUtcHm(event.start_time)}`,
          "",
          "Registered pilots and assigned gates:",
        ].join("\n");

        await postDiscordMessage(discordBotToken, thread.id, `${header}\n${lines.join("\n")}`.slice(0, 1900));

        const { error: saveError } = await supabase
          .from("event_discord_reminders")
          .insert({
            event_id: event.id,
            reminder_type: "t_minus_30m",
            thread_id: thread.id,
          });

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
