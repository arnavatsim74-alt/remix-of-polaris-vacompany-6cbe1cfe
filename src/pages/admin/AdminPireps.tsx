import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Search, Check, X, Pause, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AdminPireps() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPirep, setSelectedPirep] = useState<any>(null);
  const [actionType, setActionType] = useState<"approve" | "deny" | "hold" | null>(null);
  const [reason, setReason] = useState("");

  const { data: pireps, isLoading } = useQuery({
    queryKey: ["admin-pireps", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("pireps")
        .select(`
          *,
          pilots (pid, full_name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as "pending" | "approved" | "denied" | "on_hold");
      }

      const { data } = await query;
      return data || [];
    },
  });

  const updatePirepMutation = useMutation({
    mutationFn: async ({
      pirepId,
      status,
      reason,
    }: {
      pirepId: string;
      status: "pending" | "approved" | "denied" | "on_hold";
      reason?: string;
    }) => {
      const { error } = await supabase
        .from("pireps")
        .update({
          status,
          status_reason: reason || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", pirepId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pireps"] });
      toast.success("PIREP updated successfully");
      setSelectedPirep(null);
      setActionType(null);
      setReason("");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to update PIREP");
    },
  });

  const handleAction = (pirep: any, action: "approve" | "deny" | "hold") => {
    if (action === "approve") {
      updatePirepMutation.mutate({ pirepId: pirep.id, status: "approved" });
    } else {
      setSelectedPirep(pirep);
      setActionType(action);
    }
  };

  const submitAction = () => {
    if (!selectedPirep || !actionType) return;
    if ((actionType === "deny" || actionType === "hold") && !reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    const status = actionType === "deny" ? "denied" : "on_hold";
    updatePirepMutation.mutate({
      pirepId: selectedPirep.id,
      status,
      reason,
    });
  };

  const filteredPireps = pireps?.filter((pirep) => {
    const matchesSearch =
      searchQuery === "" ||
      pirep.flight_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pirep.pilots?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pirep.pilots?.pid?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: "status-pending",
      approved: "status-approved",
      denied: "status-denied",
      on_hold: "status-on-hold",
    };
    return (
      <Badge variant="outline" className={variants[status] || ""}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Manage PIREPs</h1>
          <p className="text-muted-foreground">Review and approve pilot reports</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by pilot name, PID, or flight number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* PIREPs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Flight Reports</CardTitle>
          <CardDescription>{filteredPireps?.length || 0} PIREPs found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredPireps && filteredPireps.length > 0 ? (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Pilot</th>
                    <th className="text-left py-3 px-2 font-medium">Date</th>
                    <th className="text-left py-3 px-2 font-medium">Flight</th>
                    <th className="text-left py-3 px-2 font-medium">Route</th>
                    <th className="text-left py-3 px-2 font-medium">Aircraft</th>
                    <th className="text-left py-3 px-2 font-medium">Operator</th>
                    <th className="text-left py-3 px-2 font-medium">Type</th>
                    <th className="text-left py-3 px-2 font-medium">Hours</th>
                    <th className="text-left py-3 px-2 font-medium">Multiplier</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-right py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPireps.map((pirep) => (
                    <tr key={pirep.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{pirep.pilots?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{pirep.pilots?.pid}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {format(new Date(pirep.flight_date), "MMM dd, yyyy")}
                      </td>
                      <td className="py-3 px-2 font-medium">{pirep.flight_number}</td>
                      <td className="py-3 px-2 font-mono">
                        {pirep.dep_icao} → {pirep.arr_icao}
                      </td>
                      <td className="py-3 px-2">{pirep.aircraft_icao}</td>
                      <td className="py-3 px-2 text-muted-foreground">{pirep.operator}</td>
                      <td className="py-3 px-2">
                        <Badge variant="secondary" className="capitalize">
                          {pirep.flight_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        {Number(pirep.flight_hours).toFixed(1)}
                      </td>
                      <td className="py-3 px-2">
                        <span className="font-mono">×{pirep.multiplier}</span>
                      </td>
                      <td className="py-3 px-2">{getStatusBadge(pirep.status)}</td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {pirep.status !== "approved" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                              onClick={() => handleAction(pirep, "approve")}
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          {pirep.status !== "denied" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleAction(pirep, "deny")}
                              title="Deny"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          {pirep.status !== "on_hold" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-warning hover:text-warning hover:bg-warning/10"
                              onClick={() => handleAction(pirep, "hold")}
                              title="Put On Hold"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                          {pirep.status === "approved" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:bg-muted"
                              onClick={() => handleAction(pirep, "deny")}
                              title="Revoke (Deny)"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {pirep.status_reason && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate text-right" title={pirep.status_reason}>
                            Note: {pirep.status_reason}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No PIREPs found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deny/Hold Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "deny" ? "Deny PIREP" : "Put PIREP On Hold"}
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for this action.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button
              variant={actionType === "deny" ? "destructive" : "default"}
              onClick={submitAction}
              disabled={updatePirepMutation.isPending}
            >
              {actionType === "deny" ? "Deny" : "Put On Hold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
