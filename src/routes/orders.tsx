import { createFileRoute } from "@tanstack/react-router";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  CreditCard,
  MessageCircle,
  Phone,
  QrCode,
  Receipt,
  RotateCcw,
  Search,
  User,
  X,
} from "lucide-react";
import { fmt, isOrderToday, type Order } from "@/lib/pos-data";
import {
  cancelOrder,
  markOrderPreparing,
  markOrderReady,
  usePos,
} from "@/lib/pos-store";

// Lazy-load modals
const ReceiptModal = lazy(() =>
  import("@/components/Receipt").then((m) => ({ default: m.ReceiptModal })),
);
const CancelOrderModal = lazy(() =>
  import("@/components/CancelOrderModal").then((m) => ({ default: m.CancelOrderModal })),
);
const WhatsAppPreviewModal = lazy(() =>
  import("@/components/WhatsAppPreviewModal").then((m) => ({ default: m.WhatsAppPreviewModal })),
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
      {
        name: "description",
        content: "Order history, receipts, kitchen readiness and WhatsApp notifications for FUWA.",
      },
      { property: "og:title", content: "Orders — FUWA Japanese Fluffy Desserts" },
      {
        property: "og:description",
        content: "Order history, receipts, kitchen readiness and WhatsApp notifications for FUWA.",
      },
    ],
  }),
  component: ProtectedOrdersPage,
});

type OrderFilter = "all" | "preparing" | "ready" | "paid" | "cancelled";

const INITIAL_PAGE_SIZE = 24;

interface OrderCardProps {
  order: Order;
  isCancelling: boolean;
  onMarkReady: (o: Order) => void;
  onMarkPreparing: (o: Order) => void;
  onViewReceipt: (o: Order) => void;
  onCancelPrompt: (o: Order) => void;
  onPreviewWhatsApp: (o: Order, type: "invoice" | "ready") => void;
}

const OrderCard = memo(function OrderCard({
  order: o,
  isCancelling,
  onMarkReady,
  onMarkPreparing,
  onViewReceipt,
  onCancelPrompt,
  onPreviewWhatsApp,
}: OrderCardProps) {
  const isPaid = o.status === "paid";
  const isToday = isOrderToday(o.createdAt);

  const time = useMemo(
    () =>
      new Date(o.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [o.createdAt],
  );

  const dateStr = useMemo(
    () =>
      new Date(o.createdAt).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
    [o.createdAt],
  );

  const totalItemsCount = useMemo(
    () => o.lines.reduce((s, l) => s + l.qty, 0),
    [o.lines],
  );

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
    <div
      className={`flex flex-col justify-between rounded-2xl border bg-fuwa-surface p-4 sm:p-5 shadow-card transition-all ${
        isPaid ? "border-fuwa-brown/10" : "border-red-200 bg-red-50/30"
      }`}
      style={{ contentVisibility: "auto", containIntrinsicSize: "280px" }}
    >
      <div>
        {/* Header row: Order # & Status Badges */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-mono text-base font-black text-fuwa-orange">
                #{o.number}
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-fuwa-cream px-2 py-0.5 font-mono text-[11px] font-bold text-fuwa-brown/70">
                {getPaymentIcon(o.payment)}
                <span className="capitalize">{o.payment}</span>
              </span>

              {/* Kitchen Fulfillment Badge: ONLY for today's active paid orders */}
              {isPaid && isToday && (
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-black ${
                    o.isReady
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-500/20"
                      : "bg-amber-100/90 text-amber-900 border border-amber-500/30"
                  }`}
                >
                  {o.isReady ? (
                    <>
                      <CheckCircle2 className="size-3 text-emerald-600" />
                      <span>Ready</span>
                    </>
                  ) : (
                    <>
                      <Clock className="size-3 text-amber-700" />
                      <span>Preparing</span>
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="mt-1 text-xs font-semibold text-fuwa-brown/60">
              {dateStr} · {time} · {o.cashier || "Cashier"}
              {/* Only show ready timestamp on today's orders */}
              {isToday && o.isReady && o.readyAt && (
                <span className="text-emerald-700 font-bold ml-1">
                  · Ready at{" "}
                  {new Date(o.readyAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>

            {/* Customer Info & WhatsApp Tags */}
            {(o.customerName || o.customerPhone) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {o.customerName && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-fuwa-cream px-2 py-0.5 text-xs font-extrabold text-fuwa-brown">
                    <User className="size-3 text-fuwa-orange" />
                    <span className="truncate max-w-[130px]">{o.customerName}</span>
                  </span>
                )}
                {o.customerPhone && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-fuwa-brown/10 bg-fuwa-surface px-2 py-0.5 font-mono text-[11px] font-bold text-fuwa-brown/70">
                    <Phone className="size-3 text-fuwa-brown/50" />
                    <span>{o.customerPhone}</span>
                  </span>
                )}

                {/* WhatsApp Notification Indicators */}
                {o.whatsappReadySent && (
                  <button
                    type="button"
                    onClick={() => onPreviewWhatsApp(o, "ready")}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-800 transition-colors"
                    title="Preview WhatsApp Ready message"
                  >
                    <MessageCircle className="size-3 fill-current text-emerald-600" />
                    <span>Ready Alert Sent</span>
                  </button>
                )}

                {!o.whatsappReadySent && o.whatsappInvoiceSent && (
                  <button
                    type="button"
                    onClick={() => onPreviewWhatsApp(o, "invoice")}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-800 transition-colors"
                    title="Preview WhatsApp Bill"
                  >
                    <MessageCircle className="size-3 fill-current text-emerald-600" />
                    <span>Bill Sent</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="text-right shrink-0">
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
            Items ({totalItemsCount})
          </div>
          <div className="mt-1 space-y-1">
            {o.lines.map((l, i) => (
              <div key={i} className="flex justify-between text-xs font-semibold text-fuwa-brown">
                <div className="truncate pr-2">
                  <span className="font-extrabold text-fuwa-orange">{l.qty}×</span> {l.name}
                  {l.category && (
                    <span className="ml-1.5 inline-block rounded-md bg-fuwa-orange/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuwa-orange">
                      {l.category}
                    </span>
                  )}
                </div>
                <span className="shrink-0 font-mono text-fuwa-brown/65">{fmt(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-fuwa-brown/10 pt-3">
        {/* Kitchen fulfillment controls: ONLY shown for today's paid orders */}
        {isPaid && isToday && (
          !o.isReady ? (
            <button
              type="button"
              onClick={() => onMarkReady(o)}
              className="press flex flex-1 items-center justify-center gap-1.5 min-h-[42px] rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-[0.98]"
            >
              <BellRing className="size-3.5" />
              <span>{o.customerPhone ? "Ready & Notify" : "Mark as Ready"}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
              <button
                type="button"
                onClick={() => {
                  if (o.customerPhone) {
                    onPreviewWhatsApp(o, "ready");
                  }
                }}
                className="flex flex-1 items-center justify-center gap-1.5 min-h-[42px] rounded-xl border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-800 transition-all hover:bg-emerald-100"
              >
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                <span>Ready ✓</span>
                {o.customerPhone && (
                  <span className="text-[10px] text-emerald-700/80 font-bold ml-0.5">· WA</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onMarkPreparing(o)}
                title="Revert back to Preparing"
                className="press grid size-[42px] shrink-0 place-items-center rounded-xl border border-fuwa-brown/15 bg-fuwa-cream text-fuwa-brown/60 hover:text-fuwa-brown hover:bg-fuwa-cream/80 transition-colors"
                aria-label="Revert to preparing"
              >
                <RotateCcw className="size-3.5" />
              </button>
            </div>
          )
        )}

        {/* View Receipt button (always available) */}
        <button
          type="button"
          onClick={() => onViewReceipt(o)}
          className={`press flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 rounded-xl border border-fuwa-brown/15 bg-fuwa-cream py-2 text-xs font-extrabold text-fuwa-brown shadow-xs transition-all hover:bg-fuwa-cream/80 ${
            !isToday || !isPaid ? "flex-1" : ""
          }`}
        >
          <Receipt className="size-3.5 text-fuwa-orange" />
          <span>Receipt</span>
        </button>

        {/* Cancel button */}
        {isPaid && (
          <button
            type="button"
            disabled={isCancelling}
            onClick={() => onCancelPrompt(o)}
            className="press min-h-[42px] rounded-xl px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
          >
            {isCancelling ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>
    </div>
  );
});

function OrdersPage() {
  const orders = usePos((s) => s.orders);
  const ordersLoading = usePos((s) => s.ordersLoading);
  const actionLoadingId = usePos((s) => s.actionLoadingId);
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [whatsAppPreview, setWhatsAppPreview] = useState<{
    order: Order;
    type: "invoice" | "ready";
  } | null>(null);

  // Active status counts: ONLY today's active paid orders need kitchen fulfillment
  const preparingCount = useMemo(
    () =>
      orders.filter(
        (o) => o.status === "paid" && !o.isReady && isOrderToday(o.createdAt),
      ).length,
    [orders],
  );

  const readyCount = useMemo(
    () =>
      orders.filter(
        (o) => o.status === "paid" && o.isReady && isOrderToday(o.createdAt),
      ).length,
    [orders],
  );

  // Reset pagination window when filter or search changes for instant responsiveness
  useEffect(() => {
    setVisibleCount(INITIAL_PAGE_SIZE);
  }, [filter, search]);

  // Memoize filtered and searched orders list
  const list = useMemo(() => {
    let result = orders;
    if (filter === "paid") {
      result = orders.filter((o) => o.status === "paid");
    } else if (filter === "cancelled") {
      result = orders.filter((o) => o.status === "cancelled");
    } else if (filter === "preparing") {
      // Preparing filter only shows today's orders currently in preparation
      result = orders.filter(
        (o) => o.status === "paid" && !o.isReady && isOrderToday(o.createdAt),
      );
    } else if (filter === "ready") {
      // Ready filter only shows today's orders currently ready for pickup
      result = orders.filter(
        (o) => o.status === "paid" && o.isReady && isOrderToday(o.createdAt),
      );
    }

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

  // Virtualized slice for 60fps instant initial mount and fast LCP
  const visibleList = useMemo(() => list.slice(0, visibleCount), [list, visibleCount]);
  const hasMore = visibleCount < list.length;

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

  const handleMarkReady = useCallback(async (o: Order) => {
    try {
      await markOrderReady(o.id, { notifyWhatsApp: true });
      if (o.customerPhone) {
        toast.success(`Order #${o.number} is Ready!`, {
          description: `WhatsApp notification sent to +91 ${o.customerPhone}`,
          action: {
            label: "View Message",
            onClick: () =>
              setWhatsAppPreview({
                order: { ...o, isReady: true, whatsappReadySent: true },
                type: "ready",
              }),
          },
        });
      } else {
        toast.success(`Order #${o.number} marked as Ready`);
      }
    } catch {
      toast.error(`Failed to update order #${o.number}`);
    }
  }, []);

  const handleMarkPreparing = useCallback(async (o: Order) => {
    try {
      await markOrderPreparing(o.id);
      toast.info(`Order #${o.number} moved back to preparing`);
    } catch {
      toast.error(`Failed to update order #${o.number}`);
    }
  }, []);

  const handlePreviewWhatsApp = useCallback((o: Order, type: "invoice" | "ready") => {
    setWhatsAppPreview({ order: o, type });
  }, []);

  const handleViewReceipt = useCallback((o: Order) => {
    setReceipt(o);
  }, []);

  const handleCancelPrompt = useCallback((o: Order) => {
    setCancellingOrder(o);
  }, []);

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
        <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-fuwa-brown/10 bg-fuwa-surface p-1 shadow-xs">
          {(
            [
              { id: "all", label: "All", count: orders.length },
              {
                id: "preparing",
                label: "Preparing",
                count: preparingCount,
                highlight: preparingCount > 0,
              },
              { id: "ready", label: "Ready", count: readyCount },
              { id: "paid", label: "Paid" },
              { id: "cancelled", label: "Cancelled" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as OrderFilter)}
              className={`press flex items-center gap-1.5 rounded-xl min-h-[38px] px-3.5 py-1.5 text-xs font-extrabold capitalize transition-all sm:text-sm ${
                filter === tab.id
                  ? "bg-fuwa-orange text-white shadow-card"
                  : "text-fuwa-brown/70 hover:text-fuwa-brown hover:bg-fuwa-cream/50"
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold leading-none ${
                    filter === tab.id
                      ? "bg-white/25 text-white"
                      : tab.highlight
                        ? "bg-fuwa-orange/15 text-fuwa-orange"
                        : "bg-fuwa-brown/10 text-fuwa-brown/70"
                  }`}
                >
                  {tab.count}
                </span>
              )}
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

      {/* Orders Grid (High-speed memoized rendering) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleList.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            isCancelling={actionLoadingId === o.id}
            onMarkReady={handleMarkReady}
            onMarkPreparing={handleMarkPreparing}
            onViewReceipt={handleViewReceipt}
            onCancelPrompt={handleCancelPrompt}
            onPreviewWhatsApp={handlePreviewWhatsApp}
          />
        ))}
      </div>

      {/* Progressive Load More button when order history is extensive */}
      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + INITIAL_PAGE_SIZE)}
            className="press flex items-center gap-2 rounded-2xl border border-fuwa-brown/15 bg-fuwa-surface px-6 py-3 text-xs font-black text-fuwa-brown shadow-xs transition-all hover:bg-fuwa-cream/70 active:scale-[0.98]"
          >
            <ChevronDown className="size-4 text-fuwa-orange" />
            <span>
              Show more orders ({list.length - visibleCount} remaining)
            </span>
          </button>
        </div>
      )}

      {list.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-fuwa-brown/15 bg-fuwa-surface/50 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-fuwa-cream text-fuwa-orange mb-3">
            <ClipboardList className="size-6 text-fuwa-orange" />
          </div>
          <div className="text-base font-extrabold text-fuwa-brown">
            {ordersLoading ? "Loading orders…" : search ? "No matching orders found" : "No orders in this view"}
          </div>
          <p className="mt-1 text-xs text-fuwa-brown/65 max-w-sm">
            {ordersLoading
              ? "Fetching order records from storage…"
              : search
                ? "Try searching for a different customer name, phone number, or order ID."
                : filter === "preparing"
                  ? "All of today's orders have been prepared! Fresh orders will appear here automatically."
                  : filter === "ready"
                    ? "No orders currently waiting for customer pickup today."
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

      {whatsAppPreview && (
        <Suspense fallback={null}>
          <WhatsAppPreviewModal
            order={whatsAppPreview.order}
            type={whatsAppPreview.type}
            onClose={() => setWhatsAppPreview(null)}
          />
        </Suspense>
      )}
    </main>
  );
}
