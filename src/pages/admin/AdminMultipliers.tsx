import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Plus, Trash2, Edit, Zap } from "lucide-react";
import { toast } from "sonner";

interface MultiplierForm {
  name: string;
  value: number;
  description: string;
  is_active: boolean;
}

const emptyForm: MultiplierForm = { name: "", value: 1.0, description: "", is_active: true };

export default function AdminMultipliers() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MultiplierForm>(emptyForm);

  const { data: multipliers, isLoading } = useQuery({
    queryKey: ["admin-multipliers"],
    queryFn: async () => {
      const { data } = await supabase.from("multiplier_configs").select("*").order("value");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: MultiplierForm & { id?: string }) => {
      const payload = { name: data.name, value: data.value, description: data.description, is_active: data.is_active };
      if (data.id) {
        const { error } = await supabase.from("multiplier_configs").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("multiplier_configs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-multipliers"] });
      toast.success(editingId ? "Multiplier updated" : "Multiplier added");
      closeDialog();
    },
    onError: () => toast.error("Failed to save multiplier"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("multiplier_configs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-multipliers"] });
      toast.success("Multiplier deleted");
    },
    onError: () => toast.error("Failed to delete multiplier"),
  });

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from("multiplier_configs").update({ is_active: !currentActive }).eq("id", id);
    if (error) { toast.error("Failed to toggle"); return; }
    queryClient.invalidateQueries({ queryKey: ["admin-multipliers"] });
  };

  const openEdit = (m: any) => {
    setEditingId(m.id);
    setForm({ name: m.name, value: Number(m.value), description: m.description || "", is_active: m.is_active });
    setIsDialogOpen(true);
  };

  const closeDialog = () => { setIsDialogOpen(false); setEditingId(null); setForm(emptyForm); };

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Manage Multipliers</h1>
            <p className="text-muted-foreground">Configure flight hour multipliers</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingId(null); setForm(emptyForm); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add Multiplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Multiplier" : "Add Multiplier"}</DialogTitle>
              <DialogDescription>Configure multiplier name and value</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Event 1.5x" />
              </div>
              <div className="space-y-2">
                <Label>Multiplier Value</Label>
                <Input type="number" step="0.1" min="0.1" value={form.value} onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 1 })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Used for special events" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Active</Label>
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
          <CardTitle>Multiplier Configuration</CardTitle>
          <CardDescription>{multipliers?.length || 0} multipliers configured</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : multipliers && multipliers.length > 0 ? (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Name</th>
                    <th className="text-left py-3 px-2 font-medium">Value</th>
                    <th className="text-left py-3 px-2 font-medium">Description</th>
                    <th className="text-left py-3 px-2 font-medium">Active</th>
                    <th className="text-right py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {multipliers.map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{m.name}</td>
                      <td className="py-3 px-2">
                        <Badge variant="secondary">{Number(m.value).toFixed(1)}x</Badge>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">{m.description}</td>
                      <td className="py-3 px-2">
                        <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m.id, m.is_active)} />
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(m)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(m.id)}>
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
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No multipliers configured</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
