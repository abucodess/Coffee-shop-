import { useState } from "react";
import { Printer } from "lucide-react";
import { fmt, SHOP_INFO, type Order } from "@/lib/pos-data";
import { numberToIndianWords } from "@/lib/amount-to-words";

export function ReceiptModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">("80mm");
  const date = new Date(order.createdAt);

  const formattedDate = date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
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
    order.payment === "upi" ? "UPI" : order.payment === "card" ? "Card" : "Cash";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-md my-auto max-h-[92vh] overflow-y-auto rounded-3xl border border-ink/15 bg-paper p-5 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Printer width selector & controls */}
        <div className="mb-4 flex items-center justify-between border-b border-dashed border-ink/15 pb-3 print:hidden">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
            <Printer className="size-3.5" />
            <span>Thermal Paper:</span>
          </div>
          <div className="flex rounded-lg border border-ink/15 bg-cream p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPaperWidth("80mm")}
              className={`rounded px-2.5 py-1 transition-colors ${
                paperWidth === "80mm" ? "bg-coffee text-cream" : "text-ink-soft hover:text-coffee"
              }`}
            >
              80mm
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth("58mm")}
              className={`rounded px-2.5 py-1 transition-colors ${
                paperWidth === "58mm" ? "bg-coffee text-cream" : "text-ink-soft hover:text-coffee"
              }`}
            >
              58mm
            </button>
          </div>
        </div>

        {/* Printable FUWA Japanese Fluffy Desserts Receipt */}
        <div
          id="receipt-print"
          className={`mx-auto bg-white p-3 font-mono text-fuwa-brown shadow-sm transition-all sm:p-4 rounded-lg border border-fuwa-brown/10 ${
            paperWidth === "58mm"
              ? "printer-58mm max-w-[270px] text-[11px]"
              : "printer-80mm max-w-[340px] text-xs"
          }`}
        >
          {/* Business Header */}
          <div className="text-center leading-tight">
            <div className="mb-2 flex justify-center">
              <img
                src="/logo-sm.png"
                srcSet="/logo-sm.png 128w, /logo-md.png 256w"
                sizes="48px"
                width="48"
                height="48"
                alt="FUWA Japanese Fluffy Desserts"
                className="size-12 object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
            <div className="text-lg font-black tracking-wider text-fuwa-orange">
              {SHOP_INFO.name}
            </div>
            <div className="mt-0.5 text-[10px] font-bold text-fuwa-brown/70 italic">
              {SHOP_INFO.tagline}
            </div>
            <div className="mt-1 text-[11px] text-fuwa-brown/80">
              {SHOP_INFO.addressLine1}, {SHOP_INFO.addressLine2}
            </div>
            <div className="text-[10px] text-fuwa-brown/60">
              PIN: {SHOP_INFO.pin} | Ph: {SHOP_INFO.phone}
            </div>
            {SHOP_INFO.isGstRegistered && SHOP_INFO.gstin && (
              <div className="mt-0.5 text-[11px] font-bold">GSTIN: {SHOP_INFO.gstin}</div>
            )}
            {SHOP_INFO.fssai && (
              <div className="text-[10px] text-fuwa-brown/60">FSSAI: {SHOP_INFO.fssai}</div>
            )}
          </div>

          <div className="my-2.5 border-t border-dashed border-fuwa-brown/30" />

          {/* Receipt Title & Metadata */}
          <div className="text-center">
            <div className="inline-block border border-fuwa-brown/40 px-2 py-0.5 text-[11px] font-bold tracking-widest uppercase text-fuwa-brown">
              TAX INVOICE / RECEIPT
            </div>
          </div>

          <div className="mt-2 space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-fuwa-brown/70">Invoice No:</span>
              <span className="font-bold">{invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fuwa-brown/70">Date:</span>
              <span>{formattedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fuwa-brown/70">Time:</span>
              <span>{formattedTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fuwa-brown/70">Order No:</span>
              <span className="font-bold">#{order.number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fuwa-brown/70">Cashier:</span>
              <span>{cashierName}</span>
            </div>
            {order.customerName && (
              <div className="flex justify-between">
                <span className="text-fuwa-brown/70">Customer:</span>
                <span className="font-bold">{order.customerName}</span>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex justify-between">
                <span className="text-fuwa-brown/70">Phone:</span>
                <span className="font-mono font-bold">{order.customerPhone}</span>
              </div>
            )}
          </div>

          <div className="my-2.5 border-t border-dashed border-fuwa-brown/30" />

          {/* Items Table */}
          <div>
            <div className="grid grid-cols-[1fr_26px_54px_62px] gap-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-fuwa-brown/70">
              <span>ITEM</span>
              <span className="text-center">QTY</span>
              <span className="text-right">RATE</span>
              <span className="text-right">TOTAL</span>
            </div>
            <div className="border-t border-dashed border-fuwa-brown/20 pt-1 space-y-1.5">
              {order.lines.map((l, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_26px_54px_62px] gap-1 items-start text-[11px]"
                >
                  <span className="truncate pr-1 font-bold text-fuwa-brown">{l.name}</span>
                  <span className="text-center font-bold">{l.qty}</span>
                  <span className="text-right font-medium">{fmt(l.price)}</span>
                  <span className="text-right font-bold">{fmt(l.price * l.qty)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="my-2.5 border-t border-dashed border-fuwa-brown/30" />

          {/* Financial Breakdown */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-medium">{fmt(order.subtotal)}</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount</span>
                <span>-{fmt(discount)}</span>
              </div>
            )}

            <div className="my-1.5 border-t-2 border-dashed border-fuwa-brown/40" />

            <div className="flex items-baseline justify-between text-sm font-extrabold text-fuwa-orange">
              <span>TOTAL</span>
              <span className="text-base font-black">{fmt(order.total)}</span>
            </div>

            <div className="my-1.5 border-t border-dashed border-fuwa-brown/30" />

            <div className="flex justify-between text-[11px]">
              <span className="text-fuwa-brown/70">Payment Mode:</span>
              <span className="font-bold uppercase tracking-wider">{paymentDisplay}</span>
            </div>

            <div className="mt-2 text-[10px] text-fuwa-brown/70 leading-tight">
              <span className="font-bold uppercase text-fuwa-brown">Amount in Words:</span>
              <div className="italic text-fuwa-brown font-sans mt-0.5">{amountInWords}</div>
            </div>
          </div>

          <div className="my-2.5 border-t border-dashed border-fuwa-brown/30" />

          {/* Footer note */}
          <div className="text-center text-[11px] text-fuwa-brown/80 leading-snug">
            <div className="font-bold">Thank you!</div>
            <div className="mt-0.5 text-fuwa-orange font-bold">Have a fluffy day :)</div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="mt-5 grid grid-cols-2 gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="press flex items-center justify-center gap-2 rounded-xl bg-fuwa-orange py-3 text-sm font-extrabold text-white shadow-card hover:bg-fuwa-orange-bright transition-colors"
          >
            <Printer className="size-4" />
            Print Bill
          </button>
          <button
            type="button"
            onClick={onClose}
            className="press rounded-xl border border-fuwa-brown/15 bg-fuwa-cream py-3 text-sm font-bold text-fuwa-brown hover:bg-fuwa-cream/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
