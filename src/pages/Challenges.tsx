import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, CheckCircle2 } from "lucide-react";

export default function Challenges() {
  const { pilot } = useAuth();

  const { data: challenges, isLoading } = useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenges")
        .select("*")
        .eq("is_active", true)
        .order("created_at");
      return data || [];
    },
  });

  const { data: completions } = useQuery({
    queryKey: ["challenge-completions", pilot?.id],
    queryFn: async () => {
      if (!pilot?.id) return [];
      const { data } = await supabase
        .from("challenge_completions")
        .select("challenge_id")
        .eq("pilot_id", pilot.id);
      return data || [];
    },
    enabled: !!pilot?.id,
  });

  const completedIds = new Set(completions?.map((c) => c.challenge_id) || []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Challenges</h1>
          <p className="text-muted-foreground">Complete challenges to earn achievements</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : challenges && challenges.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {challenges.map((challenge) => {
            const isCompleted = completedIds.has(challenge.id);
            return (
              <Card key={challenge.id} className={`overflow-hidden ${isCompleted ? "border-primary/50" : ""}`}>
                {challenge.image_url && (
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={challenge.image_url}
                      alt={challenge.name}
                      className="w-full h-full object-cover"
                    />
                    {isCompleted && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="h-6 w-6 text-primary drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                )}
                <CardContent className="p-4">
                  <h3 className="font-semibold">{challenge.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {challenge.description}
                    {challenge.destination_icao && (
                      <> — Destination: <span className="font-mono text-primary">{challenge.destination_icao}</span></>
                    )}
                  </p>
                  <Badge
                    variant={isCompleted ? "default" : "outline"}
                    className={`mt-2 ${isCompleted ? "bg-primary/20 text-primary" : "text-destructive border-destructive/50"}`}
                  >
                    {isCompleted ? "Complete" : "Incomplete"}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No challenges available</p>
        </div>
      )}
    </div>
  );
}
