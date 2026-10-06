import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { Banknote, CreditCard, Phone, QrCode, Receipt, Search, User, X, ClipboardList } from "lucide-react";
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
      { title: "Orders — FUWA Japanese Fluffy Desserts" },
      { name: "description", content: "Order history, receipts and cancellations for FUWA." },
      { property: "og:title", content: "Orders — FUWA Japanese Fluffy Desserts" },
      { property: "og:description", content: "Order history, receipts and cancellations for FUWA." },
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
          (o.customerName && o.customerName.toLowerCase().includes(q)) ||
          (o.customerPhone && o.customerPhone.includes(q)) ||
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
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      {/* Top Header & Filter Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-fuwa-brown sm:text-3xl">
              Order History
            </h1>
            <span className="rounded-full bg-fuwa-orange/15 px-3 py-1 font-mono text-xs font-black text-fuwa-orange">
              {orders.length} total
            </span>
          </div>
          {ordersLoading && (
            <p className="mt-1 font-mono text-xs text-fuwa-brown/60">Syncing orders…</p>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 rounded-2xl border border-fuwa-brown/10 bg-fuwa-surface p-1 shadow-xs">
          {(["all", "paid", "cancelled"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`press rounded-xl min-h-[38px] px-4 py-1.5 text-xs font-extrabold capitalize transition-all sm:text-sm ${
                filter === f
                  ? "bg-fuwa-orange text-white shadow-card"
                  : "text-fuwa-brown/70 hover:text-fuwa-brown hover:bg-fuwa-cream/50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Search Bar */}
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fuwa-brown/50" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order #, customer, phone, cashier, payment, or item…"
          className="w-full rounded-2xl border border-fuwa-brown/15 bg-fuwa-surface py-2.5 pl-10 pr-10 text-sm font-semibold text-fuwa-brown placeholder:text-fuwa-brown/40 shadow-xs focus:border-fuwa-orange focus:outline-none focus:ring-2 focus:ring-fuwa-orange/20 transition-all"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-fuwa-brown/60 hover:bg-fuwa-brown/10"
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
              className={`flex flex-col justify-between rounded-2xl border bg-fuwa-surface p-4 sm:p-5 shadow-card transition-all ${
                isPaid ? "border-fuwa-brown/10" : "border-red-200 bg-red-50/30"
              }`}
            >
              <div>
                {/* Header row: Order # & Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-black text-fuwa-orange">
                        #{o.number}
                      </span>
                      <span className="flex items-center gap-1 rounded-lg bg-fuwa-cream px-2 py-0.5 font-mono text-[11px] font-bold text-fuwa-brown/70">
                        {getPaymentIcon(o.payment)}
                        <span className="capitalize">{o.payment}</span>
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-fuwa-brown/60">
                      {dateStr} · {time} · {o.cashier || "Cashier"}
                    </div>
                    {(o.customerName || o.customerPhone) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {o.customerName && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-fuwa-cream px-2 py-0.5 text-xs font-extrabold text-fuwa-brown">
                            <User className="size-3 text-fuwa-orange" />
                            <span className="truncate max-w-[140px]">{o.customerName}</span>
                          </span>
                        )}
                        {o.customerPhone && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-fuwa-brown/10 bg-fuwa-surface px-2 py-0.5 font-mono text-[11px] font-bold text-fuwa-brown/70">
                            <Phone className="size-3 text-fuwa-brown/50" />
                            <span>{o.customerPhone}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-mono text-lg font-black leading-none ${
                        !isPaid ? "line-through text-fuwa-brown/40" : "text-fuwa-brown"
                      }`}
                    >
                      {fmt(o.total)}
                    </div>
                    <span
                      className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${
                        isPaid
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-500/20"
                          : "bg-red-50 text-red-700 border border-red-500/20"
                      }`}
                    >
                      {isPaid ? "Paid" : "Cancelled"}
                    </span>
                  </div>
                </div>

                {/* Items breakdown list */}
                <div className="mt-3.5 border-t border-dashed border-fuwa-brown/10 pt-3">
                  <div className="text-xs font-extrabold text-fuwa-brown/70">
                    Items ({o.lines.reduce((s, l) => s + l.qty, 0)})
                  </div>
                  <div className="mt-1 space-y-1">
                    {o.lines.map((l, i) => (
                      <div key={i} className="flex justify-between text-xs font-semibold text-fuwa-brown">
                        <span className="truncate pr-2">
                          <span className="font-extrabold text-fuwa-orange">{l.qty}×</span> {l.name}
                        </span>
                        <span className="shrink-0 font-mono text-fuwa-brown/65">{fmt(l.price * l.qty)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-5 flex gap-2 border-t border-fuwa-brown/10 pt-3">
                <button
                  type="button"
                  onClick={() => setReceipt(o)}
                  className="press flex flex-1 items-center justify-center gap-1.5 min-h-[42px] rounded-xl border border-fuwa-brown/15 bg-fuwa-cream py-2 text-xs font-extrabold text-fuwa-brown shadow-xs transition-all hover:bg-fuwa-cream/80"
                >
                  <Receipt className="size-3.5 text-fuwa-orange" />
                  <span>View Receipt</span>
                </button>
                {isPaid && (
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={() => setCancellingOrder(o)}
                    className="press min-h-[42px] rounded-xl px-4 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
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
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-fuwa-brown/15 bg-fuwa-surface/50 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-fuwa-cream text-fuwa-orange mb-3">
            <ClipboardList className="size-6 text-fuwa-orange" />
          </div>
          <div className="text-base font-extrabold text-fuwa-brown">
            {ordersLoading ? "Loading orders…" : search ? "No matching orders found" : "No orders yet"}
          </div>
          <p className="mt-1 text-xs text-fuwa-brown/65 max-w-sm">
            {ordersLoading
              ? "Fetching order records from storage…"
              : search
                ? "Try searching for a different customer name, phone number, or order ID."
                : "New orders completed in the POS will appear here with instant receipt reprint options."}
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
