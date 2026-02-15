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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Check, X, Search, Users, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AdminApplications() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [assignedPid, setAssignedPid] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: applications, isLoading } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pilot_applications")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: nextPid } = useQuery({
    queryKey: ["next-pid"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_next_pid");
      return data as string;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ appId, userId, fullName, pid, vatsimId, ivaoId }: any) => {
      // Create pilot record
      const { error: pilotError } = await supabase.from("pilots").insert({
        user_id: userId,
        pid,
        full_name: fullName,
        vatsim_id: vatsimId,
        ivao_id: ivaoId,
      });

      if (pilotError) throw pilotError;

      // Add pilot role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: "pilot",
      });

      if (roleError) throw roleError;

      // Update application
      const { error: appError } = await supabase
        .from("pilot_applications")
        .update({
          status: "approved",
          assigned_pid: pid,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", appId);

      if (appError) throw appError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      queryClient.invalidateQueries({ queryKey: ["next-pid"] });
      toast.success("Application approved! Pilot account created.");
      setSelectedApp(null);
      setActionType(null);
      setAssignedPid("");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to approve application");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ appId, reason }: { appId: string; reason: string }) => {
      const { error } = await supabase
        .from("pilot_applications")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", appId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      toast.success("Application rejected");
      setSelectedApp(null);
      setActionType(null);
      setRejectionReason("");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to reject application");
    },
  });

  const handleApprove = (app: any) => {
    setSelectedApp(app);
    setActionType("approve");
    setAssignedPid(nextPid || "");
  };

  const handleReject = (app: any) => {
    setSelectedApp(app);
    setActionType("reject");
  };

  const submitApproval = () => {
    if (!selectedApp || !assignedPid) return;
    approveMutation.mutate({
      appId: selectedApp.id,
      userId: selectedApp.user_id,
      fullName: selectedApp.full_name,
      pid: assignedPid,
      vatsimId: selectedApp.vatsim_id,
      ivaoId: selectedApp.ivao_id,
    });
  };

  const submitRejection = () => {
    if (!selectedApp || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    rejectMutation.mutate({
      appId: selectedApp.id,
      reason: rejectionReason,
    });
  };

  const filteredApps = applications?.filter((app) => {
    const matchesSearch =
      searchQuery === "" ||
      app.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const pendingCount = applications?.filter((a) => a.status === "pending").length || 0;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: "status-pending",
      approved: "status-approved",
      rejected: "status-denied",
    };
    return (
      <Badge variant="outline" className={variants[status] || ""}>
        {status.toUpperCase()}
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
          <h1 className="text-2xl font-bold">Pilot Applications</h1>
          <p className="text-muted-foreground">
            Review and approve new pilot applications
            {pendingCount > 0 && (
              <Badge className="ml-2" variant="secondary">
                {pendingCount} pending
              </Badge>
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>{filteredApps?.length || 0} applications</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredApps && filteredApps.length > 0 ? (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Applicant</th>
                    <th className="text-left py-3 px-2 font-medium">Experience</th>
                    <th className="text-left py-3 px-2 font-medium">Simulator</th>
                    <th className="text-left py-3 px-2 font-medium">Applied</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-right py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map((app) => (
                    <tr key={app.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{app.full_name}</p>
                          <p className="text-xs text-muted-foreground">{app.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2 capitalize">{app.experience_level}</td>
                      <td className="py-3 px-2">{app.preferred_simulator}</td>
                      <td className="py-3 px-2">
                        {format(new Date(app.created_at), "MMM dd, yyyy")}
                      </td>
                      <td className="py-3 px-2">
                        {getStatusBadge(app.status)}
                        {app.assigned_pid && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({app.assigned_pid})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {app.status === "pending" ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                              onClick={() => handleApprove(app)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleReject(app)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setSelectedApp(app)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No applications found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={actionType === "approve"} onOpenChange={() => setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Application</DialogTitle>
            <DialogDescription>
              Assign a Pilot ID to {selectedApp?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg text-sm">
              <p><strong>Name:</strong> {selectedApp?.full_name}</p>
              <p><strong>Email:</strong> {selectedApp?.email}</p>
              <p><strong>Experience:</strong> {selectedApp?.experience_level}</p>
              <p><strong>Simulator:</strong> {selectedApp?.preferred_simulator}</p>
              {selectedApp?.vatsim_id && <p><strong>VATSIM:</strong> {selectedApp?.vatsim_id}</p>}
              {selectedApp?.ivao_id && <p><strong>IVAO:</strong> {selectedApp?.ivao_id}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Assigned PID</label>
              <Input
                value={assignedPid}
                onChange={(e) => setAssignedPid(e.target.value.toUpperCase())}
                placeholder="AFLV0001"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitApproval}
              disabled={approveMutation.isPending || !assignedPid}
            >
              Approve & Create Pilot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionType === "reject"} onOpenChange={() => setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting {selectedApp?.full_name}'s application
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitRejection}
              disabled={rejectMutation.isPending}
            >
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!selectedApp && !actionType} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium">{selectedApp?.full_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{selectedApp?.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Experience</p>
                <p className="font-medium capitalize">{selectedApp?.experience_level}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Simulator</p>
                <p className="font-medium">{selectedApp?.preferred_simulator}</p>
              </div>
              {selectedApp?.vatsim_id && (
                <div>
                  <p className="text-muted-foreground">VATSIM ID</p>
                  <p className="font-medium">{selectedApp?.vatsim_id}</p>
                </div>
              )}
              {selectedApp?.ivao_id && (
                <div>
                  <p className="text-muted-foreground">IVAO VID</p>
                  <p className="font-medium">{selectedApp?.ivao_id}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-sm mb-1">Reason for Joining</p>
              <p className="text-sm bg-muted p-3 rounded-lg">{selectedApp?.reason_for_joining}</p>
            </div>
            {selectedApp?.status === "rejected" && selectedApp?.rejection_reason && (
              <div>
                <p className="text-muted-foreground text-sm mb-1">Rejection Reason</p>
                <p className="text-sm bg-destructive/10 text-destructive p-3 rounded-lg">
                  {selectedApp?.rejection_reason}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedApp(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
