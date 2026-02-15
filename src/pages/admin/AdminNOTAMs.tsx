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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Plus, Trash2, AlertTriangle, Edit } from "lucide-react";
import { toast } from "sonner";

interface Notam {
  id: string;
  title: string;
  content: string;
  priority: "info" | "warning" | "critical";
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export default function AdminNOTAMs() {
  const { isAdmin, pilot } = useAuth();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingNotam, setEditingNotam] = useState<Notam | null>(null);
  const [newNotam, setNewNotam] = useState({
    title: "",
    content: "",
    priority: "info" as "info" | "warning" | "critical",
  });

  const { data: notams, isLoading } = useQuery({
    queryKey: ["admin-notams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notams")
        .select("*")
        .order("created_at", { ascending: false });
      return (data || []) as Notam[];
    },
  });

  const addNotamMutation = useMutation({
    mutationFn: async (notam: typeof newNotam) => {
      const { error } = await supabase.from("notams").insert({
        title: notam.title,
        content: notam.content,
        priority: notam.priority,
        created_by: pilot?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notams"] });
      toast.success("NOTAM created successfully");
      setIsAddDialogOpen(false);
      setNewNotam({ title: "", content: "", priority: "info" });
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to create NOTAM");
    },
  });

  const updateNotamMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Notam> }) => {
      const { error } = await supabase.from("notams").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notams"] });
      toast.success("NOTAM updated");
      setEditingNotam(null);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to update NOTAM");
    },
  });

  const deleteNotamMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notams"] });
      toast.success("NOTAM deleted");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to delete NOTAM");
    },
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "warning":
        return <Badge className="bg-accent/50 text-accent-foreground border-accent">Warning</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

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
            <h1 className="text-2xl font-bold">Manage NOTAMs</h1>
            <p className="text-muted-foreground">Create and manage notices for pilots</p>
          </div>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add NOTAM
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New NOTAM</DialogTitle>
              <DialogDescription>Add a notice for all pilots to see on their dashboard</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={newNotam.title}
                  onChange={(e) => setNewNotam({ ...newNotam, title: e.target.value })}
                  placeholder="NOTAM Title"
                />
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={newNotam.content}
                  onChange={(e) => setNewNotam({ ...newNotam, content: e.target.value })}
                  placeholder="NOTAM content..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={newNotam.priority}
                  onValueChange={(v) => setNewNotam({ ...newNotam, priority: v as typeof newNotam.priority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => addNotamMutation.mutate(newNotam)}
                disabled={addNotamMutation.isPending || !newNotam.title || !newNotam.content}
              >
                Create NOTAM
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>NOTAMs</CardTitle>
          <CardDescription>{notams?.length || 0} notices in database</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : notams && notams.length > 0 ? (
            <div className="space-y-3">
              {notams.map((notam) => (
                <div
                  key={notam.id}
                  className="p-4 border rounded-lg flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{notam.title}</h4>
                      {getPriorityBadge(notam.priority)}
                      <Badge variant={notam.is_active ? "default" : "secondary"}>
                        {notam.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{notam.content}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={notam.is_active}
                      onCheckedChange={(checked) =>
                        updateNotamMutation.mutate({ id: notam.id, updates: { is_active: checked } })
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteNotamMutation.mutate(notam.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No NOTAMs found</p>
              <p className="text-sm">Create your first NOTAM to notify pilots</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
