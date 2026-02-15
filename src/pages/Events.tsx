import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Clock, Users, Plane, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Events() {
  const { pilot } = useAuth();
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .gte("end_time", new Date().toISOString())
        .order("start_time");
      return data || [];
    },
  });

  const { data: registrations } = useQuery({
    queryKey: ["event-registrations", pilot?.id],
    queryFn: async () => {
      if (!pilot?.id) return [];
      const { data } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("pilot_id", pilot.id);
      return data || [];
    },
    enabled: !!pilot?.id,
  });

  const joinEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!pilot?.id) throw new Error("Pilot not found");

      // Get event details for gate assignment
      const { data: event } = await supabase
        .from("events")
        .select("available_dep_gates, available_arr_gates")
        .eq("id", eventId)
        .single();

      // Get existing registrations to find used gates
      const { data: existingRegs } = await supabase
        .from("event_registrations")
        .select("assigned_dep_gate, assigned_arr_gate")
        .eq("event_id", eventId);

      const usedDepGates = existingRegs?.map((r) => r.assigned_dep_gate).filter(Boolean) || [];
      const usedArrGates = existingRegs?.map((r) => r.assigned_arr_gate).filter(Boolean) || [];

      const availableDepGates = (event?.available_dep_gates || []).filter(
        (g: string) => !usedDepGates.includes(g)
      );
      const availableArrGates = (event?.available_arr_gates || []).filter(
        (g: string) => !usedArrGates.includes(g)
      );

      const { error } = await supabase.from("event_registrations").insert({
        event_id: eventId,
        pilot_id: pilot.id,
        assigned_dep_gate: availableDepGates[0] || null,
        assigned_arr_gate: availableArrGates[0] || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations"] });
      toast.success("Successfully registered for event!");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to register for event");
    },
  });

  const isRegistered = (eventId: string) => {
    return registrations?.some((r) => r.event_id === eventId);
  };

  const getRegistration = (eventId: string) => {
    return registrations?.find((r) => r.event_id === eventId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Calendar className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted-foreground">Join upcoming group flights and events</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : events && events.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const registered = isRegistered(event.id);
            const registration = getRegistration(event.id);

            return (
              <Card key={event.id} className="overflow-hidden">
                {/* Banner */}
                <div className="h-40 bg-gradient-to-br from-primary/20 to-primary/5 relative">
                  {event.banner_url ? (
                    <img
                      src={event.banner_url}
                      alt={event.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Plane className="h-16 w-16 text-primary/30" />
                    </div>
                  )}
                  <Badge className="absolute top-3 right-3">{event.server}</Badge>
                </div>

                <CardHeader>
                  <CardTitle className="line-clamp-1">{event.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {event.description || "No description provided"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Time */}
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(event.start_time), "MMM dd, HH:mm")}z -{" "}
                      {format(new Date(event.end_time), "HH:mm")}z
                    </span>
                  </div>

                  {/* Route */}
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">
                      {event.dep_icao} → {event.arr_icao}
                    </span>
                  </div>

                  {/* Gates if registered */}
                  {registered && registration && (
                    <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                      <p className="font-medium flex items-center gap-2">
                        <Check className="h-4 w-4 text-success" />
                        Registered
                      </p>
                      <p className="text-muted-foreground">
                        Departure Gate: {registration.assigned_dep_gate || "N/A"}
                      </p>
                      <p className="text-muted-foreground">
                        Arrival Gate: {registration.assigned_arr_gate || "N/A"}
                      </p>
                    </div>
                  )}

                  {/* Join Button */}
                  {!registered && (
                    <Button
                      className="w-full"
                      onClick={() => joinEventMutation.mutate(event.id)}
                      disabled={joinEventMutation.isPending}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Join Event
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No upcoming events</p>
            <p className="text-sm text-muted-foreground">Check back later for new events</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
