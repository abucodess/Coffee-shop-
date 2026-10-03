import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CATEGORIES,
  fmt,
  type Category,
  type Order,
  type PaymentMethod,
} from "@/lib/pos-data";
import {
  addToCart,
  cartTotals,
  clearCart,
  completeOrder,
  initializePosStore,
  setQty,
  usePos,
} from "@/lib/pos-store";

import { ProtectedRoute, useAuth } from "@/auth";

// Lazy-load receipt modal so billing page bundle is ultra lean
const ReceiptModal = lazy(() =>
  import("@/components/Receipt").then((m) => ({ default: m.ReceiptModal })),
);

function BillingPage() {
  return (
    <ProtectedRoute>
      <Billing />
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Billing — Mocha Counter POS" },
      {
        name: "description",
        content: "Fast touch-friendly billing for Mocha Counter coffee shop.",
      },
      { property: "og:title", content: "Billing — Mocha Counter POS" },
      {
        property: "og:description",
        content: "Fast touch-friendly billing for Mocha Counter coffee shop.",
      },
    ],
  }),
  component: BillingPage,
});

const TAB_COLORS: Record<Category, string> = {
  Espresso: "bg-lemon",
  Cold: "bg-sky",
  Pastry: "bg-lilac",
  Bowls: "bg-clay",
};

const TILE_BG: Record<string, string> = {
  lemon: "bg-lemon",
  coral: "bg-coral",
  "mint-soft": "bg-mint-soft",
  lilac: "bg-lilac",
  clay: "bg-clay",
  sky: "bg-sky",
  paper: "bg-paper",
};

function Billing() {
  const { user, profile, isAdmin } = useAuth();
  const menu = usePos((s) => s.menu);
  const cart = usePos((s) => s.cart);
  const counter = usePos((s) => s.counter);
  const menuLoading = usePos((s) => s.menuLoading);
  const isSubmittingOrder = usePos((s) => s.isSubmittingOrder);
  const [cat, setCat] = useState<Category | "All">("All");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    initializePosStore(true).catch(() => {});
  }, []);

  // Memoized O(1) product lookup map
  const menuMap = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);

  // Memoized calculations to prevent unnecessary re-computations
  const items = useMemo(
    () => (cat === "All" ? menu : menu.filter((m) => m.category === cat)),
    [cat, menu],
  );
  const live = useMemo(() => menu.filter((m) => m.available).length, [menu]);
  const { subtotal, total } = useMemo(() => cartTotals(cart, menu), [cart, menu]);
  const count = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);

  const onComplete = async () => {
    if (cart.length === 0 || isSubmittingOrder) return;
    try {
      // If admin, display "Cashier". Otherwise, use the staff member's name.
      const cashierName = isAdmin
        ? "Cashier"
        : (profile?.full_name?.trim() || user?.email?.split("@")[0] || "Staff");

      const order = await completeOrder(payment, 0, cashierName);
      if (order) {
        toast.success(`Order ${order.number} completed — ${fmt(order.total)}`);
        setReceipt(order);
        setCartOpen(false);
      }
    } catch {
      toast.error("Failed to complete order. Please try again.");
    }
  };

  const cartPanel = (
    <div className="overflow-hidden rounded-3xl border border-ink/15 bg-paper shadow-card-lg">
      <div className="flex items-center justify-between border-b-2 border-dashed border-ink/15 px-5 py-4">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink-soft">
          Order #A-{String(counter).padStart(3, "0")}
        </span>
        <span className="rounded-full bg-amber/90 px-2.5 py-1 text-[11px] font-bold text-coffee">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="max-h-[40vh] divide-y divide-dashed divide-ink/10 overflow-y-auto px-5">
        {cart.length === 0 && (
          <div className="py-10 text-center text-sm font-medium text-ink-soft">
            Tap an item to start an order
          </div>
        )}
        {cart.map((l) => {
          const item = menuMap.get(l.itemId);
          if (!item) return null;
          return (
            <div key={l.itemId} className="animate-pop flex items-center justify-between py-3.5">
              <div className="min-w-0 pr-3">
                <div className="truncate text-sm font-bold">{item.name}</div>
                <div className="font-mono text-xs text-ink-soft">{fmt(item.price * l.qty)}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  aria-label={`Remove one ${item.name}`}
                  onClick={() => setQty(l.itemId, l.qty - 1)}
                  className="press grid size-9 place-items-center rounded-lg border border-ink/20 bg-cream text-base font-bold"
                >
                  −
                </button>
                <span className="w-5 text-center font-mono text-sm font-bold">{l.qty}</span>
                <button
                  aria-label={`Add one ${item.name}`}
                  onClick={() => setQty(l.itemId, l.qty + 1)}
                  className="press grid size-9 place-items-center rounded-lg bg-coffee text-base font-bold text-cream"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t-2 border-dashed border-ink/15 px-5 py-4">
        <div className="flex justify-between text-sm font-medium text-ink-soft">
          <span>Subtotal</span>
          <span className="font-mono">{fmt(subtotal)}</span>
        </div>
        <div className="mt-3 flex items-end justify-between border-t border-dashed border-ink/15 pt-2">
          <span className="text-lg font-extrabold">Grand Total</span>
          <span className="font-mono text-3xl font-bold leading-none">{fmt(total)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-5 pb-2">
        {(["cash", "card", "upi"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPayment(p)}
            className={`press rounded-xl border-2 px-2 py-2.5 text-xs font-bold uppercase tracking-wider ${
              payment === p
                ? p === "cash"
                  ? "border-mint bg-mint text-cream shadow-card"
                  : p === "upi"
                    ? "border-amber bg-amber text-coffee shadow-card font-extrabold"
                    : "border-coffee bg-coffee text-cream shadow-card"
                : "border-ink/15 bg-cream text-ink-soft"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="px-5 pb-5">
        <button
          disabled={cart.length === 0 || isSubmittingOrder}
          onClick={onComplete}
          className="press mt-3 w-full rounded-xl bg-amber px-4 py-4 text-lg font-extrabold text-coffee shadow-card disabled:opacity-40"
        >
          {isSubmittingOrder ? "Saving order…" : "Complete order"}
        </button>
        <button
          disabled={cart.length === 0 || isSubmittingOrder}
          onClick={() => {
            clearCart();
            toast("Order cleared");
          }}
          className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-bold text-tomato transition-colors hover:bg-tomato/10 disabled:opacity-40"
        >
          Cancel order
        </button>
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 lg:pb-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_384px]">
        <div className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">New order</h1>
            <span className="shrink-0 rounded-full bg-mint-soft px-3 py-1 text-xs font-bold text-mint">
              {menuLoading ? "Syncing menu…" : `${live} items live`}
            </span>
          </div>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {(["All", ...CATEGORIES] as const).map((c) => {
              const active = cat === c;
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`press shrink-0 rounded-full px-5 py-2.5 text-sm font-bold ${
                    active
                      ? "bg-coffee text-cream shadow-card"
                      : `${c === "All" ? "bg-paper" : TAB_COLORS[c]} text-coffee`
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((item) =>
              item.available ? (
                <button
                  key={item.id}
                  onClick={() => addToCart(item.id)}
                  className={`press flex min-h-[112px] flex-col rounded-2xl border border-ink/10 ${TILE_BG[item.color]} p-4 text-left shadow-card hover:shadow-card-lg`}
                >
                  <span className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-coffee">
                      {fmt(item.price)}
                    </span>
                    <span className="grid size-8 place-items-center rounded-full bg-coffee text-lg font-bold leading-none text-cream">
                      +
                    </span>
                  </span>
                  <span className="text-base font-bold leading-snug">{item.name}</span>
                  <span className="mt-0.5 text-xs font-medium text-coffee/70">{item.note}</span>
                </button>
              ) : (
                <div
                  key={item.id}
                  className="flex min-h-[112px] cursor-not-allowed flex-col rounded-2xl border-2 border-dashed border-ink/25 p-4 text-left"
                >
                  <span className="mb-3 font-mono text-sm font-bold text-ink-soft">
                    {fmt(item.price)}
                  </span>
                  <span className="text-base font-bold leading-snug text-ink-soft">
                    {item.name}
                  </span>
                  <span className="mt-0.5 text-xs font-bold text-tomato">Out of stock</span>
                </div>
              ),
            )}
          </div>
        </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">{cartPanel}</aside>
      </section>

      {/* Mobile/tablet portrait: bottom bar + sheet */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/15 bg-paper/95 p-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setCartOpen(true)}
          className="press flex w-full items-center justify-between rounded-xl bg-coffee px-5 py-4 text-cream shadow-card"
        >
          <span className="font-bold">View order · {count}</span>
          <span className="font-mono text-lg font-bold">{fmt(total)}</span>
        </button>
      </div>
      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-ink/40 lg:hidden"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full overflow-y-auto p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {cartPanel}
          </div>
        </div>
      )}

      {receipt && (
        <Suspense fallback={null}>
          <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />
        </Suspense>
      )}
    </main>
  );
}
