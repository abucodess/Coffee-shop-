import { createFileRoute } from "@tanstack/react-router";
import { fmt } from "@/lib/pos-data";
import { usePos } from "@/lib/pos-store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Mocha Counter POS" },
      { name: "description", content: "Today's sales, orders and best-selling items." },
      { property: "og:title", content: "Dashboard — Mocha Counter POS" },
      { property: "og:description", content: "Today's sales, orders and best-selling items." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const orders = usePos((s) => s.orders);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = orders.filter((o) => o.createdAt >= start.getTime());
  const paid = today.filter((o) => o.status === "paid");
  const sales = paid.reduce((s, o) => s + o.total, 0);
  const cash = paid.filter((o) => o.payment === "cash").reduce((s, o) => s + o.total, 0);
  const card = sales - cash;
  const avg = paid.length ? sales / paid.length : 0;

  const counts = new Map<string, number>();
  paid.forEach((o) => o.lines.forEach((l) => counts.set(l.name, (counts.get(l.name) ?? 0) + l.qty)));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxQty = top[0]?.[1] ?? 1;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight sm:text-4xl">Today</h1>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat dark label="Today's sales" value={fmt(sales)} sub={`${paid.length} paid orders`} />
        <Stat label="Orders" value={String(today.length)} sub={`${today.length - paid.length} cancelled`} />
        <Stat label="Top item" value={top[0]?.[0] ?? "—"} sub={top[0] ? `${top[0][1]} sold today` : "No sales yet"} small />
        <Stat label="Avg ticket" value={fmt(avg)} sub={`across ${paid.length} orders`} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-ink/10 bg-paper p-5 shadow-card">
          <h2 className="mb-4 text-lg font-extrabold">Best sellers</h2>
          <div className="space-y-3">
            {top.map(([name, qty]) => (
              <div key={name}>
                <div className="flex justify-between text-sm font-bold">
                  <span>{name}</span>
                  <span className="font-mono">{qty}</span>
                </div>
                <div className="mt-1 h-2.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-amber" style={{ width: `${(qty / maxQty) * 100}%` }} />
                </div>
              </div>
            ))}
            {top.length === 0 && <p className="text-sm text-ink-soft">No sales yet today.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-paper p-5 shadow-card">
          <h2 className="mb-4 text-lg font-extrabold">Payments</h2>
          <Row label="Cash" value={fmt(cash)} dot="bg-mint" />
          <Row label="Card" value={fmt(card)} dot="bg-coffee" />
          <div className="mt-3 flex justify-between border-t border-dashed border-ink/20 pt-3 font-bold">
            <span>Total</span>
            <span className="font-mono">{fmt(sales)}</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, sub, dark, small }: { label: string; value: string; sub: string; dark?: boolean; small?: boolean }) {
  return (
    <div className={`rounded-2xl border border-ink/10 p-5 shadow-card ${dark ? "bg-coffee" : "bg-paper"}`}>
      <div className={`font-mono text-xs font-bold uppercase tracking-[0.15em] ${dark ? "text-cream/60" : "text-ink-soft"}`}>{label}</div>
      <div className={`mt-1 font-bold ${small ? "text-xl font-extrabold" : "font-mono text-3xl"} ${dark ? "text-lemon" : ""}`}>{value}</div>
      <div className={`mt-1 text-xs font-bold ${dark ? "text-cream/70" : "text-ink-soft"}`}>{sub}</div>
    </div>
  );
}

function Row({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm font-bold">
      <span className="flex items-center gap-2">
        <span className={`size-2.5 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
