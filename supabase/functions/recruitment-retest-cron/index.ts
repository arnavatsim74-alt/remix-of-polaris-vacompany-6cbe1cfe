import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") || "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const discordApi = async (path: string, init: RequestInit = {}) => {
  return fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
};

serve(async () => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DISCORD_BOT_TOKEN || !FRONTEND_URL) {
      return Response.json({ ok: false, error: "Missing required env vars" }, { status: 500 });
    }

    const { data: failedSessions, error: fetchError } = await supabase
      .from("recruitment_exam_sessions")
      .select("id, auth_user_id, application_id, exam_id, discord_user_id, recruitment_channel_id, exam_message_id, completed_at, created_at")
      .eq("passed", false)
      .not("completed_at", "is", null)
      .is("retest_sent_at", null)
      .not("discord_user_id", "is", null)
      .not("recruitment_channel_id", "is", null)
      .order("completed_at", { ascending: true })
      .limit(200);

    if (fetchError) throw fetchError;

    let processed = 0;
    let sent = 0;
    let skipped = 0;

    for (const session of failedSessions || []) {
      processed++;

      const completedAt = new Date(session.completed_at as string).getTime();
      const readyAt = completedAt + (24 * 60 * 60 * 1000);
      if (Date.now() < readyAt) {
        skipped++;
        continue;
      }

      const { data: newer } = await supabase
        .from("recruitment_exam_sessions")
        .select("id")
        .eq("discord_user_id", session.discord_user_id)
        .gt("created_at", session.created_at)
        .limit(1)
        .maybeSingle();

      if (newer?.id) {
        await supabase.from("recruitment_exam_sessions").update({ retest_sent_at: new Date().toISOString() }).eq("id", session.id);
        skipped++;
        continue;
      }

      const token = crypto.randomUUID();
      const examUrl = `${FRONTEND_URL.replace(/\/$/, "")}/academy/exam/${session.exam_id}?recruitmentToken=${encodeURIComponent(token)}`;

      if (session.exam_message_id && session.recruitment_channel_id) {
        await discordApi(`/channels/${session.recruitment_channel_id}/messages/${session.exam_message_id}`, {
          method: "DELETE",
        }).catch(() => null);
      }

      const messageResponse = await discordApi(`/channels/${session.recruitment_channel_id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: `🔁 <@${session.discord_user_id}> your 24-hour cooldown is complete.\nHere is your NEW written test link:\n${examUrl}\n\n(Previous test link has been removed.)`,
        }),
      });

      const messagePayload = await messageResponse.json().catch(() => ({}));
      if (!messageResponse.ok) {
        console.error("Failed to send retest message", messagePayload);
        continue;
      }

      const { data: newSession, error: insertError } = await supabase
        .from("recruitment_exam_sessions")
        .insert({
          auth_user_id: session.auth_user_id,
          application_id: session.application_id,
          exam_id: session.exam_id,
          discord_user_id: session.discord_user_id,
          recruitment_channel_id: session.recruitment_channel_id,
          exam_message_id: messagePayload?.id || null,
          token,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to create retest session", insertError);
        continue;
      }

      await supabase
        .from("recruitment_exam_sessions")
        .update({ retest_sent_at: new Date().toISOString() })
        .eq("id", session.id);

      sent++;
      console.log("Retest session created", { oldSessionId: session.id, newSessionId: newSession.id });
    }

    return Response.json({ ok: true, processed, sent, skipped });
  } catch (error: any) {
    console.error("recruitment-retest-cron failed", error);
    return Response.json({ ok: false, error: error?.message || "Unknown error" }, { status: 500 });
  }
});
