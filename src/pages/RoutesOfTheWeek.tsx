import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Plane, FileText, Clock } from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";

const rankLabels: Record<string, string> = {
  cadet: "Cadet",
  first_officer: "First Officer",
  captain: "Captain",
  senior_captain: "Senior Captain",
  commander: "Commander",
};

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function RoutesOfTheWeek() {
  const navigate = useNavigate();
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const todayDow = (new Date().getDay() + 6) % 7; // Mon=0 ... Sun=6

  const { data: rotwRoutes, isLoading } = useQuery({
    queryKey: ["rotw", currentWeekStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("routes_of_week")
        .select(`
          id,
          week_start,
          day_of_week,
          route:routes (
            id,
            route_number,
            dep_icao,
            arr_icao,
            aircraft_icao,
            livery,
            route_type,
            est_flight_time_minutes,
            min_rank,
            notes
          )
        `)
        .eq("week_start", format(currentWeekStart, "yyyy-MM-dd"))
        .order("day_of_week");
      return data || [];
    },
  });

  const formatFlightTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  const handleFilePirep = (route: any) => {
    navigate(`/file-pirep?dep=${route.dep_icao}&arr=${route.arr_icao}&aircraft=${route.aircraft_icao || ""}&flight=${route.route_number}&type=${route.route_type}`);
  };

  const getRouteForDay = (dayIndex: number) => {
    return rotwRoutes?.find((r: any) => r.day_of_week === dayIndex);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Star className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Routes of the Week</h1>
          <p className="text-muted-foreground">
            Daily featured routes for {format(currentWeekStart, "MMM dd")} – {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "MMM dd, yyyy")}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {dayNames.map((dayName, dayIndex) => {
            const rotw: any = getRouteForDay(dayIndex);
            const isToday = dayIndex === todayDow;
            const dayDate = addDays(currentWeekStart, dayIndex);

            return (
              <Card
                key={dayIndex}
                className={isToday ? "border-primary/50 bg-primary/5" : ""}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Day label */}
                    <div className="w-24 shrink-0">
                      <p className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                        {dayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(dayDate, "MMM dd")}
                      </p>
                      {isToday && (
                        <Badge className="mt-1 bg-primary/20 text-primary border-primary/30 text-[10px]">
                          Today
                        </Badge>
                      )}
                    </div>

                    {rotw?.route ? (
                      <div className="flex-1 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                          <div>
                            <p className="font-mono font-medium">{rotw.route.route_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {rotw.route.dep_icao} → {rotw.route.arr_icao}
                            </p>
                          </div>
                          <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Plane className="h-3.5 w-3.5" />
                              <span>
                                {rotw.route.aircraft_icao}
                                {rotw.route.livery && <span className="text-xs ml-1">({rotw.route.livery})</span>}
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatFlightTime(rotw.route.est_flight_time_minutes)}
                            </span>
                            <Badge variant="outline" className="capitalize text-xs">
                              {rankLabels[rotw.route.min_rank] || rotw.route.min_rank}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleFilePirep(rotw.route)}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1.5" />
                          File PIREP
                        </Button>
                      </div>
                    ) : (
                      <div className="flex-1 text-sm text-muted-foreground italic">
                        No route assigned
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
