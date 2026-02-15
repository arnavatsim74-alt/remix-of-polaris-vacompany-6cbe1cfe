import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plane, Award, Users, Globe } from "lucide-react";

export default function Details() {
  const { data: aircraft, isLoading: aircraftLoading } = useQuery({
    queryKey: ["aircraft"],
    queryFn: async () => {
      const { data } = await supabase.from("aircraft").select("*").order("name");
      return data || [];
    },
  });

  const { data: ranks, isLoading: ranksLoading } = useQuery({
    queryKey: ["rank-configs"],
    queryFn: async () => {
      const { data } = await supabase.from("rank_configs").select("*").eq("is_active", true).order("order_index");
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Globe className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Details</h1>
          <p className="text-muted-foreground">Fleet information and rank progression</p>
        </div>
      </div>

      <Tabs defaultValue="fleet" className="space-y-6">
        <TabsList>
          <TabsTrigger value="fleet">
            <Plane className="h-4 w-4 mr-2" />Fleet
          </TabsTrigger>
          <TabsTrigger value="ranks">
            <Award className="h-4 w-4 mr-2" />Ranks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fleet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Our Fleet</CardTitle>
              <CardDescription>Aircraft available for Aeroflot Virtual operations</CardDescription>
            </CardHeader>
            <CardContent>
              {aircraftLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40" />)}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {aircraft?.map((ac) => (
                    <Card key={ac.id} className="overflow-hidden">
                      {ac.image_url ? (
                        <div className="h-32 overflow-hidden">
                          <img src={ac.image_url} alt={ac.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-2 bg-primary/20" />
                      )}
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-bold text-sm leading-tight">{ac.name}</h3>
                          <Badge variant="secondary" className="capitalize text-xs ml-2 shrink-0">{ac.type}</Badge>
                        </div>
                        {ac.livery && (
                          <Badge variant="outline" className="text-xs mb-3">{ac.livery}</Badge>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                          {ac.passenger_capacity && (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span>{ac.passenger_capacity} pax</span>
                            </div>
                          )}
                          {ac.range_nm && (
                            <div className="flex items-center gap-1">
                              <Globe className="h-3 w-3 text-muted-foreground" />
                              <span>{ac.range_nm} nm</span>
                            </div>
                          )}
                          {ac.cargo_capacity_kg && (
                            <div className="flex items-center gap-1">
                              <Plane className="h-3 w-3 text-muted-foreground" />
                              <span>{ac.cargo_capacity_kg} kg</span>
                            </div>
                          )}
                          {ac.min_hours != null && ac.min_hours > 0 && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Award className="h-3 w-3" />
                              <span>{ac.min_hours}h req.</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rank Progression</CardTitle>
              <CardDescription>Advance through ranks by accumulating flight hours</CardDescription>
            </CardHeader>
            <CardContent>
              {ranksLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : (
                <div className="space-y-3">
                  {ranks?.map((rank, index) => (
                    <div key={rank.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className={`w-10 h-10 rounded-full ${rank.color || "bg-slate-500"} flex items-center justify-center text-white font-bold text-sm`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{rank.label}</h3>
                        <p className="text-xs text-muted-foreground truncate">{rank.description}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {rank.min_hours}h {rank.max_hours ? `- ${rank.max_hours}h` : "+"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
