import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authStore";
import { ensureSettings } from "@/lib/db";
import { applyTheme } from "@/lib/themeStore";
import { preloadModel } from "@/lib/mlMatcher";
import { PinScreen } from "./PinScreen";
import { AppShell } from "./AppShell";

export function ClientApp({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { unlocked, ready } = useAuth();

  useEffect(() => {
    setMounted(true);
    ensureSettings().then((s) => applyTheme(s.theme));
    // Kick off model load in background
    setTimeout(() => preloadModel(), 1500);
  }, []);

  if (!mounted || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!unlocked) return <PinScreen onUnlock={() => { /* state syncs via listener */ }} />;

  return <AppShell>{children}</AppShell>;
}
