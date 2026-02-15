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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Plus, Trash2, Edit, Target } from "lucide-react";
import { toast } from "sonner";

export default function AdminChallenges() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", destination_icao: "", image_url: "" });

  const { data: challenges, isLoading } = useQuery({
    queryKey: ["admin-challenges"],
    queryFn: async () => {
      const { data } = await supabase.from("challenges").select("*").order("created_at");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form & { id?: string }) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        destination_icao: data.destination_icao || null,
        image_url: data.image_url || null,
      };
      if (data.id) {
        const { error } = await supabase.from("challenges").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("challenges").insert(payload);
        if (error) throw error;

        // Send Discord notification for new challenge
        try {
          await supabase.functions.invoke("discord-rank-notification", {
            body: {
              type: "new_challenge",
              name: data.name,
              description: data.description || null,
              destination_icao: data.destination_icao || null,
              image_url: data.image_url || null,
            },
          });
        } catch (e) {
          console.error("Discord challenge notification failed:", e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
      toast.success(editingId ? "Challenge updated" : "Challenge created & sent to Discord");
      closeDialog();
    },
    onError: () => toast.error("Failed to save challenge"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("challenges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
      toast.success("Challenge deleted");
    },
    onError: () => toast.error("Failed to delete challenge"),
  });

  const closeDialog = () => { setIsDialogOpen(false); setEditingId(null); setForm({ name: "", description: "", destination_icao: "", image_url: "" }); };

  const openEdit = (ch: any) => {
    setEditingId(ch.id);
    setForm({ name: ch.name, description: ch.description || "", destination_icao: ch.destination_icao || "", image_url: ch.image_url || "" });
    setIsDialogOpen(true);
  };

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Manage Challenges</h1>
            <p className="text-muted-foreground">Create and manage pilot challenges</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingId(null); setForm({ name: "", description: "", destination_icao: "", image_url: "" }); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add Challenge
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Challenge" : "Create Challenge"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="WT1" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="File a PIREP with the destination of KJFK" />
              </div>
              <div className="space-y-2">
                <Label>Destination ICAO (optional)</Label>
                <Input value={form.destination_icao} onChange={(e) => setForm({ ...form, destination_icao: e.target.value.toUpperCase() })} placeholder="KJFK" maxLength={4} />
              </div>
              <div className="space-y-2">
                <Label>Image URL (optional)</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate({ ...form, id: editingId || undefined })} disabled={saveMutation.isPending}>
                {editingId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Challenges</CardTitle>
          <CardDescription>{challenges?.length || 0} challenges</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : challenges && challenges.length > 0 ? (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Name</th>
                    <th className="text-left py-3 px-2 font-medium">Description</th>
                    <th className="text-left py-3 px-2 font-medium">Destination</th>
                    <th className="text-right py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((ch) => (
                    <tr key={ch.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{ch.name}</td>
                      <td className="py-3 px-2 text-muted-foreground max-w-[300px] truncate">{ch.description || "-"}</td>
                      <td className="py-3 px-2 font-mono">{ch.destination_icao || "-"}</td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(ch)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(ch.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No challenges yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
