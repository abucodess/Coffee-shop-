import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { Banknote, CreditCard, QrCode, Receipt, Search, X } from "lucide-react";
import { fmt, type Order } from "@/lib/pos-data";
import { cancelOrder, usePos } from "@/lib/pos-store";

// Lazy-load modals
const ReceiptModal = lazy(() =>
  import("@/components/Receipt").then((m) => ({ default: m.ReceiptModal })),
);
const CancelOrderModal = lazy(() =>
  import("@/components/CancelOrderModal").then((m) => ({ default: m.CancelOrderModal })),
);

import { ProtectedRoute } from "@/auth";

function ProtectedOrdersPage() {
  return (
    <ProtectedRoute>
      <OrdersPage />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders — Mocha Counter POS" },
      { name: "description", content: "Order history, receipts and cancellations." },
      { property: "og:title", content: "Orders — Mocha Counter POS" },
      { property: "og:description", content: "Order history, receipts and cancellations." },
    ],
  }),
  component: ProtectedOrdersPage,
});

function OrdersPage() {
  const orders = usePos((s) => s.orders);
  const ordersLoading = usePos((s) => s.ordersLoading);
  const actionLoadingId = usePos((s) => s.actionLoadingId);
  const [filter, setFilter] = useState<"all" | "paid" | "cancelled">("all");
  const [search, setSearch] = useState("");
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  // Memoize filtered and searched orders list
  const list = useMemo(() => {
    let result = filter === "all" ? orders : orders.filter((o) => o.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (o) =>
          String(o.number).includes(q) ||
          (o.cashier && o.cashier.toLowerCase().includes(q)) ||
          o.payment.toLowerCase().includes(q) ||
          o.lines.some((l) => l.name.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [filter, orders, search]);

  const confirmCancel = async (_reason?: string) => {
    if (!cancellingOrder) return;
    try {
      await cancelOrder(cancellingOrder.id);
      toast.success(`Order ${cancellingOrder.number} cancelled`);
      setCancellingOrder(null);
    } catch {
      toast.error(`Failed to cancel order ${cancellingOrder.number}`);
    }
  };

  const getPaymentIcon = (payment: string) => {
    switch (payment.toLowerCase()) {
      case "cash":
        return <Banknote className="size-3.5" />;
      case "card":
        return <CreditCard className="size-3.5" />;
      case "upi":
        return <QrCode className="size-3.5" />;
      default:
        return null;
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Top Header & Filter Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-coffee">Orders</h1>
            <span className="rounded-full bg-coffee/10 px-2.5 py-0.5 font-mono text-xs font-bold text-coffee">
              {orders.length} total
            </span>
          </div>
          {ordersLoading && (
            <p className="mt-1 font-mono text-xs text-ink-soft">Syncing orders with Supabase…</p>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 rounded-2xl border border-ink/10 bg-cream/70 p-1 shadow-xs">
          {(["all", "paid", "cancelled"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`press rounded-xl px-4 py-2 text-xs font-bold capitalize transition-all sm:text-sm ${
                filter === f
                  ? "bg-coffee text-cream shadow-card"
                  : "text-ink-soft hover:text-ink hover:bg-cream"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Search Bar */}
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order #, cashier, payment, or item name…"
          className="w-full rounded-2xl border border-ink/15 bg-paper py-2.5 pl-10 pr-10 text-sm font-medium text-ink placeholder:text-ink-soft/70 shadow-xs focus:border-coffee focus:outline-none focus:ring-2 focus:ring-coffee/20"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-soft hover:bg-ink/10"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Orders Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((o) => {
          const time = new Date(o.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          const dateStr = new Date(o.createdAt).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          });
          const isCancelling = actionLoadingId === o.id;
          const isPaid = o.status === "paid";

          return (
            <div
              key={o.id}
              className={`card-hover flex flex-col justify-between rounded-2xl border bg-paper p-5 shadow-card transition-all ${
                isPaid ? "border-ink/10" : "border-tomato/30 bg-tomato/5"
              }`}
            >
              <div>
                {/* Header row: Order # & Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-black text-coffee">
                        #{o.number}
                      </span>
                      <span className="flex items-center gap-1 rounded-md bg-cream px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-soft">
                        {getPaymentIcon(o.payment)}
                        <span className="capitalize">{o.payment}</span>
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-medium text-ink-soft">
                      {dateStr} · {time} · {o.cashier || "Cashier"}
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-mono text-lg font-black leading-none ${
                        !isPaid ? "line-through text-ink-soft" : "text-ink"
                      }`}
                    >
                      {fmt(o.total)}
                    </div>
                    <span
                      className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${
                        isPaid
                          ? "bg-mint-soft text-mint shadow-xs"
                          : "bg-tomato/15 text-tomato shadow-xs"
                      }`}
                    >
                      {isPaid ? "Paid" : "Cancelled"}
                    </span>
                  </div>
                </div>

                {/* Items breakdown list */}
                <div className="mt-3.5 border-t border-dashed border-ink/10 pt-3">
                  <div className="text-xs font-bold text-ink-soft">Items ({o.lines.reduce((s, l) => s + l.qty, 0)})</div>
                  <div className="mt-1 space-y-1">
                    {o.lines.map((l, i) => (
                      <div key={i} className="flex justify-between text-xs font-semibold text-ink">
                        <span className="truncate pr-2">
                          <span className="font-bold text-coffee">{l.qty}×</span> {l.name}
                        </span>
                        <span className="shrink-0 font-mono text-ink-soft">{fmt(l.price * l.qty)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-5 flex gap-2 border-t border-ink/10 pt-3">
                <button
                  type="button"
                  onClick={() => setReceipt(o)}
                  className="press flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink/15 bg-cream py-2.5 text-xs font-bold text-coffee shadow-xs transition-all hover:border-ink/30 hover:bg-cream/90"
                >
                  <Receipt className="size-3.5" />
                  <span>Receipt</span>
                </button>
                {isPaid && (
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={() => setCancellingOrder(o)}
                    className="press rounded-xl px-3.5 py-2.5 text-xs font-bold text-tomato transition-colors hover:bg-tomato/10 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isCancelling ? "Cancelling…" : "Cancel"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {list.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink/15 py-12 text-center">
          <p className="text-sm font-medium text-ink-soft">
            {ordersLoading ? "Loading orders…" : search ? "No orders found matching your search." : "No orders yet."}
          </p>
        </div>
      )}

      {receipt && (
        <Suspense fallback={null}>
          <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />
        </Suspense>
      )}

      {cancellingOrder && (
        <Suspense fallback={null}>
          <CancelOrderModal
            order={cancellingOrder}
            onClose={() => setCancellingOrder(null)}
            onConfirm={confirmCancel}
            isCancelling={actionLoadingId === cancellingOrder.id}
          />
        </Suspense>
      )}
    </main>
  );
}
