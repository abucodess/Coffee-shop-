import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
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
  const menu = usePos((s) => s.menu);
  const ordersLoading = usePos((s) => s.ordersLoading);
  const [downloadPeriod, setDownloadPeriod] = useState<"today" | "all">("today");
  const [isExporting, setIsExporting] = useState(false);

  // Memoize all expensive financial & aggregation calculations
  const metrics = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startTime = start.getTime();

    const todayOrders = orders.filter((o) => o.createdAt >= startTime);
    const paidOrders = todayOrders.filter((o) => o.status === "paid");
    const salesTotal = paidOrders.reduce((s, o) => s + o.total, 0);
    const cashTotal = paidOrders
      .filter((o) => o.payment === "cash")
      .reduce((s, o) => s + o.total, 0);
    const upiTotal = paidOrders
      .filter((o) => o.payment === "upi")
      .reduce((s, o) => s + o.total, 0);
    const cardTotal = paidOrders
      .filter((o) => o.payment === "card")
      .reduce((s, o) => s + o.total, 0);
    const avgTicket = paidOrders.length ? salesTotal / paidOrders.length : 0;

    const counts = new Map<string, number>();
    paidOrders.forEach((o) =>
      o.lines.forEach((l) => counts.set(l.name, (counts.get(l.name) ?? 0) + l.qty)),
    );
    const topItems = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = topItems[0]?.[1] ?? 1;

    return {
      today: todayOrders,
      paid: paidOrders,
      sales: salesTotal,
      cash: cashTotal,
      upi: upiTotal,
      card: cardTotal,
      avg: avgTicket,
      top: topItems,
      maxQty: max,
    };
  }, [orders]);

  const { today, paid, sales, cash, upi, card, avg, top, maxQty } = metrics;

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const isToday = downloadPeriod === "today";
      const selectedOrders = isToday ? today : orders;
      // Lazy load PDF generation bundle only on user action
      const { generateSalesPdfReport } = await import("@/lib/sales-pdf");
      generateSalesPdfReport({
        timeframe: isToday
          ? `Today (${new Date().toLocaleDateString()})`
          : `All Time (${orders.length} total orders)`,
        generatedAt: new Date(),
        orders: selectedOrders,
        menu,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Today</h1>
          {ordersLoading && (
            <span className="font-mono text-xs text-ink-soft">Syncing with Supabase…</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-ink/15 bg-paper p-1 text-xs font-bold">
            <button
              onClick={() => setDownloadPeriod("today")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                downloadPeriod === "today" ? "bg-coffee text-cream" : "text-ink-soft"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDownloadPeriod("all")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                downloadPeriod === "all" ? "bg-coffee text-cream" : "text-ink-soft"
              }`}
            >
              All Time
            </button>
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="press flex items-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-sm font-extrabold text-coffee shadow-card disabled:opacity-50"
          >
            <Download className="size-4 stroke-[2.5]" />
            {isExporting ? "Generating PDF…" : "Download PDF Report"}
          </button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat dark label="Today's sales" value={fmt(sales)} sub={`${paid.length} paid orders`} />
        <Stat
          label="Orders"
          value={String(today.length)}
          sub={`${today.length - paid.length} cancelled`}
        />
        <Stat
          label="Top item"
          value={top[0]?.[0] ?? "—"}
          sub={top[0] ? `${top[0][1]} sold today` : "No sales yet"}
          small
        />
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
                  <div
                    className="h-full rounded-full bg-amber"
                    style={{ width: `${(qty / maxQty) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {top.length === 0 && <p className="text-sm text-ink-soft">No sales yet today.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-paper p-5 shadow-card">
          <h2 className="mb-4 text-lg font-extrabold">Payments</h2>
          <Row label="Cash" value={fmt(cash)} dot="bg-mint" />
          <Row label="UPI" value={fmt(upi)} dot="bg-amber" />
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

function Stat({
  label,
  value,
  sub,
  dark,
  small,
}: {
  label: string;
  value: string;
  sub: string;
  dark?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-ink/10 p-5 shadow-card ${dark ? "bg-coffee" : "bg-paper"}`}
    >
      <div
        className={`font-mono text-xs font-bold uppercase tracking-[0.15em] ${dark ? "text-cream/60" : "text-ink-soft"}`}
      >
        {label}
      </div>
      <div
        className={`mt-1 font-bold ${small ? "text-xl font-extrabold" : "font-mono text-3xl"} ${dark ? "text-lemon" : ""}`}
      >
        {value}
      </div>
      <div className={`mt-1 text-xs font-bold ${dark ? "text-cream/70" : "text-ink-soft"}`}>
        {sub}
      </div>
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
