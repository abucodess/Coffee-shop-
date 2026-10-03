import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/auth";

interface NavItem {
  to: string;
  label: string;
  adminOnly?: boolean;
}

const ALL_NAV: NavItem[] = [
  { to: "/", label: "Billing" },
  { to: "/orders", label: "Orders" },
  { to: "/menu", label: "Menu", adminOnly: true },
  { to: "/dashboard", label: "Dashboard", adminOnly: true },
  { to: "/admin/users", label: "Users", adminOnly: true },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function Header() {
  const now = useClock();
  const stamp = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const day = now.toLocaleDateString([], { weekday: "short" });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Hide the POS header entirely on the dedicated login screen
  if (pathname === "/login") {
    return null;
  }

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut();
      navigate({ to: "/login", replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Filter navigation items by role
  const visibleNav = ALL_NAV.filter((item) => !item.adminOnly || isAdmin);

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Staff";
  const roleLabel = isAdmin ? "Admin" : "Staff";

  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink/15 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-coffee p-1 font-mono text-sm font-bold text-white shadow-card">
            <img src="/logo.png" alt="Mocha Counter" className="size-full object-contain" />
          </div>
          <div className="min-w-0 leading-none">
            <div className="truncate text-[17px] font-extrabold tracking-tight">Mocha Counter</div>
            <div className="mt-0.5 text-[11px] font-medium text-ink-soft">Front of House</div>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {visibleNav.map((item) => {
            const isActive =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                style={
                  isActive
                    ? { color: "#ffffff", backgroundColor: "var(--coffee)" }
                    : undefined
                }
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                  isActive
                    ? "bg-coffee text-white shadow-card"
                    : "text-ink-soft hover:bg-ink/5 hover:text-coffee"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden shrink-0 rounded-xl border border-ink/15 bg-paper px-3 py-1.5 font-mono text-xs font-bold shadow-card lg:block">
            {day} · {stamp}
          </div>

          {user && (
            <div className="flex items-center gap-2">
              {/* User info & role badge */}
              <div className="hidden items-center gap-2 rounded-xl border border-ink/15 bg-paper px-3 py-1.5 shadow-card sm:flex">
                <div className="flex flex-col text-right leading-tight">
                  <div className="flex items-center justify-end gap-1.5">
                    <span
                      title={user.email ?? ""}
                      className="max-w-[140px] truncate text-xs font-bold text-ink"
                    >
                      {profile?.full_name || user.email}
                    </span>
                    <span
                      className={`font-mono text-[9px] font-extrabold uppercase tracking-wider ${
                        isAdmin ? "text-amber-deep" : "text-ink-soft"
                      }`}
                    >
                      {roleLabel}
                    </span>
                  </div>
                  {profile?.full_name && (
                    <span className="font-mono text-[10px] text-ink-soft">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Sign out of counter"
                className="flex items-center gap-1.5 rounded-xl border border-ink/15 bg-paper px-3 py-2 font-mono text-xs font-bold text-ink shadow-card transition-colors hover:bg-tomato/10 hover:text-tomato focus:outline-hidden active:translate-y-0.5 disabled:opacity-50"
              >
                <LogOut className="size-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center justify-between gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        <div className="flex items-center gap-1">
          {visibleNav.map((item) => {
            const isActive =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                style={
                  isActive
                    ? { color: "#ffffff", backgroundColor: "var(--coffee)" }
                    : undefined
                }
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                  isActive
                    ? "bg-coffee text-white shadow-card"
                    : "text-ink-soft hover:bg-ink/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {user && (
          <div className="flex items-center gap-2 pl-2">
            <div className="flex flex-col text-right leading-none">
              <span
                title={user.email ?? ""}
                className="max-w-[90px] truncate font-mono text-[11px] font-bold text-ink"
              >
                {profile?.full_name || user.email}
              </span>
              <span
                className={`font-mono text-[9px] font-extrabold uppercase ${
                  isAdmin ? "text-amber-deep" : "text-ink-soft"
                }`}
              >
                {roleLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Sign out"
              className="flex items-center rounded-lg border border-ink/15 bg-paper p-1.5 font-mono text-xs text-ink shadow-card hover:bg-tomato/10 hover:text-tomato"
            >
              <LogOut className="size-3" />
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
