import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Clock,
  CreditCard,
  Loader2,
  Phone,
  QrCode,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import { fmt, type Order } from "@/lib/pos-data";

const CANCELLATION_REASONS = [
  "Customer changed mind",
  "Incorrect item entered",
  "Payment failure / duplicate",
  "Out of stock / kitchen issue",
  "Customer left without payment",
] as const;

interface CancelOrderModalProps {
  order: Order;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
  isCancelling?: boolean;
}

export function CancelOrderModal({
  order,
  onClose,
  onConfirm,
  isCancelling = false,
}: CancelOrderModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");

  // Dismiss on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCancelling) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCancelling, onClose]);

  const time = new Date(order.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const totalItemsCount = order.lines.reduce((sum, line) => sum + line.qty, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCancelling) return;
    const finalReason = customReason.trim() || selectedReason || "Order cancelled by staff";
    await onConfirm(finalReason);
  };

  const getPaymentIcon = () => {
    switch (order.payment) {
      case "card":
        return <CreditCard className="size-3.5" />;
      case "upi":
        return <QrCode className="size-3.5" />;
      case "cash":
      default:
        return <Banknote className="size-3.5" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={() => {
        if (!isCancelling) onClose();
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-ink/15 bg-paper p-6 shadow-card-lg animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-tomato/10 text-tomato ring-6 ring-tomato/5">
              <AlertTriangle className="size-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight text-coffee">
                  Cancel Order
                </h2>
                <span className="font-mono text-sm font-bold text-ink-soft">
                  #{order.number}
                </span>
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                Confirm order cancellation and void this transaction.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isCancelling}
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-ink-soft hover:bg-ink/5 hover:text-coffee transition-colors disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Order Details Preview Card */}
        <div className="mt-5 rounded-2xl border border-ink/10 bg-cream/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-ink/10 pb-2.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold text-ink-soft">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {time}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <User className="size-3" />
                  {order.cashier || "Cashier"}
                </span>
              </div>
              <div className="text-[11px] font-bold text-ink-soft">
                {totalItemsCount} {totalItemsCount === 1 ? "item" : "items"}
              </div>
              {(order.customerName || order.customerPhone) && (
                <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-coffee">
                  <User className="size-3 text-ink-soft/70" />
                  <span>{order.customerName || "Customer"}</span>
                  {order.customerPhone && (
                    <span className="font-mono text-[11px] text-ink-soft">
                      ({order.customerPhone})
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="text-right">
              <div className="font-mono text-xl font-extrabold text-coffee">
                {fmt(order.total)}
              </div>
              <div className="inline-flex items-center gap-1 rounded-md bg-paper px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-soft border border-ink/10 mt-0.5">
                {getPaymentIcon()}
                <span>{order.payment}</span>
              </div>
            </div>
          </div>

          {/* Itemized Line Items (Compact & Scrollable) */}
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-ink/5">
            {order.lines.map((line, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs pt-1.5 first:pt-0"
              >
                <div className="min-w-0 flex-1 truncate pr-2 font-medium text-ink">
                  <span className="font-mono font-bold text-ink-soft mr-1.5">
                    {line.qty}×
                  </span>
                  {line.name}
                </div>
                <div className="shrink-0 font-mono text-xs font-bold text-ink-soft">
                  {fmt(line.price * line.qty)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reason Selection */}
        <div className="mt-4">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-soft mb-2">
            Cancellation Reason <span className="font-normal lowercase">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CANCELLATION_REASONS.map((reason) => {
              const isSelected = selectedReason === reason;
              return (
                <button
                  type="button"
                  key={reason}
                  disabled={isCancelling}
                  onClick={() => {
                    setSelectedReason(isSelected ? "" : reason);
                    setCustomReason("");
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-coffee text-cream shadow-xs"
                      : "border border-ink/10 bg-cream/70 text-ink-soft hover:bg-cream hover:text-coffee"
                  }`}
                >
                  {reason}
                </button>
              );
            })}
          </div>

          <input
            type="text"
            disabled={isCancelling}
            value={customReason}
            onChange={(e) => {
              setCustomReason(e.target.value);
              if (e.target.value) setSelectedReason("");
            }}
            placeholder="Or type a custom note..."
            className="mt-2.5 w-full rounded-xl border border-ink/15 bg-cream/50 px-3 py-2 text-xs font-medium text-ink placeholder:text-ink-soft/60 outline-none focus:border-amber focus:bg-paper transition-all"
          />
        </div>

        {/* Warning Callout */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-tomato/20 bg-tomato/10 p-3 text-xs text-tomato">
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
          <p className="leading-snug">
            <strong>Warning:</strong> This order will be permanently flagged as Cancelled.
            Receipts and daily register totals will reflect this void.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isCancelling}
            onClick={onClose}
            className="press rounded-xl border border-ink/20 bg-paper px-4 py-2.5 text-sm font-bold text-ink-soft hover:bg-ink/5 hover:text-coffee disabled:opacity-40 transition-colors"
          >
            Keep Order
          </button>
          <button
            type="button"
            disabled={isCancelling}
            onClick={handleSubmit}
            className="press flex items-center justify-center gap-2 rounded-xl bg-tomato px-5 py-2.5 text-sm font-extrabold text-white shadow-md shadow-tomato/20 hover:bg-tomato/90 active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {isCancelling ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Cancelling…</span>
              </>
            ) : (
              <span>Yes, Cancel Order</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
