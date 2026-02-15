import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Loader2, ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import aeroflotLogo from "@/assets/aeroflot-logo.png";

const applicationSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type ApplicationStatus = "idle" | "pending" | "approved" | "rejected";

export default function ApplyPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [vatsimId, setVatsimId] = useState("");
  const [ivaoId, setIvaoId] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus>("idle");
  const navigate = useNavigate();
  const { user, signUp } = useAuth();

  // Check if user already has an application
  useEffect(() => {
    const checkExistingApplication = async () => {
      if (!user) return;

      const { data } = await supabase
        .from("pilot_applications")
        .select("status")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setApplicationStatus(data.status as ApplicationStatus);
      }
    };

    checkExistingApplication();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = applicationSchema.safeParse({
      fullName,
      email,
      password,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsLoading(true);

    try {
      // First create the account
      const { error: signUpError } = await signUp(email, password);

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          toast.error("This email is already registered. Please sign in instead.");
        } else {
          toast.error(signUpError.message);
        }
        return;
      }

      // Get the newly created user
      const { data: { user: newUser } } = await supabase.auth.getUser();

      if (!newUser) {
        toast.error("Failed to create account");
        return;
      }

      // Submit application
      const { error: appError } = await supabase.from("pilot_applications").insert({
        user_id: newUser.id,
        email,
        full_name: fullName,
        vatsim_id: vatsimId || null,
        ivao_id: ivaoId || null,
        experience_level: "N/A",
        preferred_simulator: "N/A",
        reason_for_joining: "N/A",
      });

      if (appError) {
        toast.error("Failed to submit application");
        return;
      }

      setApplicationStatus("pending");
      toast.success("Application submitted successfully!");
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (applicationStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/20">
              <Clock className="h-8 w-8 text-warning" />
            </div>
            <CardTitle>Application Pending</CardTitle>
            <CardDescription>
              Your application is being reviewed by our team. You'll receive access once approved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/auth">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (applicationStatus === "approved") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <CardTitle>Application Approved!</CardTitle>
            <CardDescription>
              Congratulations! Your pilot application has been approved. You can now sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/auth">
              <Button className="w-full">
                Sign In to Crew Center
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex justify-between items-center p-4">
        <Link to="/auth" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <img src={aeroflotLogo} alt="Aeroflot VA" className="h-12 w-auto object-contain" />
            </div>
            <CardTitle className="text-2xl">Join Aeroflot Virtual</CardTitle>
            <CardDescription>
              Complete this form to apply for a pilot position with our virtual airline on Infinite Flight
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Personal Information</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* Infinite Flight Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Infinite Flight Details (Optional)</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vatsimId">IFC Username</Label>
                    <Input
                      id="vatsimId"
                      placeholder="Your Infinite Flight Community username"
                      value={vatsimId}
                      onChange={(e) => setVatsimId(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ivaoId">Preferred Callsign</Label>
                    <Input
                      id="ivaoId"
                      placeholder="Your preferred callsign"
                      value={ivaoId}
                      onChange={(e) => setIvaoId(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>


              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Application
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
