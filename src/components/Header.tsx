import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const NAV = [
  { to: "/", label: "Billing" },
  { to: "/menu", label: "Menu" },
  { to: "/orders", label: "Orders" },
  { to: "/dashboard", label: "Dashboard" },
] as const;

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

  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink/15 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-coffee font-mono text-sm font-bold text-cream shadow-card">
            MC
          </div>
          <div className="min-w-0 leading-none">
            <div className="truncate text-[17px] font-extrabold tracking-tight">Mocha Counter</div>
            <div className="mt-0.5 text-[11px] font-medium text-ink-soft">Front of House</div>
          </div>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="rounded-xl px-4 py-2 text-sm font-bold text-ink-soft transition-colors hover:bg-ink/5"
              activeProps={{
                className: "rounded-xl px-4 py-2 text-sm font-bold bg-coffee text-cream shadow-card",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 rounded-xl border border-ink/15 bg-paper px-4 py-2 font-mono text-sm font-bold shadow-card sm:block">
          {day} · {stamp}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold text-ink-soft"
            activeProps={{ className: "shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold bg-coffee text-cream" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
