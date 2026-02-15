import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Plus, Trash2, Edit, Award } from "lucide-react";
import { toast } from "sonner";

interface RankForm {
  name: string;
  label: string;
  min_hours: number;
  max_hours: number | null;
  color: string;
  description: string;
  order_index: number;
}

const emptyForm: RankForm = {
  name: "",
  label: "",
  min_hours: 0,
  max_hours: null,
  color: "bg-slate-500",
  description: "",
  order_index: 0,
};

export default function AdminRanks() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RankForm>(emptyForm);

  const { data: ranks, isLoading } = useQuery({
    queryKey: ["admin-ranks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rank_configs")
        .select("*")
        .order("order_index");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: RankForm & { id?: string }) => {
      const payload = {
        name: data.name.toLowerCase().replace(/\s+/g, "_"),
        label: data.label,
        min_hours: data.min_hours,
        max_hours: data.max_hours,
        color: data.color,
        description: data.description,
        order_index: data.order_index,
      };

      if (data.id) {
        const { error } = await supabase.from("rank_configs").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rank_configs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ranks"] });
      toast.success(editingId ? "Rank updated" : "Rank added");
      closeDialog();
    },
    onError: () => toast.error("Failed to save rank"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rank_configs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ranks"] });
      toast.success("Rank deleted");
    },
    onError: () => toast.error("Failed to delete rank"),
  });

  const openEdit = (rank: any) => {
    setEditingId(rank.id);
    setForm({
      name: rank.name,
      label: rank.label,
      min_hours: rank.min_hours,
      max_hours: rank.max_hours,
      color: rank.color || "bg-slate-500",
      description: rank.description || "",
      order_index: rank.order_index,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
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
            <h1 className="text-2xl font-bold">Manage Ranks</h1>
            <p className="text-muted-foreground">Configure pilot rank progression</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingId(null); setForm(emptyForm); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rank
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Rank" : "Add Rank"}</DialogTitle>
              <DialogDescription>Configure rank name, hours requirements, and display</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Label (Display Name)</Label>
                  <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="First Officer" />
                </div>
                <div className="space-y-2">
                  <Label>Slug (Internal Name)</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="first_officer" />
                </div>
              </div>
              <div className="grid gap-4 grid-cols-3">
                <div className="space-y-2">
                  <Label>Min Hours</Label>
                  <Input type="number" value={form.min_hours} onChange={(e) => setForm({ ...form, min_hours: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Max Hours</Label>
                  <Input type="number" value={form.max_hours ?? ""} onChange={(e) => setForm({ ...form, max_hours: e.target.value ? parseFloat(e.target.value) : null })} placeholder="None" />
                </div>
                <div className="space-y-2">
                  <Label>Order</Label>
                  <Input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Color Class</Label>
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="bg-blue-500" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
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
          <CardTitle>Rank Configuration</CardTitle>
          <CardDescription>{ranks?.length || 0} ranks configured</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : ranks && ranks.length > 0 ? (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Order</th>
                    <th className="text-left py-3 px-2 font-medium">Label</th>
                    <th className="text-left py-3 px-2 font-medium">Slug</th>
                    <th className="text-left py-3 px-2 font-medium">Hours Range</th>
                    <th className="text-left py-3 px-2 font-medium">Color</th>
                    <th className="text-right py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ranks.map((rank) => (
                    <tr key={rank.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">{rank.order_index}</td>
                      <td className="py-3 px-2 font-medium">{rank.label}</td>
                      <td className="py-3 px-2 font-mono text-xs">{rank.name}</td>
                      <td className="py-3 px-2">
                        {rank.min_hours}h {rank.max_hours ? `- ${rank.max_hours}h` : "+"}
                      </td>
                      <td className="py-3 px-2">
                        <div className={`w-6 h-6 rounded ${rank.color || "bg-slate-500"}`} />
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(rank)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(rank.id)}>
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
              <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No ranks configured</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
