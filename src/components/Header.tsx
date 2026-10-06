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
    <header className="sticky top-0 z-30 border-b border-fuwa-brown/10 bg-fuwa-cream/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2 sm:px-6 sm:py-2.5">
        {/* Brand logo & title */}
        <Link
          to="/"
          className="group flex min-w-0 items-center gap-2.5 transition-transform active:scale-98"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-fuwa-surface p-1 shadow-card ring-1 ring-fuwa-orange/30 transition-all group-hover:scale-105">
            <img src="/logo.png" alt="FUWA Japanese Fluffy Desserts" className="size-full object-contain" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="flex items-baseline gap-1.5">
              <span className="truncate text-[17px] font-black tracking-tight text-fuwa-brown sm:text-[19px]">
                FUWA
              </span>
              <span className="hidden text-[10px] font-black uppercase tracking-widest text-fuwa-orange sm:inline">
                ふわふわ
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-fuwa-brown/65 sm:text-[11px]">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="truncate">Japanese Fluffy Desserts</span>
            </div>
          </div>
        </Link>

        {/* Desktop & Tablet Navigation */}
        <nav className="hidden items-center rounded-2xl border border-fuwa-brown/10 bg-fuwa-surface/90 p-1 shadow-card md:flex">
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
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all sm:text-sm ${
                  isActive
                    ? "bg-fuwa-orange text-white shadow-card scale-[1.02]"
                    : "text-fuwa-brown/70 hover:bg-fuwa-orange/10 hover:text-fuwa-orange"
                }`}
              >
                <Icon className={`size-3.5 sm:size-4 ${isActive ? "text-white" : "text-fuwa-brown/60"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side controls: Clock + User chip + Logout */}
        <div className="flex items-center gap-2">
          {/* Live till clock (desktop & tablet landscape) */}
          <div className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-fuwa-brown/10 bg-fuwa-surface/90 px-3 py-1.5 font-mono text-xs font-bold text-fuwa-brown shadow-xs lg:flex">
            <span className="text-fuwa-orange font-bold">{day}</span>
            <span className="text-fuwa-brown/30">·</span>
            <span>{stamp}</span>
          </div>

          {user && (
            <div className="flex items-center gap-2">
              {/* User info & role badge (desktop/tablet) */}
              <div className="hidden items-center gap-2.5 rounded-2xl border border-fuwa-brown/10 bg-fuwa-surface/90 px-3 py-1.5 shadow-xs sm:flex">
                <div
                  className={`grid size-7 shrink-0 place-items-center rounded-xl font-mono text-xs font-extrabold ${
                    isAdmin ? "bg-fuwa-orange/15 text-fuwa-orange" : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {initial}
                </div>
                <div className="flex flex-col text-left leading-none">
                  <div className="flex items-center gap-1.5">
                    <span
                      title={user.email ?? ""}
                      className="max-w-[130px] truncate text-xs font-bold text-fuwa-brown"
                    >
                      {displayName}
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-black uppercase ${
                        isAdmin
                          ? "bg-fuwa-orange/15 text-fuwa-orange"
                          : "bg-emerald-100 text-emerald-800"
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
                  <span className="mt-0.5 max-w-[150px] truncate font-mono text-[10px] text-fuwa-brown/60">
                    {user.email}
                  </span>
                </div>
              </div>

              {/* Mobile compact user badge */}
              <div className="flex items-center gap-1.5 sm:hidden">
                <div className="flex flex-col text-right leading-none">
                  <span
                    title={user.email ?? ""}
                    className="max-w-[80px] truncate font-mono text-[11px] font-bold text-fuwa-brown"
                  >
                    {displayName}
                  </span>
                  <span
                    className={`font-mono text-[9px] font-extrabold uppercase ${
                      isAdmin ? "text-fuwa-orange" : "text-emerald-700"
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
                className="flex items-center gap-1.5 min-h-[40px] rounded-xl border border-fuwa-brown/15 bg-fuwa-surface px-3 py-2 font-mono text-xs font-bold text-fuwa-brown shadow-xs transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-hidden active:translate-y-0.5 disabled:opacity-50"
              >
                <LogOut className="size-3.5 text-fuwa-orange" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile & Small Tablet Horizontal Navigation Rail */}
      <nav className="flex items-center gap-1.5 overflow-x-auto border-t border-fuwa-brown/10 bg-fuwa-cream/70 px-3 py-1.5 no-scrollbar md:hidden">
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
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all min-h-[38px] ${
                isActive
                  ? "bg-fuwa-orange text-white shadow-card"
                  : "bg-fuwa-surface/80 text-fuwa-brown/70 hover:bg-fuwa-orange/10 hover:text-fuwa-brown"
              }`}
            >
              <Icon className={`size-3.5 ${isActive ? "text-white" : "text-fuwa-brown/60"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
