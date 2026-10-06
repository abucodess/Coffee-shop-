import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Banknote,
  Check,
  CreditCard,
  Phone,
  QrCode,
  ShoppingCart,
  Sparkles,
  User,
  X,
} from "lucide-react";
import {
  fmt,
  sanitizePhoneDigits,
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

const DEFAULT_TAB_COLORS: Record<string, string> = {
  Espresso: "bg-lemon",
  Cold: "bg-sky",
  Pastry: "bg-lilac",
  Bowls: "bg-clay",
};

const PALETTE = ["bg-lemon", "bg-sky", "bg-lilac", "bg-clay", "bg-coral", "bg-mint-soft"];

function getTabColor(categoryName: string, index: number): string {
  if (categoryName === "All") return "bg-paper";
  if (DEFAULT_TAB_COLORS[categoryName]) return DEFAULT_TAB_COLORS[categoryName];
  return PALETTE[index % PALETTE.length];
}

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
  const categories = usePos((s) => s.categories);
  const cart = usePos((s) => s.cart);
  const counter = usePos((s) => s.counter);
  const menuLoading = usePos((s) => s.menuLoading);
  const isSubmittingOrder = usePos((s) => s.isSubmittingOrder);
  const [cat, setCat] = useState<string>("All");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    initializePosStore(true).catch(() => {});
  }, []);

  // Compute dynamic tabs: "All" followed by categories in store and any active item categories
  const categoryTabs = useMemo(() => {
    const names = new Set<string>();
    categories.forEach((c) => names.add(c.name));
    menu.forEach((m) => {
      if (m.category) names.add(m.category);
    });
    return ["All", ...Array.from(names)];
  }, [categories, menu]);

  // If active category gets deleted, safely reset filter to "All"
  useEffect(() => {
    if (cat !== "All" && !categoryTabs.includes(cat)) {
      setCat("All");
    }
  }, [categoryTabs, cat]);

  // Memoized O(1) product lookup map
  const menuMap = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);

  // Memoized map of cart quantities for card badge lookup
  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((c) => map.set(c.itemId, c.qty));
    return map;
  }, [cart]);

  // Memoized calculations to prevent unnecessary re-computations
  const items = useMemo(
    () => (cat === "All" ? menu : menu.filter((m) => m.category === cat)),
    [cat, menu],
  );
  const live = useMemo(() => menu.filter((m) => m.available).length, [menu]);
  const { subtotal, total } = useMemo(() => cartTotals(cart, menu), [cart, menu]);
  const count = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);

  const handlePhoneChange = (val: string) => {
    const digitsOnly = sanitizePhoneDigits(val);
    setCustomerPhone(digitsOnly);
    if (digitsOnly.length > 0 && digitsOnly.length < 10) {
      setPhoneError("Phone number must be exactly 10 digits");
    } else {
      setPhoneError(null);
    }
  };

  const onComplete = async () => {
    if (cart.length === 0 || isSubmittingOrder) return;

    // Validate phone number: if provided, must be strictly 10 digits
    const cleanedPhone = customerPhone.trim();
    if (cleanedPhone.length > 0 && cleanedPhone.length !== 10) {
      setPhoneError("Phone number must be exactly 10 digits");
      toast.error("Phone number must be exactly 10 digits");
      return;
    }

    try {
      // If admin, display "Cashier". Otherwise, use the staff member's name.
      const cashierName = isAdmin
        ? "Cashier"
        : (profile?.full_name?.trim() || user?.email?.split("@")[0] || "Staff");

      const order = await completeOrder(
        payment,
        0,
        cashierName,
        customerName.trim() || undefined,
        cleanedPhone || undefined,
      );
      if (order) {
        toast.success(`Order ${order.number} completed — ${fmt(order.total)}`);
        setReceipt(order);
        setCustomerName("");
        setCustomerPhone("");
        setPhoneError(null);
        setCartOpen(false);
      }
    } catch {
      toast.error("Failed to complete order. Please try again.");
    }
  };

  const cartPanel = (
    <div className="overflow-hidden rounded-3xl border border-ink/15 bg-paper shadow-card-lg">
      <div className="flex items-center justify-between border-b-2 border-dashed border-ink/15 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink-soft">
            Order #A-{String(counter).padStart(3, "0")}
          </span>
          <span className="rounded-full bg-amber/90 px-2.5 py-0.5 text-[11px] font-bold text-coffee">
            {count} {count === 1 ? "item" : "items"}
          </span>
        </div>
        {cartOpen && (
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="rounded-full p-1 text-ink-soft hover:bg-ink/10 lg:hidden"
            aria-label="Close cart"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <div className="max-h-[34vh] divide-y divide-dashed divide-ink/10 overflow-y-auto px-5 sm:max-h-[36vh]">
        {cart.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-cream text-ink-soft">
              <ShoppingCart className="size-6 text-ink-soft/60" />
            </div>
            <div className="mt-2 text-sm font-bold text-ink">No items in order</div>
            <div className="text-xs text-ink-soft">Tap menu items to add them</div>
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

      {/* Customer Info Section (Optional, with 10-digit phone validation) */}
      <div className="border-t-2 border-dashed border-ink/15 bg-cream/40 px-5 py-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-ink-soft">
            <User className="size-3.5 text-coffee" />
            <span>Customer Details</span>
            <span className="text-[10px] font-semibold text-ink-soft/70 lowercase">(optional)</span>
          </span>
          {(customerName || customerPhone) && (
            <button
              type="button"
              onClick={() => {
                setCustomerName("");
                setCustomerPhone("");
                setPhoneError(null);
              }}
              className="text-[11px] font-bold text-ink-soft hover:text-tomato transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="space-y-2">
          {/* Customer Name */}
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-soft/60" />
            <input
              type="text"
              id="customer-name-input"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
              className="w-full rounded-xl border border-ink/15 bg-paper py-2 pl-9 pr-3 text-xs font-semibold text-ink placeholder:text-ink-soft/60 shadow-2xs focus:border-coffee focus:outline-none focus:ring-2 focus:ring-coffee/20 transition-all"
            />
          </div>

          {/* Customer Phone */}
          <div>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-soft/60" />
              <input
                type="tel"
                id="customer-phone-input"
                inputMode="numeric"
                maxLength={10}
                value={customerPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="Phone number (10 digits)"
                className={`w-full rounded-xl border bg-paper py-2 pl-9 pr-14 text-xs font-mono font-semibold text-ink placeholder:text-ink-soft/60 shadow-2xs focus:outline-none transition-all ${
                  phoneError
                    ? "border-tomato focus:ring-2 focus:ring-tomato/20"
                    : customerPhone.length === 10
                      ? "border-mint focus:ring-2 focus:ring-mint/20"
                      : "border-ink/15 focus:border-coffee focus:ring-2 focus:ring-coffee/20"
                }`}
              />
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                {customerPhone.length === 10 ? (
                  <span className="flex items-center gap-0.5 text-[11px] font-bold text-mint">
                    <Check className="size-3.5 stroke-[2.5]" />
                    <span>10/10</span>
                  </span>
                ) : customerPhone.length > 0 ? (
                  <span className="font-mono text-[10px] font-bold text-ink-soft">
                    {customerPhone.length}/10
                  </span>
                ) : null}
              </div>
            </div>

            {phoneError && (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-tomato">
                <AlertCircle className="size-3 shrink-0" />
                <span>{phoneError}</span>
              </p>
            )}
          </div>
        </div>
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
        {(
          [
            { id: "cash", label: "Cash", icon: Banknote },
            { id: "card", label: "Card", icon: CreditCard },
            { id: "upi", label: "UPI", icon: QrCode },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPayment(id)}
            className={`press flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
              payment === id
                ? id === "cash"
                  ? "border-mint bg-mint text-cream shadow-card"
                  : id === "upi"
                    ? "border-amber bg-amber text-coffee shadow-card font-extrabold"
                    : "border-coffee bg-coffee text-cream shadow-card"
                : "border-ink/15 bg-cream/70 text-ink-soft hover:border-ink/30 hover:bg-cream"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="px-5 pb-5">
        <button
          disabled={cart.length === 0 || isSubmittingOrder}
          onClick={onComplete}
          className="press mt-3 w-full rounded-xl bg-amber px-4 py-4 text-lg font-extrabold text-coffee shadow-card transition-all hover:bg-amber/90 active:scale-[0.99] disabled:opacity-40"
        >
          {isSubmittingOrder ? "Saving order…" : "Complete order"}
        </button>
        <button
          disabled={cart.length === 0 || isSubmittingOrder}
          onClick={() => {
            clearCart();
            setCustomerName("");
            setCustomerPhone("");
            setPhoneError(null);
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
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_384px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-coffee">New order</h1>
              <p className="text-xs font-medium text-ink-soft sm:text-sm">Tap any item to quickly add to current bill</p>
            </div>
            <span className="shrink-0 rounded-full bg-mint-soft px-3.5 py-1.5 text-xs font-bold text-mint shadow-xs">
              {menuLoading ? "Syncing menu…" : `${live} items live`}
            </span>
          </div>

          <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
            {categoryTabs.map((c, i) => {
              const active = cat === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  className={`press shrink-0 rounded-full px-5 py-2 text-sm font-bold transition-all ${
                    active
                      ? "bg-coffee text-cream shadow-card ring-2 ring-coffee/20"
                      : `${getTabColor(c, i)} text-coffee hover:opacity-90`
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => {
              const inCart = cartQtyMap.get(item.id) || 0;
              return item.available ? (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(item.id)}
                  className={`press card-hover relative flex min-h-[116px] flex-col justify-between rounded-2xl border ${
                    inCart > 0
                      ? "border-coffee ring-2 ring-coffee/30 shadow-card-lg"
                      : "border-ink/10 shadow-card hover:border-ink/20"
                  } ${TILE_BG[item.color]} p-4 text-left transition-all`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-coffee">
                      {fmt(item.price)}
                    </span>
                    {inCart > 0 ? (
                      <span className="animate-pop grid h-7 min-w-[28px] place-items-center rounded-full bg-coffee px-2 text-xs font-black tracking-wide text-cream shadow-xs">
                        ×{inCart}
                      </span>
                    ) : (
                      <span className="grid size-7 place-items-center rounded-full bg-coffee/90 text-sm font-bold leading-none text-cream shadow-xs">
                        +
                      </span>
                    )}
                  </div>
                  <div className="mt-2 min-w-0">
                    <span className="line-clamp-2 text-sm font-bold leading-snug text-ink sm:text-base">
                      {item.name}
                    </span>
                    {item.note && (
                      <span className="mt-0.5 block truncate text-xs font-medium text-coffee/70">
                        {item.note}
                      </span>
                    )}
                  </div>
                </button>
              ) : (
                <div
                  key={item.id}
                  className="flex min-h-[116px] cursor-not-allowed flex-col justify-between rounded-2xl border-2 border-dashed border-ink/20 bg-ink/5 p-4 text-left opacity-60"
                >
                  <span className="font-mono text-sm font-bold text-ink-soft">
                    {fmt(item.price)}
                  </span>
                  <div className="mt-2 min-w-0">
                    <span className="line-clamp-2 text-sm font-bold leading-snug text-ink-soft sm:text-base">
                      {item.name}
                    </span>
                    <span className="mt-1 inline-block rounded bg-tomato/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-tomato">
                      Out of stock
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">{cartPanel}</aside>
      </section>

      {/* Mobile/tablet portrait: bottom bar + sheet */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-paper/95 p-3 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="press flex w-full items-center justify-between rounded-2xl bg-coffee px-5 py-3.5 text-cream shadow-card transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-cream/15">
              <ShoppingCart className="size-4" />
            </span>
            <span className="font-bold">View order · {count}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold">{fmt(total)}</span>
            <span className="text-xs font-extrabold uppercase text-amber">Review →</span>
          </div>
        </button>
      </div>

      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-ink/50 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="safe-bottom max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-paper shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle for touch ergonomics */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-ink/20" />
            </div>
            <div className="p-3 pt-0">{cartPanel}</div>
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
