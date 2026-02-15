import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Plus, Trash2, Calendar, Users, Upload, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AdminEvents() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: "",
    description: "",
    server: "Expert",
    start_time: "",
    end_time: "",
    dep_icao: "",
    arr_icao: "",
    available_dep_gates: "",
    available_arr_gates: "",
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .order("start_time", { ascending: false });
      return data || [];
    },
  });

  const { data: registrations } = useQuery({
    queryKey: ["admin-event-registrations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_registrations")
        .select("event_id");
      return data || [];
    },
  });

  const getRegistrationCount = (eventId: string) => {
    return registrations?.filter((r) => r.event_id === eventId).length || 0;
  };

  const addEventMutation = useMutation({
    mutationFn: async (event: typeof newEvent) => {
      setIsUploading(true);
      let bannerUrl = null;

      // Upload banner if provided
      if (bannerFile) {
        const fileExt = bannerFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('event-banners')
          .upload(fileName, bannerFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event-banners')
          .getPublicUrl(fileName);

        bannerUrl = publicUrl;
      }

      const { error } = await supabase.from("events").insert({
        name: event.name,
        description: event.description,
        server: event.server,
        start_time: event.start_time,
        end_time: event.end_time,
        dep_icao: event.dep_icao.toUpperCase(),
        arr_icao: event.arr_icao.toUpperCase(),
        banner_url: bannerUrl,
        available_dep_gates: event.available_dep_gates
          ? event.available_dep_gates.split(",").map((g) => g.trim())
          : [],
        available_arr_gates: event.available_arr_gates
          ? event.available_arr_gates.split(",").map((g) => g.trim())
          : [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success("Event created successfully");
      setIsAddDialogOpen(false);
      setBannerFile(null);
      setNewEvent({
        name: "",
        description: "",
        server: "Expert",
        start_time: "",
        end_time: "",
        dep_icao: "",
        arr_icao: "",
        available_dep_gates: "",
        available_arr_gates: "",
      });
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to create event");
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success("Event deleted");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to delete event");
    },
  });

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Manage Events</h1>
            <p className="text-muted-foreground">Create and manage group flights</p>
          </div>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
              <DialogDescription>Set up a new group flight event</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="space-y-2">
                <Label>Event Name</Label>
                <Input
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                  placeholder="Group Flight to London"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Event description..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Event Banner</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  {bannerFile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                      {bannerFile.name}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Server</Label>
                <Select
                  value={newEvent.server}
                  onValueChange={(v) => setNewEvent({ ...newEvent, server: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Expert">Expert</SelectItem>
                    <SelectItem value="Training">Training</SelectItem>
                    <SelectItem value="Casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Time (UTC)</Label>
                  <Input
                    type="datetime-local"
                    value={newEvent.start_time}
                    onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time (UTC)</Label>
                  <Input
                    type="datetime-local"
                    value={newEvent.end_time}
                    onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Departure ICAO</Label>
                  <Input
                    value={newEvent.dep_icao}
                    onChange={(e) => setNewEvent({ ...newEvent, dep_icao: e.target.value.toUpperCase() })}
                    placeholder="UUEE"
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Arrival ICAO</Label>
                  <Input
                    value={newEvent.arr_icao}
                    onChange={(e) => setNewEvent({ ...newEvent, arr_icao: e.target.value.toUpperCase() })}
                    placeholder="EGLL"
                    maxLength={4}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Available Departure Gates (comma separated)</Label>
                <Input
                  value={newEvent.available_dep_gates}
                  onChange={(e) => setNewEvent({ ...newEvent, available_dep_gates: e.target.value })}
                  placeholder="A1, A2, A3, B1, B2"
                />
              </div>
              <div className="space-y-2">
                <Label>Available Arrival Gates (comma separated)</Label>
                <Input
                  value={newEvent.available_arr_gates}
                  onChange={(e) => setNewEvent({ ...newEvent, available_arr_gates: e.target.value })}
                  placeholder="T5A, T5B, T5C"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => addEventMutation.mutate(newEvent)}
                disabled={addEventMutation.isPending || isUploading}
              >
                {isUploading && <Upload className="h-4 w-4 mr-2 animate-spin" />}
                Create Event
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>{events?.length || 0} events</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : events && events.length > 0 ? (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Event</th>
                    <th className="text-left py-3 px-2 font-medium">Server</th>
                    <th className="text-left py-3 px-2 font-medium">Route</th>
                    <th className="text-left py-3 px-2 font-medium">Date</th>
                    <th className="text-left py-3 px-2 font-medium">Registrations</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-right py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const isPast = new Date(event.end_time) < new Date();
                    const isOngoing = new Date(event.start_time) <= new Date() && new Date(event.end_time) >= new Date();

                    return (
                      <tr key={event.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium">{event.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {event.description || "No description"}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="secondary">{event.server}</Badge>
                        </td>
                        <td className="py-3 px-2 font-mono">
                          {event.dep_icao} → {event.arr_icao}
                        </td>
                        <td className="py-3 px-2">
                          {format(new Date(event.start_time), "MMM dd, HH:mm")}z
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {getRegistrationCount(event.id)}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          {isPast ? (
                            <Badge variant="secondary">Ended</Badge>
                          ) : isOngoing ? (
                            <Badge className="bg-success text-success-foreground">Ongoing</Badge>
                          ) : (
                            <Badge variant="outline">Upcoming</Badge>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteEventMutation.mutate(event.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No events found</p>
              <p className="text-sm">Create your first event</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
