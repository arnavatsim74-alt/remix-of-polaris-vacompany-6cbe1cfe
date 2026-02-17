import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layouts/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell } from "@/components/NotificationBell";
import vacompanyLogo from "@/assets/vacompany-logo.svg";
import { VACOMPANY_URL } from "@/lib/branding";
import { PolarisFooter } from "@/components/PolarisFooter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AppLayout() {
  const { data: vaLogoUrl } = useQuery({
    queryKey: ["site-settings-va-logo"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "va_logo_url").maybeSingle();
      return data?.value || "";
    },
    staleTime: Infinity,
  });

  const headerLogo = vaLogoUrl || vacompanyLogo;
  const isDefaultLogo = !vaLogoUrl;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-40 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-full items-center gap-4 px-4">
              <SidebarTrigger className="-ml-1" />
              <div className="flex-1" />
              <a href={VACOMPANY_URL} target="_blank" rel="noopener noreferrer" aria-label="Visit VACompany">
                <img
                  src={headerLogo}
                  alt="VA Logo"
                  className={`h-8 w-auto object-contain opacity-80 ${isDefaultLogo ? "invert dark:invert-0" : ""}`}
                />
              </a>
              <NotificationBell />
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            <div className="container py-6 animate-fade-in">
              <Outlet />
            </div>
          </main>
          <PolarisFooter />
        </div>
      </div>
    </SidebarProvider>
  );
}
