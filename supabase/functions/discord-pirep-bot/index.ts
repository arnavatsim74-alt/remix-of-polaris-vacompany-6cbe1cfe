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
  for (let i = 0; i < value.length; i += 2) {
    bytes[i / 2] = parseInt(value.slice(i, i + 2), 16);
  }
  return bytes;
};

const verifyDiscordRequest = async (req: Request, rawBody: string) => {
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  if (!signature || !timestamp || !DISCORD_PUBLIC_KEY) return false;

  const encoder = new TextEncoder();
  const isValid = nacl.sign.detached.verify(
    encoder.encode(timestamp + rawBody),
    toHexBytes(signature),
    toHexBytes(DISCORD_PUBLIC_KEY),
  );
  return isValid;
};

const parseOptions = (options: any[] = []) => {
  const map: Record<string, any> = {};
  for (const opt of options) map[opt.name] = opt.value;
  return map;
};

const getOperators = async () => {
  const { data } = await supabase.from("site_settings").select("value").eq("key", "pirep_operators").maybeSingle();
  const raw = data?.value || "RAM,SU,ATR";
  return raw.split(",").map((x: string) => x.trim()).filter(Boolean).slice(0, 25);
};

const getAircraft = async () => {
  const { data } = await supabase.from("aircraft").select("icao_code,name").order("icao_code");
  return (data || []).slice(0, 500);
};

serve(async (req) => {
  const rawBody = await req.text();
  const valid = await verifyDiscordRequest(req, rawBody);

  if (!valid) {
    return new Response("invalid request signature", { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // Discord ping validation
  if (body.type === 1) {
    return Response.json({ type: 1 });
  }

  // Autocomplete interaction
  if (body.type === 4) {
    const focused = body.data?.options?.find((o: any) => o.focused);
    if (!focused) return Response.json({ type: 8, data: { choices: [] } });

    if (focused.name === "operator") {
      const operators = await getOperators();
      const choices = operators
        .filter((o) => o.toLowerCase().includes(String(focused.value || "").toLowerCase()))
        .slice(0, 25)
        .map((o) => ({ name: o, value: o }));
      return Response.json({ type: 8, data: { choices } });
    }

    if (focused.name === "aircraft") {
      const aircraft = await getAircraft();
      const q = String(focused.value || "").toLowerCase();
      const choices = aircraft
        .filter((a: any) => a.icao_code.toLowerCase().includes(q) || String(a.name || "").toLowerCase().includes(q))
        .slice(0, 25)
        .map((a: any) => ({ name: `${a.icao_code} - ${a.name || "Unknown"}`.slice(0, 100), value: a.icao_code }));
      return Response.json({ type: 8, data: { choices } });
    }

    return Response.json({ type: 8, data: { choices: [] } });
  }

  // Slash command interaction
  if (body.type === 2 && body.data?.name === "pirep") {
    const options = parseOptions(body.data?.options || []);

    const discordUserId = body.member?.user?.id || body.user?.id;
    if (!discordUserId) {
      return Response.json({ type: 4, data: { content: "Could not identify your Discord account.", flags: 64 } });
    }

    const { data: pilot, error: pilotErr } = await supabase
      .from("pilots")
      .select("id,pid,full_name")
      .eq("discord_user_id", discordUserId)
      .maybeSingle();

    if (pilotErr || !pilot?.id) {
      return Response.json({
        type: 4,
        data: {
          content: "Your Discord account is not linked to a pilot profile. Ask admin to set `pilots.discord_user_id` to your Discord user id.",
          flags: 64,
        },
      });
    }

    const flightDate = options.flight_date || new Date().toISOString().slice(0, 10);

    const { error } = await supabase.from("pireps").insert({
      flight_number: String(options.flight_number || "").toUpperCase(),
      dep_icao: String(options.dep_icao || "").toUpperCase(),
      arr_icao: String(options.arr_icao || "").toUpperCase(),
      operator: String(options.operator || ""),
      aircraft_icao: String(options.aircraft || "").toUpperCase(),
      flight_type: String(options.flight_type || "passenger"),
      flight_hours: Number(options.flight_hours || 0),
      flight_date: flightDate,
      pilot_id: pilot.id,
      status: "pending",
    });

    if (error) {
      return Response.json({ type: 4, data: { content: `Failed to file PIREP: ${error.message}`, flags: 64 } });
    }

    return Response.json({
      type: 4,
      data: {
        content: `✅ PIREP filed: **${String(options.flight_number).toUpperCase()}** (${String(options.dep_icao).toUpperCase()} → ${String(options.arr_icao).toUpperCase()})`,
        flags: 64,
      },
    });
  }

  return Response.json({ type: 4, data: { content: "Unsupported command", flags: 64 } });
});
