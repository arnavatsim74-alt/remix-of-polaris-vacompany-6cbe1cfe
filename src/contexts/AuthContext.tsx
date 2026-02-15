import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Pilot {
  id: string;
  pid: string;
  full_name: string;
  avatar_url: string | null;
  total_hours: number;
  total_pireps: number;
  current_rank: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  pilot: Pilot | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshPilot: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPilotData = async (userId: string) => {
    try {
      const { data: pilotData } = await supabase
        .from("pilots")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (pilotData) {
        setPilot({
          id: pilotData.id,
          pid: pilotData.pid,
          full_name: pilotData.full_name,
          avatar_url: pilotData.avatar_url,
          total_hours: Number(pilotData.total_hours) || 0,
          total_pireps: pilotData.total_pireps || 0,
          current_rank: pilotData.current_rank || "cadet",
        });
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .single();

      setIsAdmin(!!roleData);
    } catch (error) {
      console.error("Error fetching pilot data:", error);
    }
  };

  const tryAdminSetup = async (userSession: Session) => {
    try {
      const email = userSession.user.email;
      if (email !== "admin@aflv.ru") return;

      // Check if pilot already exists
      const { data: existingPilot } = await supabase
        .from("pilots")
        .select("id")
        .eq("user_id", userSession.user.id)
        .maybeSingle();

      if (existingPilot) return;

      // Call edge function to set up admin
      await supabase.functions.invoke("setup-admin");

      // Re-fetch pilot data after setup
      await fetchPilotData(userSession.user.id);
    } catch (err) {
      console.error("Admin setup error:", err);
    }
  };

  const refreshPilot = async () => {
    if (user) await fetchPilotData(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchPilotData(session.user.id).then(() => {
              // After fetching, try admin setup if needed
              tryAdminSetup(session);
            });
          }, 0);
        } else {
          setPilot(null);
          setIsAdmin(false);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchPilotData(session.user.id).then(() => {
          tryAdminSetup(session);
        });
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl } });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setPilot(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, pilot, isAdmin, isLoading, signIn, signUp, signOut, refreshPilot }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
