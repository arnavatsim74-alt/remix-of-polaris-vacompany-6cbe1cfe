import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Plane, Clock, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export function DailyFeaturedRoutes() {
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: featuredRoutes } = useQuery({
    queryKey: ["daily-featured", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_featured_routes")
        .select(`
          id,
          route:routes (
            id, route_number, dep_icao, arr_icao, aircraft_icao,
            route_type, est_flight_time_minutes
          )
        `)
        .eq("featured_date", today);
      return data || [];
    },
  });

  if (!featuredRoutes || featuredRoutes.length === 0) return null;

  const formatFlightTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Daily Featured Routes
          <Badge className="bg-primary/20 text-primary border-primary/30 text-xs ml-auto">2x Multiplier</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {featuredRoutes.map((fr: any) => {
          const route = fr.route;
          if (!route) return null;
          return (
            <div key={fr.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-mono font-medium">{route.route_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {route.dep_icao} → {route.arr_icao}
                  </p>
                </div>
                <div className="hidden md:flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Plane className="h-3.5 w-3.5" />
                    {route.aircraft_icao}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatFlightTime(route.est_flight_time_minutes)}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  navigate(
                    `/file-pirep?dep=${route.dep_icao}&arr=${route.arr_icao}&aircraft=${route.aircraft_icao || ""}&flight=${route.route_number}&type=${route.route_type}`
                  )
                }
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                File PIREP
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
