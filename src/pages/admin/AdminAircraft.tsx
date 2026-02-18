import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Plus, Trash2, Edit, Plane, Search } from "lucide-react";
import { toast } from "sonner";

interface AircraftForm {
  icao_code: string;
  name: string;
  type: string;
  livery: string;
  min_rank: string;
  passenger_capacity: number | null;
  cargo_capacity_kg: number | null;
  range_nm: number | null;
  image_url: string;
}


const enumPilotRanks = ["cadet", "first_officer", "captain", "senior_captain", "commander"] as const;

const formatRankLabel = (rank: string) => rank.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const emptyForm: AircraftForm = {
  icao_code: "", name: "", type: "passenger", livery: "", min_rank: "cadet",
  passenger_capacity: null, cargo_capacity_kg: null, range_nm: null, image_url: "",
};

export default function AdminAircraft() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AircraftForm>(emptyForm);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: aircraft, isLoading } = useQuery({
    queryKey: ["admin-aircraft"],
    queryFn: async () => {
      const { data } = await supabase.from("aircraft").select("*").order("name");
      return data || [];
    },
  });

  const { data: ranks } = useQuery({
    queryKey: ["rank-configs"],
    queryFn: async () => {
      const { data } = await supabase.from("rank_configs").select("*").eq("is_active", true).order("order_index");
      return data || [];
    },
  });



  const rankOptions = (ranks && ranks.length > 0)
    ? ranks
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((rank: any, index: number) => ({
          name: enumPilotRanks[index] || null,
          label: rank.label || formatRankLabel(rank.name || ""),
        }))
        .filter((rank: any) => !!rank.name)
    : enumPilotRanks.map((name) => ({ name, label: formatRankLabel(name) }));

  const saveMutation = useMutation({
    mutationFn: async (data: AircraftForm & { id?: string }) => {
      const payload = {
        icao_code: data.icao_code,
        name: data.name,
        type: data.type,
        livery: data.livery || null,
        min_rank: data.min_rank || "cadet",
        passenger_capacity: data.passenger_capacity,
        cargo_capacity_kg: data.cargo_capacity_kg,
        range_nm: data.range_nm,
        image_url: data.image_url || null,
      } as any;

      const run = async (p: any) => {
        if (data.id) {
          const { error } = await supabase.from("aircraft").update(p).eq("id", data.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("aircraft").insert(p);
          if (error) throw error;
        }
      };

      try {
        await run(payload);
      } catch (error: any) {
        // Fallback for environments where min_rank column migration has not been applied yet.
        if (String(error?.message || "").includes("min_rank")) {
          const fallbackPayload = { ...payload };
          delete fallbackPayload.min_rank;
          await run(fallbackPayload);
          return;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-aircraft"] });
      queryClient.invalidateQueries({ queryKey: ["aircraft"] });
      toast.success(editingId ? "Aircraft updated" : "Aircraft added");
      closeDialog();
    },
    onError: (error: any) => toast.error(error?.message || "Failed to save aircraft"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("aircraft").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-aircraft"] });
      queryClient.invalidateQueries({ queryKey: ["aircraft"] });
      toast.success("Aircraft deleted");
    },
    onError: () => toast.error("Failed to delete aircraft"),
  });

  const openEdit = (ac: any) => {
    setEditingId(ac.id);
    setForm({
      icao_code: ac.icao_code,
      name: ac.name,
      type: ac.type,
      livery: ac.livery || "",
      min_rank: (ac as any).min_rank || "cadet",
      passenger_capacity: ac.passenger_capacity,
      cargo_capacity_kg: ac.cargo_capacity_kg,
      range_nm: ac.range_nm,
      image_url: ac.image_url || "",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => { setIsDialogOpen(false); setEditingId(null); setForm(emptyForm); };

  const filtered = aircraft?.filter((ac) =>
    searchQuery === "" ||
    ac.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ac.icao_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ac.livery && ac.livery.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Manage Aircraft</h1>
            <p className="text-muted-foreground">Fleet configuration with liveries</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingId(null); setForm(emptyForm); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add Aircraft
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Aircraft" : "Create Aircraft"}</DialogTitle>
              <DialogDescription>Configure aircraft details and livery</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Aircraft Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Aeroflot Airbus A320" />
                </div>
                <div className="space-y-2">
                  <Label>ICAO Code</Label>
                  <Input value={form.icao_code} onChange={(e) => setForm({ ...form, icao_code: e.target.value })} placeholder="AFL-A320" />
                </div>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Livery Name</Label>
                  <Input value={form.livery} onChange={(e) => setForm({ ...form, livery: e.target.value })} placeholder="Aeroflot" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passenger">Passenger</SelectItem>
                      <SelectItem value="cargo">Cargo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Minimum Rank Required</Label>
                <Select value={rankOptions.some((r: any) => r.name === form.min_rank) ? form.min_rank : (rankOptions[0]?.name || "cadet")} onValueChange={(v) => setForm({ ...form, min_rank: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rankOptions.map((rank: any) => (
                      <SelectItem key={rank.name} value={rank.name}>
                        {rank.label || formatRankLabel(rank.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Passenger Capacity</Label>
                  <Input type="number" value={form.passenger_capacity ?? ""} onChange={(e) => setForm({ ...form, passenger_capacity: e.target.value ? parseInt(e.target.value) : null })} placeholder="180" />
                </div>
                <div className="space-y-2">
                  <Label>Cargo Capacity (kg)</Label>
                  <Input type="number" value={form.cargo_capacity_kg ?? ""} onChange={(e) => setForm({ ...form, cargo_capacity_kg: e.target.value ? parseInt(e.target.value) : null })} placeholder="91000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Range (nm)</Label>
                <Input type="number" value={form.range_nm ?? ""} onChange={(e) => setForm({ ...form, range_nm: e.target.value ? parseInt(e.target.value) : null })} placeholder="3300" />
              </div>
              <div className="space-y-2">
                <Label>Image URL (optional)</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={() => {
                if (!form.min_rank) {
                  toast.error("Please select a minimum rank");
                  return;
                }
                const safeRank = enumPilotRanks.includes(form.min_rank as any) ? form.min_rank : "cadet";
                saveMutation.mutate({ ...form, min_rank: safeRank, id: editingId || undefined });
              }} disabled={saveMutation.isPending}>
                {editingId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search aircraft by name, code, or livery..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fleet</CardTitle>
          <CardDescription>{filtered?.length || 0} aircraft in fleet</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filtered && filtered.length > 0 ? (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Aircraft</th>
                    <th className="text-left py-3 px-2 font-medium">Code</th>
                    <th className="text-left py-3 px-2 font-medium">Livery</th>
                    <th className="text-left py-3 px-2 font-medium">Type</th>
                    <th className="text-left py-3 px-2 font-medium">Min Rank</th>
                    <th className="text-left py-3 px-2 font-medium">PAX/Cargo</th>
                    <th className="text-left py-3 px-2 font-medium">Range</th>
                    <th className="text-right py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ac) => (
                    <tr key={ac.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{ac.name}</td>
                      <td className="py-3 px-2 font-mono text-xs">{ac.icao_code}</td>
                      <td className="py-3 px-2">
                        {ac.livery && <Badge variant="outline">{ac.livery}</Badge>}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="secondary" className="capitalize">{ac.type}</Badge>
                      </td>
                      <td className="py-3 px-2 capitalize">{formatRankLabel((ac as any).min_rank || "cadet")}</td>
                      <td className="py-3 px-2">
                        {ac.type === "cargo" ? (ac.cargo_capacity_kg ? `${ac.cargo_capacity_kg} kg` : "-") : (ac.passenger_capacity ? `${ac.passenger_capacity} pax` : "-")}
                      </td>
                      <td className="py-3 px-2">{ac.range_nm ? `${ac.range_nm} nm` : "-"}</td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                         <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(ac)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                            // Duplicate aircraft with empty livery for quick variant creation
                            setEditingId(null);
                            setForm({
                              icao_code: ac.icao_code,
                              name: ac.name,
                              type: ac.type,
                              livery: "",
                              min_rank: (ac as any).min_rank || "cadet",
                              passenger_capacity: ac.passenger_capacity,
                              cargo_capacity_kg: ac.cargo_capacity_kg,
                              range_nm: ac.range_nm,
                              image_url: ac.image_url || "",
                            });
                            setIsDialogOpen(true);
                          }}>
                            <Plus className="h-4 w-4" />
                          </Button>
                          <ConfirmDialog trigger={<Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>} title="Delete Aircraft?" description="This aircraft will be permanently deleted." onConfirm={() => deleteMutation.mutate(ac.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Plane className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No aircraft found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
