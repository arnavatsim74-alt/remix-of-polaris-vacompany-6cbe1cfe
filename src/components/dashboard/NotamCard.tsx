import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";

interface Notam {
  id: string;
  title: string;
  content: string;
  priority: "info" | "warning" | "critical";
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export function NotamCard() {
  const { data: notams, isLoading } = useQuery({
    queryKey: ["active-notams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notams")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(3);
      return (data || []) as Notam[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16" />
        </CardContent>
      </Card>
    );
  }

  if (!notams || notams.length === 0) {
    return null;
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "critical":
        return <AlertCircle className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case "critical":
        return "border-destructive/50 bg-destructive/5";
      case "warning":
        return "border-yellow-500/50 bg-yellow-500/5";
      default:
        return "border-primary/30 bg-primary/5";
    }
  };

  const getPriorityBadgeStyles = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-destructive/10 text-destructive border-destructive/30";
      case "warning":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
      default:
        return "bg-primary/10 text-primary border-primary/30";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-primary" />
          NOTAMs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {notams.map((notam) => (
          <div
            key={notam.id}
            className={`p-3 rounded-lg border ${getPriorityStyles(notam.priority)}`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${
                notam.priority === "critical" ? "text-destructive" :
                notam.priority === "warning" ? "text-yellow-600" : "text-primary"
              }`}>
                {getPriorityIcon(notam.priority)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm">{notam.title}</h4>
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] uppercase ${getPriorityBadgeStyles(notam.priority)}`}
                  >
                    {notam.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{notam.content}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
