import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nacl from "npm:tweetnacl@1.0.3";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY") || "";
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "";
const RECRUITMENTS_CHANNEL_ID = "1474299044091265096";
const RECRUITMENTS_CATEGORY_ID = "1426656419758870693";
const BUTTON_CUSTOM_ID = "recruitment_fly_high";
const REGISTER_SECRET = Deno.env.get("DISCORD_REGISTER_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const toHexBytes = (value: string) => {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < value.length; i += 2) bytes[i / 2] = parseInt(value.slice(i, i + 2), 16);
  return bytes;
};

const verifyDiscordRequest = (req: Request, rawBody: string) => {
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

const createRecruitmentEmbed = async () => {
  const body = {
    embeds: [
      {
        title: "AFLV Recruitments",
        description: "Click **Fly High** to open your recruitment ticket and start your entrance written exam.",
        color: 0x3498db,
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            custom_id: BUTTON_CUSTOM_ID,
            label: "Fly High",
          },
        ],
      },
    ],
  };

  const response = await discordApi(`/channels/${RECRUITMENTS_CHANNEL_ID}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Failed to create recruitment embed");
  return payload;
};

const resolveAuthUserFromDiscord = async (discordUserId: string) => {
  const { data, error } = await supabase
    .schema("auth")
    .from("identities")
    .select("user_id")
    .eq("provider", "discord")
    .eq("provider_id", discordUserId)
    .limit(1);

  if (error) throw error;
  return data?.[0]?.user_id || null;
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
  const channelName = `recruitment-${safeUsername}`;

  const response = await discordApi(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: channelName,
      type: 0,
      parent_id: RECRUITMENTS_CATEGORY_ID,
      permission_overwrites: [
        {
          id: guildId,
          type: 0,
          deny: "1024",
          allow: "0",
        },
        {
          id: discordUserId,
          type: 1,
          allow: "1024",
          deny: "0",
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Failed to create recruitment channel");
  return payload;
};

serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    if (req.headers.get("x-register-secret")) {
      if (!REGISTER_SECRET || req.headers.get("x-register-secret") !== REGISTER_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }
      const message = await createRecruitmentEmbed();
      return Response.json({ ok: true, messageId: message.id, channelId: RECRUITMENTS_CHANNEL_ID });
    }

    const rawBody = await req.text();
    if (!verifyDiscordRequest(req, rawBody)) {
      return new Response("Bad request signature", { status: 401 });
    }

    const body = JSON.parse(rawBody);

    if (body.type === 1) {
      return Response.json({ type: 1 });
    }

    if (body.type !== 3 || body.data?.custom_id !== BUTTON_CUSTOM_ID) {
      return Response.json({
        type: 4,
        data: { content: "Unsupported interaction", flags: 64 },
      });
    }

    const discordUserId = body.member?.user?.id;
    const username = body.member?.user?.username || "candidate";
    const guildId = body.guild_id;

    if (!discordUserId || !guildId) {
      return Response.json({ type: 4, data: { content: "Missing Discord user/guild context.", flags: 64 } });
    }

    const authUserId = await resolveAuthUserFromDiscord(discordUserId);
    if (!authUserId) {
      return Response.json({
        type: 4,
        data: {
          content: "Please sign in on Crew Center with Discord first, then click **Fly High** again.",
          flags: 64,
        },
      });
    }

    const examId = await getRecruitmentExamId();
    const applicationId = await ensureApplication(authUserId, discordUserId, username);
    const token = crypto.randomUUID();

    const { error: sessionError } = await supabase.from("recruitment_exam_sessions").insert({
      application_id: applicationId,
      exam_id: examId,
      token,
    });
    if (sessionError) throw sessionError;

    const channel = await createRecruitmentChannel(guildId, discordUserId, username);

    const examUrl = `${FRONTEND_URL.replace(/\/$/, "")}/academy/exam/${examId}?recruitmentToken=${encodeURIComponent(token)}`;

    await discordApi(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content: `Welcome <@${discordUserId}>!\nPlease complete your entrance written exam:\n${examUrl}\n\nOnce you pass, your application will be auto-approved.`,
      }),
    });

    return Response.json({
      type: 4,
      data: {
        content: `Recruitment channel created: <#${channel.id}>`,
        flags: 64,
      },
    });
  } catch (error: any) {
    console.error("Recruitment bot error:", error);
    return Response.json({
      type: 4,
      data: {
        content: error?.message || "Recruitment flow failed",
        flags: 64,
      },
    });
  }
});
