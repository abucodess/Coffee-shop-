import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  generateInvoiceWhatsAppMessage,
  generateReadyWhatsAppMessage,
  getWhatsAppShareUrl,
  normalizeWhatsAppPhone,
  simulateSendWhatsAppInvoice,
  simulateSendWhatsAppReady,
  getAllOrderMeta,
  saveOrderMeta,
  clearOrderMetaCache,
} from "@/lib/whatsapp";
import {
  markOrderReady,
  markOrderPreparing,
} from "@/lib/pos-store";
import { SHOP_INFO, type Order } from "@/lib/pos-data";
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
  whatsappInvoiceSent: false,
  isReady: false,
};

describe("Phone Number Normalization for WhatsApp", () => {
  it("normalizes standard 10-digit Indian numbers with country code 91", () => {
    const res = normalizeWhatsAppPhone("9876543210");
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe("919876543210");
    expect(res.displayFormatted).toBe("+91 9876543210");
  });

  it("handles existing +91 and 91 prefixes without duplicating country code", () => {
    const res1 = normalizeWhatsAppPhone("+91 98765 43210");
    expect(res1.isValid).toBe(true);
    expect(res1.normalized).toBe("919876543210");

    const res2 = normalizeWhatsAppPhone("919876543210");
    expect(res2.isValid).toBe(true);
    expect(res2.normalized).toBe("919876543210");
  });

  it("handles leading 0 prefix correctly", () => {
    const res = normalizeWhatsAppPhone("09876543210");
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe("919876543210");
  });

  it("strips parentheses, spaces, and hyphens", () => {
    const res = normalizeWhatsAppPhone("+91 (987) 654-3210");
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe("919876543210");
  });

  it("rejects invalid, short, or empty numbers without crashing", () => {
    expect(normalizeWhatsAppPhone("").isValid).toBe(false);
    expect(normalizeWhatsAppPhone(null).isValid).toBe(false);
    expect(normalizeWhatsAppPhone("12345").isValid).toBe(false);
    expect(normalizeWhatsAppPhone("abcdef").isValid).toBe(false);
  });
});

describe("WhatsApp Message Generation", () => {
  it("generates structured invoice message with items, total, and business details", () => {
    const msg = generateInvoiceWhatsAppMessage(sampleOrderWithCustomer);

    expect(msg).toContain("FUWA");
    expect(msg).toContain("Aarav Sharma");
    expect(msg).toContain("A-201");
    expect(msg).toContain("FUWA-2026-201");
    expect(msg).toContain("Original Fluffy Soufflé");
    expect(msg).toContain("₹920.00");
    expect(msg).toContain("UPI");
    expect(msg).toContain("+91 90480 37530");
  });

  it("generates joyful ready message with exact required copy and clickable Instagram link", () => {
    const msg = generateReadyWhatsAppMessage(sampleOrderWithCustomer);

    expect(msg).toContain("YOUR ORDER IS READY");
    expect(msg).toContain("A-201");
    expect(msg).toContain("Aarav Sharma");
    expect(msg).toContain("READY FOR PICKUP");
    expect(msg).toContain("pickup counter");
    expect(msg).toContain("Hello! Your FUWA order is ready for pickup. Thank you for choosing FUWA - Japanese Fluffy Desserts! 🍰");
    expect(msg).toContain("https://www.instagram.com/fuwa_.fluffy");
    expect(msg).toContain("+91 90480 37530");
  });

  it("builds valid wa.me share url with sanitized 10-digit phone", () => {
    const url = getWhatsAppShareUrl("9876543210", "Hello Fuwa");
    expect(url).toContain("https://wa.me/919876543210?text=Hello%20Fuwa");

    const urlWithPlus = getWhatsAppShareUrl("+91 98765 43210", "Ready!");
    expect(urlWithPlus).toContain("https://wa.me/919876543210");
  });
});

describe("Simulated WhatsApp Service, Idempotency & Duplicate Prevention", () => {
  beforeEach(() => {
    localStorage.clear();
    clearOrderMetaCache();
  });

  it("simulates sending invoice and creates persistent event record", async () => {
    const res = await simulateSendWhatsAppInvoice(sampleOrderWithCustomer);

    expect(res.success).toBe(true);
    expect(res.messageType).toBe("invoice");
    expect(res.phone).toBe("9876543210");
    expect(res.shareUrl).toContain("wa.me/919876543210");

    const meta = getAllOrderMeta();
    expect(meta[sampleOrderWithCustomer.id]?.whatsappInvoiceSent).toBe(true);
    expect(meta[sampleOrderWithCustomer.id]?.sendWhatsAppInvoice).toBe(true);
    expect(meta[sampleOrderWithCustomer.id]?.invoiceEvent?.status).toBe("sent");
  });

  it("prevents duplicate invoice sending on retry or re-render", async () => {
    const res1 = await simulateSendWhatsAppInvoice(sampleOrderWithCustomer);
    expect(res1.success).toBe(true);
    expect(res1.alreadySent).toBeUndefined();

    // Second call for same order
    const res2 = await simulateSendWhatsAppInvoice(sampleOrderWithCustomer);
    expect(res2.success).toBe(true);
    expect(res2.alreadySent).toBe(true);
  });

  it("simulates sending ready notification and creates persistent event record", async () => {
    const res = await simulateSendWhatsAppReady(sampleOrderWithCustomer);

    expect(res.success).toBe(true);
    expect(res.messageType).toBe("ready");
    expect(res.phone).toBe("9876543210");

    const meta = getAllOrderMeta();
    expect(meta[sampleOrderWithCustomer.id]?.isReady).toBe(true);
    expect(meta[sampleOrderWithCustomer.id]?.whatsappReadySent).toBe(true);
    expect(meta[sampleOrderWithCustomer.id]?.readyAt).toBeDefined();
    expect(meta[sampleOrderWithCustomer.id]?.readyEvent?.status).toBe("sent");
  });

  it("prevents duplicate ready notification on repeated calls", async () => {
    const res1 = await simulateSendWhatsAppReady(sampleOrderWithCustomer);
    expect(res1.success).toBe(true);
    expect(res1.alreadySent).toBeUndefined();

    const res2 = await simulateSendWhatsAppReady(sampleOrderWithCustomer);
    expect(res2.success).toBe(true);
    expect(res2.alreadySent).toBe(true);
  });

  it("gracefully handles invalid phone numbers without crashing", async () => {
    const orderWithBadPhone: Order = {
      ...sampleOrderWithCustomer,
      id: "bad-phone-order",
      customerPhone: "123",
    };

    const res = await simulateSendWhatsAppReady(orderWithBadPhone);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Invalid phone number/i);

    const meta = getAllOrderMeta();
    expect(meta["bad-phone-order"]?.readyEvent?.status).toBe("failed");
  });
});

describe("Kitchen Order Status Transitions & Idempotency", () => {
  beforeEach(() => {
    localStorage.clear();
    clearOrderMetaCache();
  });

  it("marks order as ready and can revert back to preparing", async () => {
    saveOrderMeta("test-order-99", { isReady: false });

    const readyRes = await markOrderReady("test-order-99", { notifyWhatsApp: true });
    expect(readyRes.success).toBe(true);
    expect(readyRes.wasAlreadyReady).toBe(false);

    let meta = getAllOrderMeta();
    expect(meta["test-order-99"]?.isReady).toBe(true);
    expect(meta["test-order-99"]?.readyAt).toBeDefined();

    await markOrderPreparing("test-order-99");
    meta = getAllOrderMeta();
    expect(meta["test-order-99"]?.isReady).toBe(false);
    expect(meta["test-order-99"]?.readyAt).toBeUndefined();
  });

  it("suppresses duplicate ready messages on Ready -> Ready transition", async () => {
    saveOrderMeta("test-order-rr", { isReady: true, whatsappReadySent: true });

    const res = await markOrderReady("test-order-rr", { notifyWhatsApp: true });
    expect(res.wasAlreadyReady).toBe(true);
    expect(res.notified).toBe(false);
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

describe("Centralized Business Info Integrity", () => {
  it("verifies SHOP_INFO matches official business credentials", () => {
    expect(SHOP_INFO.fullName).toBe("FUWA - Japanese Fluffy Desserts");
    expect(SHOP_INFO.fboName).toBe("ABIN K");
    expect(SHOP_INFO.businessType).toBe("Petty Retailer of Snacks/Tea Shops");
    expect(SHOP_INFO.fssai).toBe("21326223001036");
    expect(SHOP_INFO.phone).toBe("+91 90480 37530");
    expect(SHOP_INFO.landmark).toBe("Bypass, Jn Road");
    expect(SHOP_INFO.instagramUrl).toBe("https://www.instagram.com/fuwa_.fluffy");
    expect(SHOP_INFO.fullAddress).toContain("Karama City, Manathumangalam, Perinthalmanna, Kerala 679322");
  });
});
