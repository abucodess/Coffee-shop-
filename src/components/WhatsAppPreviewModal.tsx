import { useState } from "react";
import { Check, CheckCheck, Copy, ExternalLink, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import {
  generateInvoiceWhatsAppMessage,
  generateReadyWhatsAppMessage,
  getWhatsAppShareUrl,
} from "@/lib/whatsapp";
import type { Order } from "@/lib/pos-data";

export interface WhatsAppPreviewModalProps {
  order: Order;
  type: "invoice" | "ready";
  onClose: () => void;
}

export function WhatsAppPreviewModal({ order, type, onClose }: WhatsAppPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const phone = order.customerPhone || "";
  const name = order.customerName?.trim() || "Customer";

  const messageText =
    type === "ready"
      ? generateReadyWhatsAppMessage(order)
      : generateInvoiceWhatsAppMessage(order);

  const shareUrl = getWhatsAppShareUrl(phone, messageText);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      toast.success("WhatsApp message copied to clipboard");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Failed to copy message");
    }
  };

  const handleOpenWhatsApp = () => {
    if (!phone) {
      toast.error("No phone number attached to this order");
      return;
    }
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="WhatsApp Message Preview"
      className="fixed inset-0 z-50 grid place-items-center bg-fuwa-brown/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md my-auto overflow-hidden rounded-3xl border border-fuwa-brown/15 bg-fuwa-surface shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header styled like WhatsApp Business Header */}
        <div className="flex items-center justify-between bg-emerald-700 px-5 py-3.5 text-white shadow-xs">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-white/15 text-white font-extrabold text-sm ring-2 ring-white/30">
              <MessageCircle className="size-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm leading-tight text-white">{name}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  {type === "ready" ? "Ready Alert" : "Invoice"}
                </span>
              </div>
              <div className="font-mono text-xs text-emerald-100/80">
                {phone ? `+91 ${phone}` : "No phone provided"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Simulated Chat Window */}
        <div className="bg-[#efeae2] p-4 sm:p-5 relative overflow-hidden">
          {/* Subtle chat background pattern effect */}
          <div className="text-center mb-3">
            <span className="inline-block rounded-lg bg-white/80 px-2.5 py-0.5 text-[11px] font-bold text-stone-600 shadow-2xs">
              TODAY · ORDER #{order.number}
            </span>
          </div>

          {/* Outgoing Message Bubble */}
          <div className="relative ml-auto max-w-[92%] rounded-2xl rounded-tr-none bg-[#d9fdd3] p-3.5 text-stone-900 shadow-xs ring-1 ring-emerald-600/10">
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-stone-800 break-words">
              {messageText}
            </pre>
            <div className="mt-2 flex items-center justify-end gap-1 text-[10px] font-medium text-stone-500">
              <span>
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <CheckCheck className="size-3.5 text-sky-600 stroke-[2.5]" />
            </div>
          </div>

          <div className="mt-3 text-center text-[11px] font-semibold text-stone-600">
            ✨ Simulated message ready for customer WhatsApp delivery
          </div>
        </div>

        {/* Modal Action Controls */}
        <div className="border-t border-fuwa-brown/10 bg-fuwa-surface p-4 sm:p-5 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={!phone}
              className="press flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ExternalLink className="size-3.5 shrink-0" />
              <span>Open in WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={copyToClipboard}
              className="press flex items-center justify-center gap-1.5 rounded-xl border border-fuwa-brown/15 bg-fuwa-cream px-4 py-2.5 text-xs font-bold text-fuwa-brown transition-all hover:bg-fuwa-cream/80 active:scale-[0.98]"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5 text-fuwa-brown/70" />
                  <span>Copy Text</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl py-2 text-center text-xs font-bold text-fuwa-brown/60 transition-colors hover:text-fuwa-brown hover:bg-fuwa-cream/50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
