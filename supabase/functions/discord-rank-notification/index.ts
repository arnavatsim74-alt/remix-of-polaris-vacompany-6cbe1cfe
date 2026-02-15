import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type } = body;

    // Pick the correct webhook URL based on notification type
    let webhookUrl: string | undefined;
    let embed: any;

    if (type === "new_pirep") {
      webhookUrl = Deno.env.get("DISCORD_WEBHOOK_PIREP") || Deno.env.get("DISCORD_WEBHOOK_URL");
      const { pilot_name, pid, flight_number, dep_icao, arr_icao, aircraft_icao, flight_hours, operator, flight_type } = body;
      embed = {
        title: "✈️ New PIREP Filed!",
        description: `**${pilot_name}** (${pid}) has filed a new PIREP.`,
        color: 0x2ecc71,
        fields: [
          { name: "Flight", value: flight_number, inline: true },
          { name: "Route", value: `${dep_icao} → ${arr_icao}`, inline: true },
          { name: "Aircraft", value: aircraft_icao || "N/A", inline: true },
          { name: "Hours", value: String(flight_hours), inline: true },
          { name: "Operator", value: operator, inline: true },
          { name: "Type", value: flight_type, inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Aeroflot Virtual" },
      };
    } else if (type === "featured_route") {
      webhookUrl = Deno.env.get("DISCORD_WEBHOOK_FEATURED") || Deno.env.get("DISCORD_WEBHOOK_URL");
      const { route_number, dep_icao, arr_icao, aircraft_icao, featured_date } = body;
      embed = {
        title: "⭐ Featured Route of the Day!",
        description: `Today's featured route has been set.`,
        color: 0xf1c40f,
        fields: [
          { name: "Route", value: route_number, inline: true },
          { name: "From → To", value: `${dep_icao} → ${arr_icao}`, inline: true },
          { name: "Aircraft", value: aircraft_icao || "N/A", inline: true },
          { name: "Date", value: featured_date, inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Aeroflot Virtual" },
      };
    } else if (type === "new_challenge") {
      webhookUrl = Deno.env.get("DISCORD_WEBHOOK_CHALLENGES") || Deno.env.get("DISCORD_WEBHOOK_URL");
      const { name, description, destination_icao, image_url } = body;
      embed = {
        title: "🎯 New Challenge Available!",
        description: `A new challenge has been added: **${name}**`,
        color: 0xe67e22,
        fields: [
          ...(description ? [{ name: "Description", value: description, inline: false }] : []),
          ...(destination_icao ? [{ name: "Destination", value: destination_icao, inline: true }] : []),
        ],
        ...(image_url ? { image: { url: image_url } } : {}),
        timestamp: new Date().toISOString(),
        footer: { text: "Aeroflot Virtual" },
      };
    } else {
      // Default: rank promotion
      webhookUrl = Deno.env.get("DISCORD_WEBHOOK_RANK") || Deno.env.get("DISCORD_WEBHOOK_URL");
      const { pilot_name, pid, old_rank, new_rank } = body;
      const formatRank = (rank: string) =>
        rank.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      embed = {
        title: "🎖️ Rank Promotion!",
        description: `**${pilot_name}** (${pid}) has been promoted!`,
        color: 0x1e90ff,
        fields: [
          { name: "Previous Rank", value: formatRank(old_rank), inline: true },
          { name: "New Rank", value: formatRank(new_rank), inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Aeroflot Virtual" },
      };
    }

    if (!webhookUrl) {
      console.error("No webhook URL configured for type:", type);
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const discordResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error("Discord webhook failed:", errorText);
      return new Response(JSON.stringify({ error: "Discord webhook failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await discordResponse.text();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
