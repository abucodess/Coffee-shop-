import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  MapPin,
  Phone,
  Printer,
  Receipt,
  Share2,
  Sparkles,
  Store,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { fmt, SHOP_INFO, type Order } from "@/lib/pos-data";
import { numberToIndianWords } from "@/lib/amount-to-words";
import { fetchOrderByIdOrNumber } from "@/lib/pos-api";
import { usePos } from "@/lib/pos-store";

export const Route = createFileRoute("/invoice/$orderId")({
  head: () => ({
    meta: [
      { title: "Digital Invoice — FUWA Japanese Fluffy Desserts" },
      {
        name: "description",
        content: "View, download, and verify your official digital tax invoice and receipt from FUWA Japanese Fluffy Desserts.",
      },
      { property: "og:title", content: "Digital Invoice — FUWA Japanese Fluffy Desserts" },
      {
        property: "og:description",
        content: "View, download, and verify your official digital tax invoice and receipt from FUWA Japanese Fluffy Desserts.",
      },
    ],
  }),
  component: InvoiceRouteComponent,
});

function InvoiceRouteComponent() {
  const { orderId } = Route.useParams();
  const storeOrders = usePos((s) => s.orders);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadOrder() {
      setLoading(true);
      setError(null);

      // Check current in-memory store first
      const normalized = orderId.startsWith("A-") ? orderId : `A-${orderId}`;
      const inStore = storeOrders.find(
        (o) =>
          o.id === orderId ||
          o.number === orderId ||
          o.number === normalized ||
          o.invoiceNumber === orderId,
      );

      if (inStore) {
        if (!isCancelled) {
          setOrder(inStore);
          setLoading(false);
        }
        return;
      }

      try {
        const fetched = await fetchOrderByIdOrNumber(orderId);
        if (!isCancelled) {
          if (fetched) {
            setOrder(fetched);
          } else {
            setError("We could not find an invoice matching this order reference.");
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || "Failed to load digital invoice.");
          setLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      isCancelled = true;
    };
  }, [orderId, storeOrders]);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: `Invoice #${order?.number || ""} — FUWA`,
      text: `Digital invoice for Order #${order?.number || ""} at FUWA Japanese Fluffy Desserts`,
      url,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invoice link copied to clipboard!");
    } catch {
      toast.error("Failed to copy invoice link");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-fuwa-cream px-4 py-12 flex flex-col items-center justify-center text-fuwa-brown font-display">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative size-16">
            <div className="absolute inset-0 rounded-full border-4 border-fuwa-orange/20 animate-ping" />
            <div className="size-16 rounded-full border-4 border-fuwa-orange border-t-transparent animate-spin" />
          </div>
          <div className="text-lg font-black text-fuwa-brown">Loading your FUWA invoice…</div>
          <div className="text-xs font-semibold text-fuwa-brown/60">
            Fetching freshly prepared bill details
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-fuwa-cream px-4 py-12 flex flex-col items-center justify-center text-fuwa-brown font-display">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-fuwa-brown/15 bg-fuwa-surface p-6 sm:p-8 text-center shadow-card-lg">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-50 text-fuwa-orange">
            <Receipt className="size-8" />
          </div>
          <h1 className="mt-4 text-xl font-black text-fuwa-brown">Invoice Not Found</h1>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-fuwa-brown/65">
            {error || "The requested invoice could not be located or has expired."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/"
              className="press flex items-center justify-center gap-2 rounded-xl bg-fuwa-orange px-4 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-fuwa-orange-bright transition-all"
            >
              <Store className="size-4" />
              <span>Go to FUWA Store</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const date = new Date(order.createdAt);
  const formattedDate = date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const invoiceNumber =
    order.invoiceNumber ||
    `FUWA-${date.getFullYear()}-${order.number.replace(/^A-/, "").padStart(3, "0")}`;

  const discount = order.discount || 0;
  const amountInWords = numberToIndianWords(order.total);
  const cashierName = order.cashier || SHOP_INFO.cashierName;
  const paymentDisplay =
    order.payment === "upi" ? "UPI" : order.payment === "card" ? "Credit / Debit Card" : "Cash";

  return (
    <div className="min-h-screen bg-fuwa-cream/80 text-fuwa-brown font-display py-4 sm:py-8 px-3 sm:px-6">
      {/* Top Floating Action Bar (Hidden in Print) */}
      <header className="mx-auto max-w-2xl mb-4 sm:mb-6 flex items-center justify-between gap-2 print:hidden">
        <Link
          to="/"
          id="invoice-back-button"
          className="press inline-flex items-center gap-1.5 rounded-xl border border-fuwa-brown/15 bg-fuwa-surface px-3 py-2 text-xs font-extrabold text-fuwa-brown shadow-xs hover:bg-fuwa-cream/70 transition-all"
        >
          <ArrowLeft className="size-3.5" />
          <span>FUWA Store</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="invoice-share-button"
            onClick={handleShare}
            className="press inline-flex items-center gap-1.5 rounded-xl border border-fuwa-brown/15 bg-fuwa-surface px-3 py-2 text-xs font-extrabold text-fuwa-brown shadow-xs hover:bg-fuwa-cream/70 transition-all"
          >
            <Share2 className="size-3.5 text-fuwa-orange" />
            <span>Share</span>
          </button>

          <button
            type="button"
            id="invoice-print-button"
            onClick={handlePrint}
            className="press inline-flex items-center gap-1.5 rounded-xl bg-fuwa-orange px-3.5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-fuwa-orange-bright transition-all"
          >
            <Printer className="size-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </header>

      {/* Main Digital Tax Invoice Card */}
      <main
        id="digital-invoice-container"
        className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-fuwa-brown/15 bg-fuwa-surface shadow-card-lg print:shadow-none print:border-none print:rounded-none"
      >
        {/* Brand Banner */}
        <div className="relative border-b-2 border-dashed border-fuwa-brown/15 bg-gradient-to-b from-fuwa-cream/60 to-fuwa-surface p-5 sm:p-7 text-center">
          <div className="mx-auto flex justify-center mb-2.5">
            <div className="grid size-14 place-items-center rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-fuwa-orange/30">
              <img
                src="/logo-sm.png"
                srcSet="/logo-sm.png 128w, /logo-md.png 256w"
                sizes="56px"
                width="56"
                height="56"
                alt="FUWA Japanese Fluffy Desserts"
                className="size-full object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-fuwa-orange">
              {SHOP_INFO.name}
            </h1>
            <span className="text-xs font-extrabold uppercase tracking-widest text-fuwa-orange bg-fuwa-orange/10 px-2 py-0.5 rounded-full">
              ふわふわ
            </span>
          </div>
          <p className="mt-0.5 text-xs font-bold text-fuwa-brown/70 italic">
            {SHOP_INFO.tagline}
          </p>

          <div className="mt-2 text-xs text-fuwa-brown/75 leading-relaxed max-w-md mx-auto">
            <div>
              {SHOP_INFO.addressLine1}, {SHOP_INFO.addressLine2}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-3 text-[11px] text-fuwa-brown/65">
              <span>PIN: {SHOP_INFO.pin}</span>
              <span>•</span>
              <a
                href={`tel:${SHOP_INFO.phone.replace(/\s+/g, "")}`}
                className="hover:underline font-semibold"
              >
                Ph: {SHOP_INFO.phone}
              </a>
              {SHOP_INFO.isGstRegistered && SHOP_INFO.gstin && (
                <>
                  <span>•</span>
                  <span className="font-mono">GSTIN: {SHOP_INFO.gstin}</span>
                </>
              )}
            </div>
          </div>

          {/* Kitchen Readiness / Order Status Banner */}
          <div className="mt-4 flex justify-center print:hidden">
            {order.status === "cancelled" ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3.5 py-1 text-xs font-extrabold text-red-800 border border-red-500/20">
                <XCircle className="size-3.5 text-red-600" />
                <span>Order Cancelled</span>
              </div>
            ) : order.isReady ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-black text-emerald-800 border border-emerald-500/25 shadow-2xs">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span>Ready for Pickup at Counter! 🥞✨</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/90 px-3.5 py-1 text-xs font-extrabold text-amber-900 border border-amber-500/30">
                <Clock className="size-3.5 text-amber-700 animate-pulse" />
                <span>Freshly Preparing in Kitchen</span>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Metadata Header Grid */}
        <section
          aria-label="Invoice Details"
          className="border-b border-fuwa-brown/10 bg-fuwa-cream/20 p-4 sm:p-6"
        >
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-fuwa-brown/10">
            <span className="inline-block rounded-md bg-fuwa-brown/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-fuwa-brown">
              TAX INVOICE & CASH RECEIPT
            </span>
            <span className="font-mono text-xs font-black text-fuwa-orange">
              Order #{order.number}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-fuwa-brown/55">
                Invoice No.
              </div>
              <div className="font-mono font-bold text-fuwa-brown break-all">{invoiceNumber}</div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-fuwa-brown/55">
                Date & Time
              </div>
              <div className="font-medium text-fuwa-brown">
                {formattedDate}, {formattedTime}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-fuwa-brown/55">
                Payment Mode
              </div>
              <div className="font-extrabold text-fuwa-brown uppercase tracking-wide">
                {paymentDisplay}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-fuwa-brown/55">
                Cashier
              </div>
              <div className="font-medium text-fuwa-brown">{cashierName}</div>
            </div>
          </div>

          {(order.customerName || order.customerPhone) && (
            <div className="mt-3 pt-3 border-t border-dashed border-fuwa-brown/10 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-fuwa-brown/55">
                Billed To:
              </span>
              {order.customerName && (
                <span className="font-bold text-fuwa-brown inline-flex items-center gap-1">
                  <User className="size-3 text-fuwa-orange" />
                  <span>{order.customerName}</span>
                </span>
              )}
              {order.customerPhone && (
                <span className="font-mono text-fuwa-brown/70 inline-flex items-center gap-1">
                  <Phone className="size-3 text-fuwa-brown/50" />
                  <span>+91 {order.customerPhone}</span>
                </span>
              )}
            </div>
          )}
        </section>

        {/* Itemized Order Table with Category Small Text */}
        <section aria-label="Order Items" className="p-4 sm:p-6">
          <div className="grid grid-cols-[1fr_40px_70px_85px] sm:grid-cols-[1fr_60px_90px_100px] gap-2 pb-2 text-[11px] font-black uppercase tracking-wider text-fuwa-brown/70 border-b border-fuwa-brown/20">
            <span>Item & Category</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Total</span>
          </div>

          <div className="divide-y divide-dashed divide-fuwa-brown/10 py-1">
            {order.lines.map((l, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_40px_70px_85px] sm:grid-cols-[1fr_60px_90px_100px] gap-2 py-3 items-center text-xs"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-extrabold text-fuwa-brown text-sm leading-tight">
                    {l.name}
                  </div>
                  {/* Category Name as Small Styled Badge / Text */}
                  {l.category && (
                    <div className="mt-0.5">
                      <span className="inline-block rounded-md bg-fuwa-orange/10 px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-fuwa-orange">
                        {l.category}
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-center font-mono font-bold text-fuwa-brown">{l.qty}</div>
                <div className="text-right font-mono text-fuwa-brown/70">{fmt(l.price)}</div>
                <div className="text-right font-mono font-black text-fuwa-brown">
                  {fmt(l.price * l.qty)}
                </div>
              </div>
            ))}
          </div>

          {/* Subtotal, Discount & Grand Total Breakdown */}
          <div className="mt-4 border-t-2 border-dashed border-fuwa-brown/15 pt-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-fuwa-brown/75">
              <span>Subtotal</span>
              <span className="font-mono font-semibold">{fmt(order.subtotal)}</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-red-700 font-semibold">
                <span>Discount Applied</span>
                <span className="font-mono">-{fmt(discount)}</span>
              </div>
            )}

            <div className="flex justify-between text-fuwa-brown/75">
              <span>Taxes (GST 0%)</span>
              <span className="font-mono">₹0.00</span>
            </div>

            <div className="my-2 border-t-2 border-fuwa-brown/20" />

            <div className="flex items-baseline justify-between text-fuwa-brown">
              <div>
                <div className="text-base sm:text-lg font-black tracking-tight text-fuwa-orange">
                  GRAND TOTAL
                </div>
                <div className="text-[10px] font-bold text-fuwa-brown/50">
                  (Inclusive of all taxes)
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-fuwa-orange">
                {fmt(order.total)}
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-fuwa-cream/40 p-2.5 text-[11px] text-fuwa-brown/75">
              <span className="font-bold uppercase tracking-wider text-fuwa-brown text-[10px]">
                Amount in Words:
              </span>
              <div className="font-semibold italic text-fuwa-brown/90 mt-0.5">
                {amountInWords}
              </div>
            </div>
          </div>
        </section>

        {/* Footer Notes & Thank you */}
        <footer className="border-t-2 border-dashed border-fuwa-brown/15 bg-fuwa-cream/30 p-5 text-center">
          <div className="text-xs font-black tracking-wider uppercase text-fuwa-orange flex items-center justify-center gap-1.5">
            <Sparkles className="size-3.5" />
            <span>Thank You For Dining With Us!</span>
            <Sparkles className="size-3.5" />
          </div>
          <p className="mt-1 text-[11px] text-fuwa-brown/70">
            Handcrafted Japanese soufflé desserts prepared freshly upon order.
          </p>
          <div className="mt-3 text-[10px] text-fuwa-brown/40 font-mono">
            Generated digitally by FUWA Cloud POS System · {invoiceNumber}
          </div>
        </footer>
      </main>
    </div>
  );
}
