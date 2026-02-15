import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plane, Clock, Award, TrendingUp } from "lucide-react";

import bonusCard200 from "@/assets/bonus-card-200.svg";
import bonusCard400 from "@/assets/bonus-card-400.svg";
import bonusCard600 from "@/assets/bonus-card-600.svg";
import bonusCard1200 from "@/assets/bonus-card-1200.svg";
import bonusCard2000 from "@/assets/bonus-card-2000.svg";
import bonusCard4000 from "@/assets/bonus-card-4000.svg";

const TIERS = [
  { name: "Premium", minHours: 200, card: bonusCard200, textColor: "text-black" },
  { name: "Essential", minHours: 400, card: bonusCard400, textColor: "text-black" },
  { name: "Gold", minHours: 600, card: bonusCard600, textColor: "text-black" },
  { name: "Card Platina", minHours: 1200, card: bonusCard1200, textColor: "text-white" },
  { name: "Prestige", minHours: 2000, card: bonusCard2000, textColor: "text-white" },
  { name: "Black", minHours: 4000, card: bonusCard4000, textColor: "text-white" },
];

function getCurrentTier(hours: number) {
  let tier = null;
  for (const t of TIERS) {
    if (hours >= t.minHours) tier = t;
  }
  return tier;
}

function getNextTier(hours: number) {
  for (const t of TIERS) {
    if (hours < t.minHours) return t;
  }
  return null;
}

function generateCardNumber() {
  const segments = Array.from({ length: 4 }, () =>
    String(Math.floor(Math.random() * 10000)).padStart(4, "0")
  );
  return segments.join(" ");
}

export default function AflvBonus() {
  const { pilot } = useAuth();
  const queryClient = useQueryClient();
  const hours = pilot?.total_hours ?? 0;
  const currentTier = getCurrentTier(hours);
  const nextTier = getNextTier(hours);

  const { data: bonusCard } = useQuery({
    queryKey: ["bonus-card", pilot?.id],
    queryFn: async () => {
      if (!pilot) return null;
      const { data } = await supabase
        .from("pilot_bonus_cards")
        .select("*")
        .eq("pilot_id", pilot.id)
        .maybeSingle();
      return data;
    },
    enabled: !!pilot,
  });

  const createCard = useMutation({
    mutationFn: async () => {
      if (!pilot) throw new Error("No pilot");
      const { data, error } = await supabase
        .from("pilot_bonus_cards")
        .insert({ pilot_id: pilot.id, card_number: generateCardNumber() })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bonus-card"] }),
  });

  // Auto-create card if pilot exists but no card yet
  const shouldCreate = !!pilot && bonusCard === null && !createCard.isPending;
  if (shouldCreate) {
    createCard.mutate();
  }

  const progressToNext = nextTier
    ? ((hours - (currentTier?.minHours ?? 0)) / (nextTier.minHours - (currentTier?.minHours ?? 0))) * 100
    : 100;

  const cardNumber = bonusCard?.card_number ?? "•••• •••• •••• ••••";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">AFLV Bonus</h1>
        <p className="text-muted-foreground">Aeroflot Virtual Frequent Flyer Program</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Card Display */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Your Frequent Flyer Card
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-[1172/690] w-full max-w-lg mx-auto">
              <img
                src={currentTier?.card ?? bonusCard200}
                alt={`${currentTier?.name ?? "Standard"} tier card`}
                className="w-full h-full object-contain rounded-xl shadow-2xl"
              />
              {/* Overlay name & card number */}
              <div className={`absolute bottom-[18%] left-[8%] drop-shadow-lg ${currentTier?.textColor ?? "text-white"}`} style={{ fontFamily: "'Bank Gothic', 'Copperplate', 'Copperplate Gothic Bold', sans-serif" }}>
                <p className="text-xs md:text-sm opacity-90">{cardNumber}</p>
                <p className="text-lg md:text-xl font-bold uppercase">{pilot?.full_name ?? "Pilot"}</p>
              </div>
              <div className="absolute bottom-[8%] right-[8%]">
                <Badge variant="secondary" className={`text-xs font-bold bg-white/20 backdrop-blur border-white/30 ${currentTier?.textColor ?? "text-white"}`}>
                  {currentTier?.name ?? "Standard"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-1">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{hours.toFixed(1)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Plane className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Flights</p>
                <p className="text-2xl font-bold">{pilot?.total_pireps ?? 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Tier</p>
                <p className="text-2xl font-bold">{currentTier?.name ?? "Standard"}</p>
              </div>
            </CardContent>
          </Card>

          {nextTier && (
            <Card>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <p className="text-sm text-muted-foreground">Progress to {nextTier.name}</p>
                </div>
                <Progress value={progressToNext} className="h-3" />
                <p className="text-xs text-muted-foreground">
                  {(nextTier.minHours - hours).toFixed(1)} hours remaining
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* All Tiers */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Tier Levels</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TIERS.map((tier) => {
            const unlocked = hours >= tier.minHours;
            return (
              <Card key={tier.name} className={unlocked ? "ring-2 ring-primary" : "opacity-60"}>
                <CardContent className="p-4 space-y-3">
                  <div className="aspect-[1172/690] w-full overflow-hidden rounded-lg">
                    <img src={tier.card} alt={tier.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{tier.name}</span>
                    <Badge variant={unlocked ? "default" : "outline"}>
                      {unlocked ? "Unlocked" : `${tier.minHours}h required`}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Tier Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-1">Premium (200h)</h3>
              <p className="text-xs text-muted-foreground">Priority PIREP review, exclusive Premium badge on leaderboard</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-1">Essential (400h)</h3>
              <p className="text-xs text-muted-foreground">1.1x bonus multiplier on all flights, Essential badge</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-1">Gold (600h)</h3>
              <p className="text-xs text-muted-foreground">1.2x bonus multiplier, early event registration access</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-1">Card Platina (1200h)</h3>
              <p className="text-xs text-muted-foreground">1.3x bonus multiplier, custom callsign, featured on homepage</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-1">Prestige (2000h)</h3>
              <p className="text-xs text-muted-foreground">1.5x bonus multiplier, route suggestion privileges</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-1">Black (4000h)</h3>
              <p className="text-xs text-muted-foreground">2x bonus multiplier, VIP status, exclusive Black events</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
