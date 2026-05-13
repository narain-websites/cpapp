import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Package, Receipt, BarChart3, Settings as SettingsIcon, LogOut, Moon, Sun,
} from "lucide-react";
import { useAuth } from "@/lib/authStore";
import { useTheme } from "@/lib/themeStore";
import { OfflineIndicator } from "./OfflineIndicator";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/billing", label: "Billing", icon: Receipt },
  { to: "/products", label: "Products", icon: Package },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { lock } = useAuth();
  const { theme, setTheme } = useTheme();
  const loc = useLocation();
  const isActive = (to: string) => to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card">
        <div className="p-5 flex items-center gap-3 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">CP</div>
          <div>
            <div className="font-bold">Chawla Plywood</div>
            <div className="text-xs text-muted-foreground">Billing</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(to)
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-accent transition-colors"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button
            onClick={lock}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-accent transition-colors text-destructive"
          >
            <LogOut className="w-4 h-4" /> Lock
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden sticky top-0 z-20 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">CP</div>
            <div className="font-semibold">Chawla Plywood</div>
          </div>
          <div className="flex items-center gap-2">
            <OfflineIndicator />
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-accent"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={lock} aria-label="Lock" className="p-2 rounded-lg hover:bg-accent text-destructive">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <header className="hidden lg:flex sticky top-0 z-20 bg-card border-b border-border px-6 py-3 items-center justify-end gap-3">
          <OfflineIndicator />
        </header>

        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 overflow-x-hidden">{children}</main>

        {/* Bottom nav (mobile) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border grid grid-cols-5 h-16">
          {NAV.slice(0, 5).map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                isActive(to) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
