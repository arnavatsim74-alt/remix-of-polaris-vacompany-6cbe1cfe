import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Activity, Clock, FileText, Users, Plane, CalendarOff, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function ActivityPage() {
  const { pilot } = useAuth();
  const queryClient = useQueryClient();
  const [loaOpen, setLoaOpen] = useState(false);
  const [loaForm, setLoaForm] = useState({ start_date: "", end_date: "", reason: "" });

  // Pilot stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["pilot-activity-stats", pilot?.id],
    queryFn: async () => {
      if (!pilot?.id) return null;
      const { data: pireps } = await supabase
        .from("pireps")
        .select("flight_hours, multiplier, status, created_at, flight_date")
        .eq("pilot_id", pilot.id);

      const totalPireps = pireps?.length || 0;
      const approvedPireps = pireps?.filter(p => p.status === "approved").length || 0;
      const totalHours = pireps?.filter(p => p.status === "approved").reduce((sum, p) => sum + Number(p.flight_hours) * Number(p.multiplier || 1), 0) || 0;
      const hours = Math.floor(totalHours);
      const mins = Math.round((totalHours - hours) * 60);

      // Last PIREP date (prefer flight_date over created_at to avoid always-0-day issue)
      const sortedPireps = (pireps || []).sort((a: any, b: any) => {
        const aTime = new Date(a.flight_date || a.created_at).getTime();
        const bTime = new Date(b.flight_date || b.created_at).getTime();
        return bTime - aTime;
      });
      const lastPirepDate = sortedPireps?.[0]?.flight_date || sortedPireps?.[0]?.created_at;

      return { totalPireps, approvedPireps, totalHours, hours, mins, lastPirepDate };
    },
    enabled: !!pilot?.id,
  });

  // Activity requirement
  const { data: activityReq } = useQuery({
    queryKey: ["activity-requirement"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "activity_pirep_days").maybeSingle();
      return data?.value ? parseInt(data.value) : null;
    },
  });

  // LOA requests
  const { data: loaRequests } = useQuery({
    queryKey: ["pilot-loa", pilot?.id],
    queryFn: async () => {
      if (!pilot?.id) return [];
      const { data } = await supabase
        .from("loa_requests")
        .select("*")
        .eq("pilot_id", pilot.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!pilot?.id,
  });

  const loaMutation = useMutation({
    mutationFn: async () => {
      if (!pilot?.id) throw new Error("No pilot");
      const { error } = await supabase.from("loa_requests").insert({
        pilot_id: pilot.id,
        start_date: loaForm.start_date,
        end_date: loaForm.end_date,
        reason: loaForm.reason || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pilot-loa"] });
      toast.success("Leave of Absence request submitted");
      setLoaOpen(false);
      setLoaForm({ start_date: "", end_date: "", reason: "" });
    },
    onError: () => toast.error("Failed to submit LOA request"),
  });

  // Check activity compliance
  const isCompliant = (() => {
    if (!activityReq || !stats?.lastPirepDate) return null;
    const daysSinceLastPirep = Math.floor((Date.now() - new Date(stats.lastPirepDate).getTime()) / (1000 * 60 * 60 * 24));
    // Check if currently on LOA
    const onLoa = loaRequests?.some(l => l.status === "approved" && new Date(l.start_date) <= new Date() && new Date(l.end_date) >= new Date());
    if (onLoa) return true;
    return daysSinceLastPirep <= activityReq;
  })();

  const daysSinceLast = stats?.lastPirepDate
    ? Math.floor((Date.now() - new Date(stats.lastPirepDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Activity</h1>
          <p className="text-muted-foreground">Your flight activity and leave management</p>
        </div>
      </div>

      {/* Activity Status */}
      {activityReq && (
        <Card className={isCompliant === false ? "border-destructive" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {isCompliant === false ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : (
                <Activity className="h-5 w-5 text-green-500" />
              )}
              <div>
                <p className="font-medium">
                  {isCompliant === false
                    ? "Activity requirement not met"
                    : isCompliant === true
                    ? "Activity requirement met"
                    : "No PIREPs filed yet"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Policy: At least 1 PIREP every {activityReq} days
                  {daysSinceLast !== null && ` · Last PIREP: ${daysSinceLast} day${daysSinceLast !== 1 ? "s" : ""} ago`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Flight Time (Approved)</p>
              <p className="text-2xl font-bold mt-1">{stats?.hours || 0}h {stats?.mins || 0}m</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PIREPs Filed (Total)</p>
              <p className="text-2xl font-bold mt-1">{stats?.totalPireps || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PIREPs (Approved)</p>
              <p className="text-2xl font-bold mt-1">{stats?.approvedPireps || 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leave of Absence */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Leave of Absence</CardTitle>
            <CardDescription>Request time off from activity requirements</CardDescription>
          </div>
          <Dialog open={loaOpen} onOpenChange={setLoaOpen}>
            <DialogTrigger asChild>
              <Button>
                <CalendarOff className="h-4 w-4 mr-2" />
                Request LOA
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Leave of Absence</DialogTitle>
                <DialogDescription>Submit a request for time off from activity requirements.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={loaForm.start_date} onChange={e => setLoaForm({ ...loaForm, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={loaForm.end_date} onChange={e => setLoaForm({ ...loaForm, end_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reason (optional)</Label>
                  <Textarea value={loaForm.reason} onChange={e => setLoaForm({ ...loaForm, reason: e.target.value })} placeholder="Vacation, personal reasons, etc." rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLoaOpen(false)}>Cancel</Button>
                <Button onClick={() => loaMutation.mutate()} disabled={loaMutation.isPending || !loaForm.start_date || !loaForm.end_date}>Submit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loaRequests && loaRequests.length > 0 ? (
            <div className="space-y-2">
              {loaRequests.map((loa: any) => (
                <div key={loa.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{new Date(loa.start_date).toLocaleDateString()} — {new Date(loa.end_date).toLocaleDateString()}</p>
                    {loa.reason && <p className="text-xs text-muted-foreground">{loa.reason}</p>}
                  </div>
                  <Badge variant={loa.status === "approved" ? "default" : loa.status === "denied" ? "destructive" : "secondary"}>
                    {loa.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-sm text-muted-foreground">No leave requests</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
