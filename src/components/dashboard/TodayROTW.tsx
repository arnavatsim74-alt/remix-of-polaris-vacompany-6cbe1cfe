import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Plane, Clock, FileText } from "lucide-react";
import { format, startOfWeek } from "date-fns";

const rankLabels: Record<string, string> = {
  cadet: "Cadet",
  first_officer: "First Officer",
  captain: "Captain",
  senior_captain: "Senior Captain",
  commander: "Commander",
};

export function TodayROTW() {
  const navigate = useNavigate();
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const todayDow = (new Date().getDay() + 6) % 7; // Mon=0 ... Sun=6

  const { data: todayRotw, isLoading } = useQuery({
    queryKey: ["today-rotw", currentWeekStart.toISOString()],
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
        .eq("day_of_week", todayDow)
        .maybeSingle();
      return data;
    },
  });

  const formatFlightTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  const handleFilePirep = (route: any) => {
    navigate(`/file-pirep?dep=${route.dep_icao}&arr=${route.arr_icao}&aircraft=${route.aircraft_icao}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  if (!todayRotw?.route) {
    return null; // Don't show if no ROTW for today
  }

  const route = todayRotw.route as any;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Star className="h-5 w-5 text-primary" />
          Today's Route of the Week
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-bold">{route.route_number}</span>
              <Badge variant="secondary" className="capitalize">
                {route.route_type}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-lg">
              <span className="font-mono font-medium">{route.dep_icao}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-mono font-medium">{route.arr_icao}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Plane className="h-4 w-4" />
                <span>
                  {route.aircraft_icao}
                  {route.livery && <span className="text-xs ml-1">({route.livery})</span>}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatFlightTime(route.est_flight_time_minutes)}
              </span>
              <Badge variant="outline" className="text-xs">
                {rankLabels[route.min_rank] || route.min_rank}
              </Badge>
            </div>
          </div>
          <Button onClick={() => handleFilePirep(route)}>
            <FileText className="h-4 w-4 mr-2" />
            File PIREP
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
