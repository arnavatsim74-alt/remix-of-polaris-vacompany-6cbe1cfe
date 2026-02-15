import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layouts/AppLayout";

import AuthPage from "@/pages/Auth";
import ApplyPage from "@/pages/Apply";
import Dashboard from "@/pages/Dashboard";
import FilePirep from "@/pages/FilePirep";
import PirepHistory from "@/pages/PirepHistory";
import RoutesPage from "@/pages/Routes";
import RoutesOfTheWeek from "@/pages/RoutesOfTheWeek";
import Leaderboard from "@/pages/Leaderboard";
import Events from "@/pages/Events";
import Details from "@/pages/Details";
import Challenges from "@/pages/Challenges";
import AflvBonus from "@/pages/AflvBonus";
import Tracker from "@/pages/Tracker";
import AdminPireps from "@/pages/admin/AdminPireps";
import AdminRoutes from "@/pages/admin/AdminRoutes";
import AdminROTW from "@/pages/admin/AdminROTW";
import AdminEvents from "@/pages/admin/AdminEvents";
import AdminApplications from "@/pages/admin/AdminApplications";
import AdminAircraft from "@/pages/admin/AdminAircraft";
import AdminRanks from "@/pages/admin/AdminRanks";
import AdminMultipliers from "@/pages/admin/AdminMultipliers";
import AdminNOTAMs from "@/pages/admin/AdminNOTAMs";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminMembers from "@/pages/admin/AdminMembers";
import AdminChallenges from "@/pages/admin/AdminChallenges";
import AdminAnnouncements from "@/pages/admin/AdminAnnouncements";
import AdminSidebarLinks from "@/pages/admin/AdminSidebarLinks";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="aeroflot-va-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/apply" element={<ApplyPage />} />
              <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="rotw" element={<RoutesOfTheWeek />} />
                <Route path="file-pirep" element={<FilePirep />} />
                <Route path="pirep-history" element={<PirepHistory />} />
                <Route path="routes" element={<RoutesPage />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="events" element={<Events />} />
                <Route path="details" element={<Details />} />
                <Route path="challenges" element={<Challenges />} />
                <Route path="aflv-bonus" element={<AflvBonus />} />
                <Route path="tracker" element={<Tracker />} />
                <Route path="admin/pireps" element={<AdminPireps />} />
                <Route path="admin/routes" element={<AdminRoutes />} />
                <Route path="admin/rotw" element={<AdminROTW />} />
                <Route path="admin/events" element={<AdminEvents />} />
                <Route path="admin/applications" element={<AdminApplications />} />
                <Route path="admin/aircraft" element={<AdminAircraft />} />
                <Route path="admin/ranks" element={<AdminRanks />} />
                <Route path="admin/multipliers" element={<AdminMultipliers />} />
                <Route path="admin/notams" element={<AdminNOTAMs />} />
                <Route path="admin/settings" element={<AdminSettings />} />
                <Route path="admin/members" element={<AdminMembers />} />
                <Route path="admin/challenges" element={<AdminChallenges />} />
                <Route path="admin/announcements" element={<AdminAnnouncements />} />
                <Route path="admin/sidebar-links" element={<AdminSidebarLinks />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
