import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Plane } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const operators = [
  "Aeroflot", "Azerbaijan Airlines", "Uzbekistan Airways", "Belavia",
  "S7 Airlines", "AirBridge Cargo", "Saudia", "Emirates", "Fly Dubai",
  "Emirates SkyCargo", "Aegean Airlines", "Qatar Airways",
  "SunCountry Airlines", "IndiGo", "Oman Air", "Others",
];

export default function FilePirep() {
  const { pilot } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [flightNumber, setFlightNumber] = useState("");
  const [depIcao, setDepIcao] = useState("");
  const [arrIcao, setArrIcao] = useState("");
  const [aircraftIcao, setAircraftIcao] = useState("");
  const [flightHours, setFlightHours] = useState("");
  const [flightDate, setFlightDate] = useState<Date | undefined>(new Date());
  const [selectedMultiplier, setSelectedMultiplier] = useState("1");
  const [operator, setOperator] = useState("");
  const [flightType, setFlightType] = useState<"passenger" | "cargo">("passenger");
  const [isLoading, setIsLoading] = useState(false);

  // Pre-fill from URL params (from Routes / ROTW "File PIREP" buttons)
  useEffect(() => {
    const dep = searchParams.get("dep");
    const arr = searchParams.get("arr");
    const ac = searchParams.get("aircraft");
    const fn = searchParams.get("flight");
    const ft = searchParams.get("type");
    if (dep) setDepIcao(dep);
    if (arr) setArrIcao(arr);
    if (ac) setAircraftIcao(ac);
    if (fn) setFlightNumber(fn);
    if (ft && (ft === "passenger" || ft === "cargo")) setFlightType(ft);
  }, [searchParams]);

  const { data: aircraft } = useQuery({
    queryKey: ["aircraft"],
    queryFn: async () => {
      const { data } = await supabase.from("aircraft").select("*").order("name");
      return data || [];
    },
  });

  const { data: multipliers } = useQuery({
    queryKey: ["multiplier-configs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("multiplier_configs")
        .select("*")
        .eq("is_active", true)
        .order("value");
      return data || [];
    },
  });

  const currentMultiplierValue = parseFloat(selectedMultiplier) || 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pilot?.id) { toast.error("Pilot profile not found"); return; }
    if (!flightNumber || !depIcao || !arrIcao || !aircraftIcao || !flightHours || !flightDate || !operator) {
      toast.error("Please fill in all required fields"); return;
    }

    const hours = parseFloat(flightHours);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      toast.error("Please enter valid flight hours (0-24)"); return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from("pireps").insert({
        pilot_id: pilot.id,
        flight_number: flightNumber.toUpperCase(),
        dep_icao: depIcao.toUpperCase(),
        arr_icao: arrIcao.toUpperCase(),
        aircraft_icao: aircraftIcao,
        flight_hours: hours,
        flight_date: format(flightDate, "yyyy-MM-dd"),
        multiplier: currentMultiplierValue,
        operator,
        flight_type: flightType,
      });
      if (error) throw error;

      // Send Discord webhook notification for new PIREP
      try {
        await supabase.functions.invoke("discord-rank-notification", {
          body: {
            type: "new_pirep",
            pilot_name: pilot.full_name,
            pid: pilot.pid,
            flight_number: flightNumber.toUpperCase(),
            dep_icao: depIcao.toUpperCase(),
            arr_icao: arrIcao.toUpperCase(),
            aircraft_icao: aircraftIcao,
            flight_hours: hours,
            operator,
            flight_type: flightType,
          },
        });
      } catch (discordErr) {
        console.error("Discord notification failed:", discordErr);
      }

      toast.success("PIREP submitted successfully!");
      navigate("/pirep-history");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit PIREP");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plane className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>File PIREP</CardTitle>
              <CardDescription>Submit a new pilot report for your flight</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Flight Details</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="flightNumber">Flight Number *</Label>
                  <Input id="flightNumber" placeholder="AFL1234" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} disabled={isLoading} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flightDate">Flight Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !flightDate && "text-muted-foreground")} disabled={isLoading}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {flightDate ? format(flightDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={flightDate} onSelect={setFlightDate} disabled={(date) => date > new Date()} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="depIcao">Departure ICAO *</Label>
                  <Input id="depIcao" placeholder="UUEE" maxLength={4} value={depIcao} onChange={(e) => setDepIcao(e.target.value.toUpperCase())} disabled={isLoading} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arrIcao">Arrival ICAO *</Label>
                  <Input id="arrIcao" placeholder="EGLL" maxLength={4} value={arrIcao} onChange={(e) => setArrIcao(e.target.value.toUpperCase())} disabled={isLoading} required />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Aircraft & Duration</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="aircraft">Aircraft Type *</Label>
                  <Select value={aircraftIcao} onValueChange={setAircraftIcao} disabled={isLoading}>
                    <SelectTrigger><SelectValue placeholder="Select aircraft" /></SelectTrigger>
                    <SelectContent>
                      {aircraft?.map((ac) => (
                        <SelectItem key={ac.id} value={ac.icao_code}>
                          {ac.name}{ac.livery ? ` (${ac.livery})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flightHours">Flight Hours *</Label>
                  <Input id="flightHours" type="number" step="0.1" min="0.1" max="24" placeholder="2.5" value={flightHours} onChange={(e) => setFlightHours(e.target.value)} disabled={isLoading} required />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Operator & Classification</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="operator">Operator *</Label>
                  <Select value={operator} onValueChange={setOperator} disabled={isLoading}>
                    <SelectTrigger><SelectValue placeholder="Select operator" /></SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op} value={op}>{op}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flightType">Flight Type *</Label>
                  <Select value={flightType} onValueChange={(v) => setFlightType(v as "passenger" | "cargo")} disabled={isLoading}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passenger">Passenger</SelectItem>
                      <SelectItem value="cargo">Cargo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="multiplier">Hours Multiplier</Label>
              <Select value={selectedMultiplier} onValueChange={setSelectedMultiplier} disabled={isLoading}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {multipliers && multipliers.length > 0 ? (
                    multipliers.map((m) => (
                      <SelectItem key={m.id} value={String(m.value)}>
                        {m.name} ({Number(m.value).toFixed(1)}x)
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="1">Standard (1.0x)</SelectItem>
                      <SelectItem value="1.5">1.5x</SelectItem>
                      <SelectItem value="2">2.0x</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Effective hours: {(parseFloat(flightHours || "0") * currentMultiplierValue).toFixed(1)}
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit PIREP
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
