import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { icao } = await req.json();
    if (!icao) {
      return new Response(JSON.stringify({ error: "ICAO code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://ifatc.org/gates?code=${icao.toUpperCase()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return new Response(JSON.stringify({ gates: [], error: "Failed to fetch gates" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = await response.text();
    
    // Parse the response - ifatc.org returns gate data
    // Try to extract gate names from the response
    let gates: string[] = [];
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        gates = data.map((g: any) => g.gate || g.name || g.identifier || String(g)).filter(Boolean);
      } else if (data.gates && Array.isArray(data.gates)) {
        gates = data.gates.map((g: any) => g.gate || g.name || g.identifier || String(g)).filter(Boolean);
      }
    } catch {
      // If not JSON, try to extract gate names from HTML/text
      const matches = text.match(/gate["\s:]+([A-Z0-9]+)/gi);
      if (matches) {
        gates = matches.map(m => m.replace(/gate["\s:]+/i, "").trim()).filter(Boolean);
      }
    }

    return new Response(JSON.stringify({ gates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ gates: [], error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
