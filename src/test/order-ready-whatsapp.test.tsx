import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  generateInvoiceWhatsAppMessage,
  generateReadyWhatsAppMessage,
  getWhatsAppShareUrl,
  simulateSendWhatsAppInvoice,
  simulateSendWhatsAppReady,
  getAllOrderMeta,
  saveOrderMeta,
} from "@/lib/whatsapp";
import {
  markOrderReady,
  markOrderPreparing,
  completeOrder,
  usePos,
} from "@/lib/pos-store";
import type { Order } from "@/lib/pos-data";
import { WhatsAppPreviewModal } from "@/components/WhatsAppPreviewModal";

const sampleOrderWithCustomer: Order = {
  id: "order-test-wa-1",
  number: "A-201",
  invoiceNumber: "FUWA-2026-201",
  createdAt: new Date("2026-10-14T10:00:00Z").getTime(),
  lines: [
    { name: "Original Fluffy Soufflé", price: 320, qty: 2 },
    { name: "Iced Ceremonial Matcha Latte", price: 280, qty: 1 },
  ],
  subtotal: 920,
  tax: 0,
  total: 920,
  payment: "upi",
  status: "paid",
  cashier: "Staff 01",
  customerName: "Aarav Sharma",
  customerPhone: "9876543210",
  sendWhatsAppInvoice: true,
  whatsappInvoiceSent: true,
  isReady: false,
};

describe("WhatsApp Message Generation", () => {
  it("generates structured invoice message with digital invoice link, total, and order reference", () => {
    const msg = generateInvoiceWhatsAppMessage(sampleOrderWithCustomer);

    expect(msg).toContain("FUWA");
    expect(msg).toContain("Aarav Sharma");
    expect(msg).toContain("A-201");
    expect(msg).toContain("FUWA-2026-201");
    expect(msg).toContain("/invoice/order-test-wa-1");
    expect(msg).toContain("₹920.00");
    expect(msg).toContain("UPI");
  });

  it("generates cheerful ready message when order is prepared", () => {
    const msg = generateReadyWhatsAppMessage(sampleOrderWithCustomer);

    expect(msg).toContain("YOUR ORDER IS READY");
    expect(msg).toContain("A-201");
    expect(msg).toContain("Aarav Sharma");
    expect(msg).toContain("READY FOR PICKUP");
    expect(msg).toContain("pickup counter");
  });

  it("builds valid wa.me share url with sanitized 10-digit phone", () => {
    const url = getWhatsAppShareUrl("9876543210", "Hello Fuwa");
    expect(url).toContain("https://wa.me/919876543210?text=Hello%20Fuwa");

    const urlWithPlus = getWhatsAppShareUrl("+91 98765 43210", "Ready!");
    expect(urlWithPlus).toContain("https://wa.me/919876543210");
  });
});

describe("Simulated WhatsApp Service & Metadata", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("simulates sending invoice and updates local order metadata", async () => {
    const res = await simulateSendWhatsAppInvoice(sampleOrderWithCustomer);

    expect(res.success).toBe(true);
    expect(res.messageType).toBe("invoice");
    expect(res.phone).toBe("9876543210");
    expect(res.shareUrl).toContain("wa.me/919876543210");

    const meta = getAllOrderMeta();
    expect(meta[sampleOrderWithCustomer.id]?.whatsappInvoiceSent).toBe(true);
    expect(meta[sampleOrderWithCustomer.id]?.sendWhatsAppInvoice).toBe(true);
  });

  it("simulates sending ready notification and marks isReady", async () => {
    const res = await simulateSendWhatsAppReady(sampleOrderWithCustomer);

    expect(res.success).toBe(true);
    expect(res.messageType).toBe("ready");
    expect(res.phone).toBe("9876543210");

    const meta = getAllOrderMeta();
    expect(meta[sampleOrderWithCustomer.id]?.isReady).toBe(true);
    expect(meta[sampleOrderWithCustomer.id]?.whatsappReadySent).toBe(true);
    expect(meta[sampleOrderWithCustomer.id]?.readyAt).toBeDefined();
  });
});

describe("Kitchen Order Status Transitions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("marks order as ready and can revert back to preparing", async () => {
    // Save sample order into store state
    saveOrderMeta("test-order-99", { isReady: false });

    await markOrderReady("test-order-99", { notifyWhatsApp: true });
    let meta = getAllOrderMeta();
    expect(meta["test-order-99"]?.isReady).toBe(true);
    expect(meta["test-order-99"]?.readyAt).toBeDefined();

    await markOrderPreparing("test-order-99");
    meta = getAllOrderMeta();
    expect(meta["test-order-99"]?.isReady).toBe(false);
    expect(meta["test-order-99"]?.readyAt).toBeUndefined();
  });
});

describe("WhatsAppPreviewModal Component", () => {
  it("renders WhatsApp preview chat bubble and action buttons", () => {
    const onClose = vi.fn();
    render(
      <WhatsAppPreviewModal
        order={sampleOrderWithCustomer}
        type="ready"
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Aarav Sharma")).toBeInTheDocument();
    expect(screen.getByText("+91 9876543210")).toBeInTheDocument();
    expect(screen.getByText(/READY FOR PICKUP/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open in whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy text/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Historical vs Today's Orders Filtering", () => {
  it("correctly identifies orders placed today vs historical (older than 1 day)", async () => {
    const { isOrderToday } = await import("@/lib/pos-data");
    const now = Date.now();
    const twoHoursAgo = now - 2 * 3600 * 1000;
    const yesterday = now - 26 * 3600 * 1000;
    const threeDaysAgo = now - 3 * 24 * 3600 * 1000;

    expect(isOrderToday(now)).toBe(true);
    expect(isOrderToday(twoHoursAgo)).toBe(true);
    expect(isOrderToday(yesterday)).toBe(false);
    expect(isOrderToday(threeDaysAgo)).toBe(false);
  });
});

