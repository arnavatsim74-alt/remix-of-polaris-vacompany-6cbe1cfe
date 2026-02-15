import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Clock } from "lucide-react";
import { format, isPast, isToday } from "date-fns";

export function UpcomingEvents() {
  const navigate = useNavigate();

  const { data: upcomingEvents, isLoading } = useQuery({
    queryKey: ["upcoming-events-dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .gte("end_time", new Date().toISOString())
        .order("start_time")
        .limit(2);
      return data || [];
    },
  });

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

  if (!upcomingEvents || upcomingEvents.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-primary" />
          Upcoming Events
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcomingEvents.map((event) => {
          const startDate = new Date(event.start_time);
          const isHappeningNow = isPast(startDate) && !isPast(new Date(event.end_time));
          const isEventToday = isToday(startDate);

          return (
            <div key={event.id} className="p-3 bg-muted/50 rounded-lg space-y-2 overflow-hidden">
              {event.banner_url && (
                <div className="relative h-24 -mx-3 -mt-3 mb-2 overflow-hidden">
                  <img src={event.banner_url} alt={event.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium">{event.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{event.dep_icao} → {event.arr_icao}</span>
                  </div>
                </div>
                {isHappeningNow && (
                  <Badge className="bg-primary/10 text-primary border-primary/30">
                    Live
                  </Badge>
                )}
                {isEventToday && !isHappeningNow && (
                  <Badge variant="secondary">Today</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  {format(startDate, "MMM dd, HH:mm")} - {format(new Date(event.end_time), "HH:mm")} UTC
                </span>
              </div>
            </div>
          );
        })}
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={() => navigate("/events")}
        >
          View All Events
        </Button>
      </CardContent>
    </Card>
  );
}
