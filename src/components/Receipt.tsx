import { fmt, type Order } from "@/lib/pos-data";

export function ReceiptModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const date = new Date(order.createdAt);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-ink/15 bg-paper p-6 shadow-card-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div id="receipt-print">
          <div className="text-center">
            <div className="font-mono text-lg font-bold">MOCHA COUNTER</div>
            <div className="mt-1 font-mono text-xs text-ink-soft">Front of House · Till 01</div>
            <div className="mt-1 font-mono text-xs text-ink-soft">
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="mt-1 font-mono text-xs font-bold">Order {order.number}</div>
          </div>

          <div className="my-3 border-t border-dashed border-ink/30" />

          <div className="space-y-1.5">
            {order.lines.map((l, i) => (
              <div key={i} className="flex justify-between font-mono text-xs">
                <span>
                  {l.qty}× {l.name}
                </span>
                <span>{fmt(l.price * l.qty)}</span>
              </div>
            ))}
          </div>

          <div className="my-3 border-t border-dashed border-ink/30" />

          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{fmt(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (8%)</span>
              <span>{fmt(order.tax)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>TOTAL</span>
              <span>{fmt(order.total)}</span>
            </div>
            <div className="flex justify-between text-ink-soft">
              <span>Paid by</span>
              <span className="uppercase">{order.payment}</span>
            </div>
          </div>

          <div className="my-3 border-t border-dashed border-ink/30" />
          <div className="text-center font-mono text-xs text-ink-soft">Thank you — see you soon!</div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="press rounded-xl bg-coffee py-3 text-sm font-bold text-cream shadow-card"
          >
            Print receipt
          </button>
          <button
            onClick={onClose}
            className="press rounded-xl border border-ink/15 bg-cream py-3 text-sm font-bold text-ink"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
