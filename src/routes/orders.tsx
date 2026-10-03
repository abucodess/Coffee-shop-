import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { fmt, type Order } from "@/lib/pos-data";
import { cancelOrder, usePos } from "@/lib/pos-store";
import { ReceiptModal } from "@/components/Receipt";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders — Mocha Counter POS" },
      { name: "description", content: "Order history, receipts and cancellations." },
      { property: "og:title", content: "Orders — Mocha Counter POS" },
      { property: "og:description", content: "Order history, receipts and cancellations." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const orders = usePos((s) => s.orders);
  const [filter, setFilter] = useState<"all" | "paid" | "cancelled">("all");
  const [receipt, setReceipt] = useState<Order | null>(null);
  const list = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Orders</h1>
        <div className="flex gap-1 rounded-xl border border-ink/15 bg-paper p-1">
          {(["all", "paid", "cancelled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-2 text-sm font-bold capitalize ${
                filter === f ? "bg-coffee text-cream" : "text-ink-soft"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((o) => {
          const time = new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={o.id} className="flex flex-col rounded-2xl border border-ink/10 bg-paper p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs font-bold text-ink-soft">
                    #{o.number} · {time} · {o.payment}
                  </div>
                  <div className="mt-1 text-sm font-bold">
                    {o.lines.map((l) => `${l.name} ×${l.qty}`).join(", ")}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`font-mono text-base font-bold ${o.status === "cancelled" ? "line-through text-ink-soft" : ""}`}>
                    {fmt(o.total)}
                  </div>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      o.status === "paid" ? "bg-mint/15 text-mint" : "bg-tomato/15 text-tomato"
                    }`}
                  >
                    {o.status === "paid" ? "Paid" : "Cancelled"}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setReceipt(o)}
                  className="press flex-1 rounded-lg border border-ink/15 bg-cream py-2 text-sm font-bold"
                >
                  Receipt
                </button>
                {o.status === "paid" && (
                  <button
                    onClick={() => {
                      if (confirm(`Cancel order ${o.number}?`)) {
                        cancelOrder(o.id);
                        toast(`Order ${o.number} cancelled`);
                      }
                    }}
                    className="rounded-lg px-3 py-2 text-sm font-bold text-tomato hover:bg-tomato/10"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {list.length === 0 && <p className="text-ink-soft">No orders yet.</p>}
      </div>

      {receipt && <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />}
    </main>
  );
}
