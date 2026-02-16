import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Aircraft ICAO to gate width class mapping
// Classes: A (smallest) -> F (largest)
// A: Small GA, most fighters
// B: A-10, C208, Citation X, CRJs, P-38
// C: A321, 737, Dash-8, Embraers
// D: 757, 767, C-17, C-130, MD11/DC10
// E: A340, 747-400, 777, 787
// F: A380, 747-800
const aircraftClassMap: Record<string, string> = {
  // Class C - Narrowbody
  "A318": "C", "A319": "C", "A320": "C", "A321": "C",
  "B731": "C", "B732": "C", "B733": "C", "B734": "C", "B735": "C",
  "B736": "C", "B737": "C", "B738": "C", "B739": "C", "B37M": "C", "B38M": "C", "B39M": "C",
  "E170": "C", "E175": "C", "E190": "C", "E195": "C", "E75S": "C", "E75L": "C",
  "DH8A": "C", "DH8B": "C", "DH8C": "C", "DH8D": "C",
  "CRJ7": "B", "CRJ9": "B", "CRJX": "B", "CRJ2": "B",
  "C208": "B", "C172": "A", "C152": "A", "TBM9": "A", "SR22": "A",
  // Class D - Mid widebody
  "B752": "D", "B753": "D",
  "B762": "D", "B763": "D", "B764": "D",
  "MD11": "D", "DC10": "D", "C17": "D", "C130": "D",
  // Class E - Large widebody
  "A332": "E", "A333": "E", "A338": "E", "A339": "E",
  "A342": "E", "A343": "E", "A345": "E", "A346": "E",
  "A359": "E", "A35K": "E",
  "B772": "E", "B773": "E", "B77L": "E", "B77W": "E",
  "B788": "E", "B789": "E", "B78X": "E",
  "B741": "E", "B742": "E", "B743": "E", "B744": "E",
  // Class F - Super heavy
  "A388": "F",
  "B748": "F",
};

const classOrder = ["A", "B", "C", "D", "E", "F"];

function getClassIndex(cls: string): number {
  return classOrder.indexOf(cls.toUpperCase());
}

// A gate can fit an aircraft if the gate class >= aircraft class
function gateCanFitAircraft(gateClass: string, aircraftClass: string): boolean {
  return getClassIndex(gateClass) >= getClassIndex(aircraftClass);
}

// Find the best fallback class: same category size or one step up
function getFallbackClasses(aircraftClass: string): string[] {
  const idx = getClassIndex(aircraftClass);
  // Return classes from same level up to F
  const fallbacks: string[] = [];
  for (let i = idx; i < classOrder.length; i++) {
    fallbacks.push(classOrder[i]);
  }
  // Also add one level below as last resort
  if (idx > 0) fallbacks.push(classOrder[idx - 1]);
  return fallbacks;
}

interface GateInfo {
  name: string;
  type: string;
  class: string;
  max_aircraft_size: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { icao, aircraft_icao } = await req.json();
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

    const html = await response.text();

    // Parse HTML table rows - look for the gates table (second table with Name, Type, Class, Max Aircraft Size)
    const allGates: GateInfo[] = [];
    
    // Match table rows: <tr><td>Name</td><td>Type</td><td>Class</td><td>Max Aircraft Size</td></tr>
    const rowRegex = /<tr[^>]*>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/gi;
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const name = match[1].replace(/<[^>]*>/g, "").trim();
      const type = match[2].replace(/<[^>]*>/g, "").trim();
      const gateClass = match[3].replace(/<[^>]*>/g, "").trim();
      const maxSize = match[4].replace(/<[^>]*>/g, "").trim();
      
      // Skip header rows and invalid entries
      if (name === "Name" || name === "Class" || !name || !gateClass || gateClass.length !== 1) continue;
      // Skip non-airline gates (hangars, maintenance, etc.) for events - only keep Airline type and None type gates
      if (type === "Cargo" || type === "GA" || name.toLowerCase().includes("hangar") || name.toLowerCase().includes("maintenance")) continue;
      
      allGates.push({ name, type, class: gateClass, max_aircraft_size: maxSize });
    }

    // If no aircraft specified, return all airline gates
    if (!aircraft_icao) {
      return new Response(JSON.stringify({ gates: allGates }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine aircraft class
    const acIcao = aircraft_icao.toUpperCase();
    let aircraftClass = aircraftClassMap[acIcao] || "E"; // Default to E (widebody) if unknown

    // Filter gates that can fit the aircraft
    let compatibleGates = allGates.filter(g => gateCanFitAircraft(g.class, aircraftClass));

    // If no exact match, try fallback: find gates that fit similar-sized aircraft
    if (compatibleGates.length === 0) {
      const fallbackClasses = getFallbackClasses(aircraftClass);
      for (const fbClass of fallbackClasses) {
        compatibleGates = allGates.filter(g => gateCanFitAircraft(g.class, fbClass));
        if (compatibleGates.length > 0) break;
      }
    }

    // If still nothing, return all gates as fallback
    if (compatibleGates.length === 0) {
      compatibleGates = allGates;
    }

    // Sort gates in series (by name naturally)
    compatibleGates.sort((a, b) => {
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });

    return new Response(JSON.stringify({ gates: compatibleGates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ gates: [], error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
