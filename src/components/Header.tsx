import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import {
  LogOut,
  Receipt,
  ClipboardList,
  UtensilsCrossed,
  LayoutDashboard,
  Users,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/auth";

interface NavItem {
  to: string;
  label: string;
  adminOnly?: boolean;
  icon: ComponentType<{ className?: string }>;
}

const ALL_NAV: NavItem[] = [
  { to: "/", label: "Billing", icon: Receipt },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/menu", label: "Menu", adminOnly: true, icon: UtensilsCrossed },
  { to: "/dashboard", label: "Dashboard", adminOnly: true, icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", adminOnly: true, icon: Users },
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
  const initial = (displayName.charAt(0) || "S").toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-cream/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
        {/* Brand logo & title */}
        <Link
          to="/"
          className="group flex min-w-0 items-center gap-2.5 transition-transform active:scale-98"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-coffee p-1 font-mono text-sm font-bold text-white shadow-card ring-1 ring-amber/20 transition-all group-hover:scale-105">
            <img src="/logo.png" alt="Mocha Counter" className="size-full object-contain" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[16px] font-black tracking-tight text-ink sm:text-[18px]">
              Mocha Counter
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-ink-soft sm:text-[11px]">
              <span className="size-1.5 rounded-full bg-mint animate-pulse" />
              <span>Front of House</span>
            </div>
          </div>
        </Link>

        {/* Desktop & Tablet Navigation */}
        <nav className="hidden items-center rounded-2xl border border-ink/10 bg-paper/80 p-1 shadow-xs md:flex">
          {visibleNav.map((item) => {
            const Icon = item.icon;
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
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all sm:text-sm ${
                  isActive
                    ? "bg-coffee text-white shadow-card scale-[1.02]"
                    : "text-ink-soft hover:bg-ink/5 hover:text-ink"
                }`}
              >
                <Icon className={`size-3.5 sm:size-4 ${isActive ? "text-amber" : "text-ink-soft/70"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side controls: Clock + User chip + Logout */}
        <div className="flex items-center gap-2">
          {/* Live till clock (desktop & tablet landscape) */}
          <div className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-ink/10 bg-paper/80 px-3 py-1.5 font-mono text-xs font-bold text-ink shadow-xs lg:flex">
            <span className="text-amber-deep">{day}</span>
            <span className="text-ink-soft">·</span>
            <span>{stamp}</span>
          </div>

          {user && (
            <div className="flex items-center gap-2">
              {/* User info & role badge (desktop/tablet) */}
              <div className="hidden items-center gap-2.5 rounded-2xl border border-ink/10 bg-paper/80 px-3 py-1.5 shadow-xs sm:flex">
                <div
                  className={`grid size-7 shrink-0 place-items-center rounded-xl font-mono text-xs font-extrabold ${
                    isAdmin ? "bg-amber/20 text-amber-deep" : "bg-mint/20 text-mint"
                  }`}
                >
                  {initial}
                </div>
                <div className="flex flex-col text-left leading-none">
                  <div className="flex items-center gap-1.5">
                    <span
                      title={user.email ?? ""}
                      className="max-w-[130px] truncate text-xs font-bold text-ink"
                    >
                      {displayName}
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-black uppercase ${
                        isAdmin
                          ? "bg-amber/15 text-amber-deep"
                          : "bg-mint/15 text-mint"
                      }`}
                    >
                      {isAdmin ? (
                        <ShieldCheck className="size-2.5" />
                      ) : (
                        <UserCheck className="size-2.5" />
                      )}
                      <span>{roleLabel}</span>
                    </span>
                  </div>
                  <span className="mt-0.5 max-w-[150px] truncate font-mono text-[10px] text-ink-soft">
                    {user.email}
                  </span>
                </div>
              </div>

              {/* Mobile compact user badge */}
              <div className="flex items-center gap-1.5 sm:hidden">
                <div className="flex flex-col text-right leading-none">
                  <span
                    title={user.email ?? ""}
                    className="max-w-[80px] truncate font-mono text-[11px] font-bold text-ink"
                  >
                    {displayName}
                  </span>
                  <span
                    className={`font-mono text-[9px] font-extrabold uppercase ${
                      isAdmin ? "text-amber-deep" : "text-mint"
                    }`}
                  >
                    {roleLabel}
                  </span>
                </div>
                <span className="hidden">{user.email}</span>
              </div>

              {/* Logout button */}
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Sign out of counter"
                className="flex items-center gap-1.5 rounded-xl border border-ink/15 bg-paper px-3 py-2 font-mono text-xs font-bold text-ink shadow-xs transition-all hover:border-tomato/30 hover:bg-tomato/10 hover:text-tomato focus:outline-hidden active:translate-y-0.5 disabled:opacity-50"
              >
                <LogOut className="size-3.5 text-tomato" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile & Small Tablet Horizontal Navigation Rail */}
      <nav className="flex items-center gap-1.5 overflow-x-auto border-t border-ink/10 bg-cream/70 px-3 py-1.5 no-scrollbar md:hidden">
        {visibleNav.map((item) => {
          const Icon = item.icon;
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
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                isActive
                  ? "bg-coffee text-white shadow-card"
                  : "bg-paper/70 text-ink-soft hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Icon className={`size-3.5 ${isActive ? "text-amber" : "text-ink-soft"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
