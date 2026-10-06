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
      { title: "Billing — FUWA Japanese Fluffy Desserts" },
      {
        name: "description",
        content: "Touch-friendly tablet POS and billing for FUWA Japanese Fluffy Desserts.",
      },
      { property: "og:title", content: "Billing — FUWA Japanese Fluffy Desserts" },
      {
        property: "og:description",
        content: "Touch-friendly tablet POS and billing for FUWA Japanese Fluffy Desserts.",
      },
    ],
  }),
  component: BillingPage,
});

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

    if (profile && !profile.is_active) {
      toast.error("Your staff account is deactivated. You cannot submit orders.");
      return;
    }

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
    } catch (err: any) {
      const msg = err?.message || "Failed to complete order. Please try again.";
      toast.error(msg);
    }
  };

  const cartPanel = (
    <div className="overflow-hidden rounded-3xl border border-fuwa-brown/15 bg-fuwa-surface shadow-card-lg">
      <div className="flex items-center justify-between border-b-2 border-dashed border-fuwa-brown/15 bg-fuwa-cream/40 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-extrabold uppercase tracking-[0.15em] text-fuwa-brown/70">
            Order #A-{String(counter).padStart(3, "0")}
          </span>
          <span className="rounded-full bg-fuwa-orange px-2.5 py-0.5 text-[11px] font-black text-white shadow-xs">
            {count} {count === 1 ? "item" : "items"}
          </span>
        </div>
        {cartOpen && (
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="rounded-full p-1.5 text-fuwa-brown/70 hover:bg-fuwa-brown/10 lg:hidden"
            aria-label="Close cart"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <div className="max-h-[34vh] divide-y divide-dashed divide-fuwa-brown/10 overflow-y-auto px-5 sm:max-h-[38vh]">
        {cart.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-fuwa-cream/70 text-fuwa-orange shadow-xs">
              <Sparkles className="size-7 text-fuwa-orange" />
            </div>
            <div className="mt-3 text-base font-extrabold text-fuwa-brown">Your order is empty</div>
            <div className="mt-1 text-xs font-medium text-fuwa-brown/65">
              Choose something fluffy to get started.
            </div>
          </div>
        )}
        {cart.map((l) => {
          const item = menuMap.get(l.itemId);
          if (!item) return null;
          return (
            <div key={l.itemId} className="animate-pop flex items-center justify-between py-3.5">
              <div className="min-w-0 pr-3">
                <div className="truncate text-sm font-extrabold text-fuwa-brown">{item.name}</div>
                <div className="font-mono text-xs font-bold text-fuwa-brown/65">{fmt(item.price * l.qty)}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  aria-label={`Remove one ${item.name}`}
                  onClick={() => setQty(l.itemId, l.qty - 1)}
                  className="press grid size-10 place-items-center rounded-xl border border-fuwa-brown/20 bg-fuwa-cream text-lg font-black text-fuwa-brown transition-colors hover:bg-fuwa-cream/70"
                >
                  −
                </button>
                <span className="w-6 text-center font-mono text-sm font-black text-fuwa-brown">{l.qty}</span>
                <button
                  aria-label={`Add one ${item.name}`}
                  onClick={() => setQty(l.itemId, l.qty + 1)}
                  className="press grid size-10 place-items-center rounded-xl bg-fuwa-orange text-lg font-black text-white shadow-xs transition-colors hover:bg-fuwa-orange-bright"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Customer Info Section (Optional, with 10-digit phone validation) */}
      <div className="border-t-2 border-dashed border-fuwa-brown/15 bg-fuwa-cream/40 px-5 py-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-fuwa-brown/70">
            <User className="size-3.5 text-fuwa-orange" />
            <span>Customer Details</span>
            <span className="text-[10px] font-semibold text-fuwa-brown/50 lowercase">(optional)</span>
          </span>
          {(customerName || customerPhone) && (
            <button
              type="button"
              onClick={() => {
                setCustomerName("");
                setCustomerPhone("");
                setPhoneError(null);
              }}
              className="text-[11px] font-bold text-fuwa-brown/60 hover:text-red-700 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="space-y-2">
          {/* Customer Name */}
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fuwa-brown/50" />
            <input
              type="text"
              id="customer-name-input"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
              className="w-full rounded-xl border border-fuwa-brown/15 bg-fuwa-surface py-2 pl-9 pr-3 text-xs font-semibold text-fuwa-brown placeholder:text-fuwa-brown/40 shadow-2xs focus:border-fuwa-orange focus:outline-none focus:ring-2 focus:ring-fuwa-orange/20 transition-all"
            />
          </div>

          {/* Customer Phone */}
          <div>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fuwa-brown/50" />
              <input
                type="tel"
                id="customer-phone-input"
                inputMode="numeric"
                maxLength={10}
                value={customerPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="Phone number (10 digits)"
                className={`w-full rounded-xl border bg-fuwa-surface py-2 pl-9 pr-14 text-xs font-mono font-semibold text-fuwa-brown placeholder:text-fuwa-brown/40 shadow-2xs focus:outline-none transition-all ${
                  phoneError
                    ? "border-red-500 focus:ring-2 focus:ring-red-500/20"
                    : customerPhone.length === 10
                      ? "border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      : "border-fuwa-brown/15 focus:border-fuwa-orange focus:ring-2 focus:ring-fuwa-orange/20"
                }`}
              />
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                {customerPhone.length === 10 ? (
                  <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600">
                    <Check className="size-3.5 stroke-[2.5]" />
                    <span>10/10</span>
                  </span>
                ) : customerPhone.length > 0 ? (
                  <span className="font-mono text-[10px] font-bold text-fuwa-brown/50">
                    {customerPhone.length}/10
                  </span>
                ) : null}
              </div>
            </div>

            {phoneError && (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-red-600">
                <AlertCircle className="size-3 shrink-0" />
                <span>{phoneError}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t-2 border-dashed border-fuwa-brown/15 px-5 py-4">
        <div className="flex justify-between text-sm font-bold text-fuwa-brown/65">
          <span>Subtotal</span>
          <span className="font-mono text-fuwa-brown">{fmt(subtotal)}</span>
        </div>
        <div className="mt-3 flex items-end justify-between border-t border-dashed border-fuwa-brown/15 pt-2">
          <span className="text-lg font-black text-fuwa-brown">Grand Total</span>
          <span className="font-mono text-3xl font-black leading-none text-fuwa-orange">
            {fmt(total)}
          </span>
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
            className={`press flex flex-col items-center justify-center gap-1 rounded-xl border-2 min-h-[48px] py-2 text-xs font-extrabold uppercase tracking-wider transition-all ${
              payment === id
                ? "border-fuwa-orange bg-fuwa-orange text-white shadow-card"
                : "border-fuwa-brown/15 bg-fuwa-surface text-fuwa-brown/70 hover:border-fuwa-brown/30 hover:bg-fuwa-cream/50"
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
          className="press mt-3 flex w-full min-h-[54px] items-center justify-between rounded-2xl bg-fuwa-orange px-5 py-3.5 text-base font-black text-white shadow-card transition-all hover:bg-fuwa-orange-bright active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>{isSubmittingOrder ? "Saving order…" : "Complete Order"}</span>
          <span className="font-mono text-lg font-black">{fmt(total)}</span>
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
          className="mt-2 w-full rounded-xl py-2.5 text-xs font-bold text-fuwa-brown/60 transition-colors hover:text-red-700 hover:bg-red-50 disabled:opacity-40"
        >
          Cancel order
        </button>
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 pb-28 sm:px-6 sm:py-6 lg:pb-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-fuwa-brown sm:text-3xl">
                Fluffy Menu
              </h1>
              <p className="text-xs font-medium text-fuwa-brown/65 sm:text-sm">
                Tap any dessert or drink to add to current order
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-50 px-3.5 py-1.5 text-xs font-extrabold text-emerald-800 shadow-2xs">
              {menuLoading ? "Syncing menu…" : `${live} items live`}
            </span>
          </div>

          <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
            {categoryTabs.map((c) => {
              const active = cat === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  className={`press shrink-0 rounded-2xl min-h-[44px] px-5 py-2 text-sm font-extrabold transition-all duration-150 ${
                    active
                      ? "bg-fuwa-orange text-white shadow-card ring-2 ring-fuwa-orange/20"
                      : "border border-fuwa-brown/10 bg-fuwa-surface text-fuwa-brown hover:border-fuwa-orange/30 hover:bg-fuwa-orange/5"
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
                  className={`press relative flex min-h-[126px] flex-col justify-between rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-150 ${
                    inCart > 0
                      ? "border-fuwa-orange bg-fuwa-surface ring-2 ring-fuwa-orange/25 shadow-card-lg"
                      : "border-fuwa-brown/10 bg-fuwa-surface shadow-card hover:border-fuwa-orange/40 hover:shadow-card-lg"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-sm sm:text-base font-extrabold text-fuwa-orange">
                      {fmt(item.price)}
                    </span>
                    {inCart > 0 ? (
                      <span className="animate-pop grid h-7 min-w-[28px] place-items-center rounded-full bg-fuwa-orange px-2 text-xs font-black tracking-wide text-white shadow-xs">
                        ×{inCart}
                      </span>
                    ) : (
                      <span className="grid size-7 sm:size-8 place-items-center rounded-xl bg-fuwa-cream text-sm font-bold text-fuwa-brown transition-colors shadow-2xs">
                        +
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 min-w-0">
                    <span className="line-clamp-2 text-sm font-extrabold leading-snug text-fuwa-brown sm:text-base">
                      {item.name}
                    </span>
                    {item.note && (
                      <span className="mt-1 block line-clamp-2 text-[11px] sm:text-xs font-medium text-fuwa-brown/65 leading-tight">
                        {item.note}
                      </span>
                    )}
                  </div>
                </button>
              ) : (
                <div
                  key={item.id}
                  className="flex min-h-[126px] cursor-not-allowed flex-col justify-between rounded-2xl border-2 border-dashed border-fuwa-brown/15 bg-fuwa-brown/[0.03] p-3.5 sm:p-4 text-left opacity-60"
                >
                  <span className="font-mono text-sm font-bold text-fuwa-brown/50">
                    {fmt(item.price)}
                  </span>
                  <div className="mt-2.5 min-w-0">
                    <span className="line-clamp-2 text-sm font-bold leading-snug text-fuwa-brown/60 sm:text-base">
                      {item.name}
                    </span>
                    <span className="mt-2 inline-flex items-center rounded-md bg-fuwa-brown/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-fuwa-brown/70">
                      Out of stock
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">{cartPanel}</aside>
      </section>

      {/* Mobile/tablet portrait: persistent sticky bottom bar + sheet */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-fuwa-brown/10 bg-fuwa-surface/95 p-3 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="press flex w-full min-h-[50px] items-center justify-between rounded-2xl bg-fuwa-orange px-5 py-3 text-white shadow-card transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-xl bg-white/20">
              <ShoppingCart className="size-4" />
            </span>
            <span className="font-extrabold text-sm sm:text-base">View Order · {count}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base sm:text-lg font-black">{fmt(total)}</span>
            <span className="text-xs font-black uppercase text-white/90">Review →</span>
          </div>
        </button>
      </div>

      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-fuwa-brown/50 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="safe-bottom max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-fuwa-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle for touch ergonomics */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-fuwa-brown/20" />
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
