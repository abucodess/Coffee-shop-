import { SHOP_INFO, fmt, type Order, type ShopInfo, type PaymentMethod } from "./pos-data";

export type MessageDeliveryStatus = "idle" | "queued" | "sent" | "failed";

export interface MessageEventRecord {
  id: string; // Idempotency key (e.g. `${orderId}-ready` or `${orderId}-invoice`)
  orderId: string;
  orderNumber: string;
  messageType: "invoice" | "ready";
  recipientPhone: string;
  normalizedPhone: string;
  status: MessageDeliveryStatus;
  attemptCount: number;
  lastAttemptAt: number;
  sentAt?: number;
  errorMessage?: string;
  contentSnapshot?: string;
  shareUrl?: string;
}

export interface OrderNotificationMeta {
  isReady?: boolean;
  readyAt?: number;
  sendWhatsAppInvoice?: boolean;
  whatsappInvoiceSent?: boolean;
  whatsappReadySent?: boolean;
  lastInvoiceMessage?: string;
  lastReadyMessage?: string;
  invoiceEvent?: MessageEventRecord;
  readyEvent?: MessageEventRecord;
  paymentMethod?: PaymentMethod;
}

const META_STORAGE_KEY = "fuwa-order-notifications-v1";

let cachedMeta: Record<string, OrderNotificationMeta> | null = null;

/**
 * Reads local order notification and ready statuses (cached in-memory for 0ms lookup)
 */
export function getAllOrderMeta(): Record<string, OrderNotificationMeta> {
  if (cachedMeta) return cachedMeta;
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    cachedMeta = raw ? JSON.parse(raw) : {};
    return cachedMeta!;
  } catch {
    cachedMeta = {};
    return cachedMeta;
  }
}

/**
 * Saves or updates metadata for a specific order ID and syncs memory cache
 */
export function saveOrderMeta(orderId: string, updates: Partial<OrderNotificationMeta>): void {
  const all = getAllOrderMeta();
  all[orderId] = {
    ...all[orderId],
    ...updates,
  };
  cachedMeta = all;

  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage full or unavailable */
  }
}

/**
 * Resets the in-memory metadata cache (useful for testing and store resets)
 */
export function clearOrderMetaCache(): void {
  cachedMeta = null;
}

export interface NormalizedPhoneResult {
  isValid: boolean;
  normalized: string; // E.g. "919876543210" without '+'
  displayFormatted: string; // E.g. "+91 9876543210"
  rawDigits: string; // 10-digit standard Indian mobile if applicable
  error?: string;
}

/**
 * Normalizes customer phone numbers to the official WhatsApp international format (e.g. 91XXXXXXXXXX).
 * Correctly handles +91 prefix, 91 prefix, leading 0, spaces, and dashes without doubling the country code.
 * Validates standard 10-digit Indian mobile numbers (starting with 6-9).
 * Does not guess country codes for ambiguous numbers.
 */
export function normalizeWhatsAppPhone(rawPhone?: string | null): NormalizedPhoneResult {
  if (!rawPhone || !rawPhone.trim()) {
    return {
      isValid: false,
      normalized: "",
      displayFormatted: "",
      rawDigits: "",
      error: "No phone number provided",
    };
  }

  // Remove common punctuation: spaces, dashes, parentheses, dots
  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, "");

  // If starts with +, strip it
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  // Clean non-digits
  const digitsOnly = cleaned.replace(/\D/g, "");

  // Scenario 1: Exactly 10 digits (Standard Indian mobile)
  if (digitsOnly.length === 10) {
    if (/^[6-9]\d{9}$/.test(digitsOnly)) {
      return {
        isValid: true,
        normalized: `91${digitsOnly}`,
        displayFormatted: `+91 ${digitsOnly}`,
        rawDigits: digitsOnly,
      };
    } else {
      return {
        isValid: false,
        normalized: "",
        displayFormatted: digitsOnly,
        rawDigits: digitsOnly,
        error: "Indian mobile numbers must start with 6, 7, 8, or 9",
      };
    }
  }

  // Scenario 2: 12 digits starting with country code 91
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    const mobilePart = digitsOnly.slice(2);
    if (/^[6-9]\d{9}$/.test(mobilePart)) {
      return {
        isValid: true,
        normalized: digitsOnly,
        displayFormatted: `+91 ${mobilePart}`,
        rawDigits: mobilePart,
      };
    } else {
      return {
        isValid: false,
        normalized: "",
        displayFormatted: digitsOnly,
        rawDigits: mobilePart,
        error: "Indian mobile numbers must start with 6, 7, 8, or 9",
      };
    }
  }

  // Scenario 3: 11 digits starting with 0 (e.g. 09876543210)
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    const mobilePart = digitsOnly.slice(1);
    if (/^[6-9]\d{9}$/.test(mobilePart)) {
      return {
        isValid: true,
        normalized: `91${mobilePart}`,
        displayFormatted: `+91 ${mobilePart}`,
        rawDigits: mobilePart,
      };
    } else {
      return {
        isValid: false,
        normalized: "",
        displayFormatted: digitsOnly,
        rawDigits: mobilePart,
        error: "Indian mobile numbers must start with 6, 7, 8, or 9",
      };
    }
  }

  return {
    isValid: false,
    normalized: "",
    displayFormatted: rawPhone.trim(),
    rawDigits: digitsOnly,
    error: `Invalid phone number: expected a 10-digit Indian mobile number (got ${digitsOnly.length} digits)`,
  };
}

/**
 * Formats a clean, professional WhatsApp invoice message
 */
export function generateInvoiceWhatsAppMessage(
  order: Order,
  shop: ShopInfo = SHOP_INFO,
): string {
  const customerGreeting = order.customerName
    ? `Hi ${order.customerName.trim()}! 👋`
    : "Hello! 👋";

  const date = new Date(order.createdAt);
  const dateStr = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const invoiceNum =
    order.invoiceNumber ||
    `FUWA-${date.getFullYear()}-${order.number.replace(/^A-/, "").padStart(3, "0")}`;

  const paymentDisplay =
    order.payment === "upi" ? "UPI" : order.payment === "card" ? "Card" : "Cash";

  const paymentStatus =
    order.status === "cancelled"
      ? "Cancelled"
      : order.payment === "cash"
        ? "To be collected"
        : "Paid";

  const itemsList = order.lines
    .map((l, idx) => `${idx + 1}. ${l.name} × ${l.qty} — ${fmt(l.price * l.qty)}`)
    .join("\n");

  const discountLine = order.discount
    ? `\n🏷️ *Discount Applied:* -${fmt(order.discount)}`
    : "";

  const shopPhone = shop.phone || "+91 90480 37530";

  return `🍰 *${shop.name} — ${shop.tagline}*
━━━━━━━━━━━━━━━━━━
${customerGreeting}
Thank you for ordering from *${shop.name}*! 💛
Your order has been received, and our team is preparing your delicious treats.

🧾 *ORDER RECEIPT*
*Order No.:* ${order.number}
*Invoice No.:* ${invoiceNum}
*Date:* ${dateStr}, ${timeStr}
*Payment:* ${paymentDisplay}
━━━━━━━━━━━━━━━━━━
📋 *ORDER SUMMARY*
${itemsList}${discountLine}
━━━━━━━━━━━━━━━━━━
💰 *GRAND TOTAL: ${fmt(order.total)}*
━━━━━━━━━━━━━━━━━━
👨‍🍳 *What's happening now?*
Your order is being freshly prepared. We'll send you a WhatsApp notification as soon as it's ready for pickup.

📍 *${shop.name}* | 📞 ${shopPhone}
Thank you for choosing ${shop.name}! 💛
*Freshly made, joyfully fluffy.* 🍰`;
}

/**
 * Formats a joyful WhatsApp notification when order is ready for pickup.
 * Follows the exact required copy and clickable Instagram URL with clean spacing.
 */
export function generateReadyWhatsAppMessage(
  order: Order,
  shop: ShopInfo = SHOP_INFO,
): string {
  const customerGreeting = order.customerName
    ? `Hi ${order.customerName.trim()}! 👋`
    : "Hello! 👋";
  const itemsList = order.lines
    .map((l) => `• ${l.name} × ${l.qty}`)
    .join("\n");
  const shopPhone = shop.phone || "+91 90480 37530";
  const instagramUrl = shop.instagramUrl || "https://www.instagram.com/fuwa_.fluffy";

  return `🎉 *YOUR ORDER IS READY!*
🍰 ${shop.name} — ${shop.tagline}
━━━━━━━━━━━━━━━━━━
Hello! Your FUWA order is ready for pickup. Thank you for choosing FUWA - Japanese Fluffy Desserts! 🍰
${customerGreeting}
Your fluffy treats are freshly prepared and READY FOR PICKUP! 🥞✨

🧾 Order No.: ${order.number}
📦 YOUR ORDER:
${itemsList}

📍 PICKUP REMINDER:
Please visit the ${shop.name} pickup counter and show your order number ${order.number} to collect your treats.

📸 FOLLOW US ON INSTAGRAM:
Follow us on Instagram for updates and more delicious treats: ${instagramUrl}

Thank you for choosing ${shop.name}! Enjoy every fluffy bite! 🥞✨
Team ${shop.name} | 📞 ${shopPhone}`;
}

/**
 * Builds a direct WhatsApp Web / App share link with properly normalized number
 */
export function getWhatsAppShareUrl(phone: string, text: string): string {
  const norm = normalizeWhatsAppPhone(phone);
  const targetPhone = norm.isValid ? norm.normalized : phone.replace(/\D/g, "");
  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
}

export interface SimulatedWhatsAppResult {
  success: boolean;
  orderId: string;
  orderNumber: string;
  phone: string;
  normalizedPhone?: string;
  customerName?: string;
  messageType: "invoice" | "ready";
  messageText: string;
  shareUrl: string;
  timestamp: number;
  alreadySent?: boolean;
  error?: string;
}

// In-flight mutex set to prevent concurrent double sends
const inFlightRequests = new Set<string>();

/**
 * Simulates sending an invoice to customer's WhatsApp number.
 * Idempotent: does not send duplicate messages on repeated requests or re-renders.
 */
export async function simulateSendWhatsAppInvoice(
  order: Order,
  options?: { forceResend?: boolean },
): Promise<SimulatedWhatsAppResult> {
  const phone = order.customerPhone || "";
  const lockKey = `${order.id}:invoice`;
  const allMeta = getAllOrderMeta();
  const existingMeta = allMeta[order.id];

  const phoneNorm = normalizeWhatsAppPhone(phone);
  if (!phoneNorm.isValid) {
    saveOrderMeta(order.id, {
      invoiceEvent: {
        id: `${order.id}-invoice`,
        orderId: order.id,
        orderNumber: order.number,
        messageType: "invoice",
        recipientPhone: phone,
        normalizedPhone: "",
        status: "failed",
        attemptCount: (existingMeta?.invoiceEvent?.attemptCount || 0) + 1,
        lastAttemptAt: Date.now(),
        errorMessage: phoneNorm.error || "Invalid phone number",
      },
    });

    return {
      success: false,
      orderId: order.id,
      orderNumber: order.number,
      phone,
      customerName: order.customerName,
      messageType: "invoice",
      messageText: "",
      shareUrl: "",
      timestamp: Date.now(),
      error: phoneNorm.error || "Invalid phone number",
    };
  }

  // Idempotency: prevent sending duplicate if already delivered
  if (
    !options?.forceResend &&
    (existingMeta?.whatsappInvoiceSent || existingMeta?.invoiceEvent?.status === "sent")
  ) {
    return {
      success: true,
      alreadySent: true,
      orderId: order.id,
      orderNumber: order.number,
      phone,
      normalizedPhone: phoneNorm.normalized,
      customerName: order.customerName,
      messageType: "invoice",
      messageText: existingMeta?.lastInvoiceMessage || generateInvoiceWhatsAppMessage(order),
      shareUrl: getWhatsAppShareUrl(phoneNorm.normalized, existingMeta?.lastInvoiceMessage || ""),
      timestamp: existingMeta?.invoiceEvent?.sentAt || Date.now(),
    };
  }

  // Mutex lock for concurrent clicks / re-renders
  if (inFlightRequests.has(lockKey)) {
    return {
      success: true,
      alreadySent: true,
      orderId: order.id,
      orderNumber: order.number,
      phone,
      normalizedPhone: phoneNorm.normalized,
      customerName: order.customerName,
      messageType: "invoice",
      messageText: "",
      shareUrl: "",
      timestamp: Date.now(),
    };
  }

  inFlightRequests.add(lockKey);
  const now = Date.now();
  const messageText = generateInvoiceWhatsAppMessage(order);
  const shareUrl = getWhatsAppShareUrl(phoneNorm.normalized, messageText);

  // Mark as queued
  saveOrderMeta(order.id, {
    invoiceEvent: {
      id: `${order.id}-invoice`,
      orderId: order.id,
      orderNumber: order.number,
      messageType: "invoice",
      recipientPhone: phone,
      normalizedPhone: phoneNorm.normalized,
      status: "queued",
      attemptCount: (existingMeta?.invoiceEvent?.attemptCount || 0) + 1,
      lastAttemptAt: now,
      contentSnapshot: messageText,
      shareUrl,
    },
  });

  try {
    // Persist sent status and event record
    saveOrderMeta(order.id, {
      sendWhatsAppInvoice: true,
      whatsappInvoiceSent: true,
      lastInvoiceMessage: messageText,
      invoiceEvent: {
        id: `${order.id}-invoice`,
        orderId: order.id,
        orderNumber: order.number,
        messageType: "invoice",
        recipientPhone: phone,
        normalizedPhone: phoneNorm.normalized,
        status: "sent",
        attemptCount: (existingMeta?.invoiceEvent?.attemptCount || 0) + 1,
        lastAttemptAt: now,
        sentAt: now,
        contentSnapshot: messageText,
        shareUrl,
      },
    });

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.number,
      phone,
      normalizedPhone: phoneNorm.normalized,
      customerName: order.customerName,
      messageType: "invoice",
      messageText,
      shareUrl,
      timestamp: now,
    };
  } catch (err: any) {
    saveOrderMeta(order.id, {
      invoiceEvent: {
        id: `${order.id}-invoice`,
        orderId: order.id,
        orderNumber: order.number,
        messageType: "invoice",
        recipientPhone: phone,
        normalizedPhone: phoneNorm.normalized,
        status: "failed",
        attemptCount: (existingMeta?.invoiceEvent?.attemptCount || 0) + 1,
        lastAttemptAt: now,
        errorMessage: err?.message || "WhatsApp send failed",
      },
    });

    return {
      success: false,
      orderId: order.id,
      orderNumber: order.number,
      phone,
      customerName: order.customerName,
      messageType: "invoice",
      messageText,
      shareUrl,
      timestamp: now,
      error: err?.message || "Failed to deliver WhatsApp message",
    };
  } finally {
    inFlightRequests.delete(lockKey);
  }
}

/**
 * Simulates sending an order ready notification to customer's WhatsApp number.
 * Idempotent: avoids duplicate notifications for the same order-ready event.
 */
export async function simulateSendWhatsAppReady(
  order: Order,
  options?: { forceResend?: boolean },
): Promise<SimulatedWhatsAppResult> {
  const phone = order.customerPhone || "";
  const lockKey = `${order.id}:ready`;
  const allMeta = getAllOrderMeta();
  const existingMeta = allMeta[order.id];

  const phoneNorm = normalizeWhatsAppPhone(phone);
  if (!phoneNorm.isValid) {
    saveOrderMeta(order.id, {
      isReady: true,
      readyAt: existingMeta?.readyAt || Date.now(),
      readyEvent: {
        id: `${order.id}-ready`,
        orderId: order.id,
        orderNumber: order.number,
        messageType: "ready",
        recipientPhone: phone,
        normalizedPhone: "",
        status: "failed",
        attemptCount: (existingMeta?.readyEvent?.attemptCount || 0) + 1,
        lastAttemptAt: Date.now(),
        errorMessage: phoneNorm.error || "Invalid phone number",
      },
    });

    return {
      success: false,
      orderId: order.id,
      orderNumber: order.number,
      phone,
      customerName: order.customerName,
      messageType: "ready",
      messageText: "",
      shareUrl: "",
      timestamp: Date.now(),
      error: phoneNorm.error || "Invalid phone number",
    };
  }

  // Idempotency check: don't resend if already sent
  if (
    !options?.forceResend &&
    (existingMeta?.whatsappReadySent || existingMeta?.readyEvent?.status === "sent")
  ) {
    return {
      success: true,
      alreadySent: true,
      orderId: order.id,
      orderNumber: order.number,
      phone,
      normalizedPhone: phoneNorm.normalized,
      customerName: order.customerName,
      messageType: "ready",
      messageText: existingMeta?.lastReadyMessage || generateReadyWhatsAppMessage(order),
      shareUrl: getWhatsAppShareUrl(phoneNorm.normalized, existingMeta?.lastReadyMessage || ""),
      timestamp: existingMeta?.readyEvent?.sentAt || Date.now(),
    };
  }

  // Mutex lock for concurrent clicks
  if (inFlightRequests.has(lockKey)) {
    return {
      success: true,
      alreadySent: true,
      orderId: order.id,
      orderNumber: order.number,
      phone,
      normalizedPhone: phoneNorm.normalized,
      customerName: order.customerName,
      messageType: "ready",
      messageText: "",
      shareUrl: "",
      timestamp: Date.now(),
    };
  }

  inFlightRequests.add(lockKey);
  const now = Date.now();
  const messageText = generateReadyWhatsAppMessage(order);
  const shareUrl = getWhatsAppShareUrl(phoneNorm.normalized, messageText);

  // Mark as queued
  saveOrderMeta(order.id, {
    isReady: true,
    readyAt: existingMeta?.readyAt || now,
    readyEvent: {
      id: `${order.id}-ready`,
      orderId: order.id,
      orderNumber: order.number,
      messageType: "ready",
      recipientPhone: phone,
      normalizedPhone: phoneNorm.normalized,
      status: "queued",
      attemptCount: (existingMeta?.readyEvent?.attemptCount || 0) + 1,
      lastAttemptAt: now,
      contentSnapshot: messageText,
      shareUrl,
    },
  });

  try {
    saveOrderMeta(order.id, {
      isReady: true,
      readyAt: existingMeta?.readyAt || now,
      whatsappReadySent: true,
      lastReadyMessage: messageText,
      readyEvent: {
        id: `${order.id}-ready`,
        orderId: order.id,
        orderNumber: order.number,
        messageType: "ready",
        recipientPhone: phone,
        normalizedPhone: phoneNorm.normalized,
        status: "sent",
        attemptCount: (existingMeta?.readyEvent?.attemptCount || 0) + 1,
        lastAttemptAt: now,
        sentAt: now,
        contentSnapshot: messageText,
        shareUrl,
      },
    });

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.number,
      phone,
      normalizedPhone: phoneNorm.normalized,
      customerName: order.customerName,
      messageType: "ready",
      messageText,
      shareUrl,
      timestamp: now,
    };
  } catch (err: any) {
    saveOrderMeta(order.id, {
      isReady: true,
      readyAt: existingMeta?.readyAt || now,
      readyEvent: {
        id: `${order.id}-ready`,
        orderId: order.id,
        orderNumber: order.number,
        messageType: "ready",
        recipientPhone: phone,
        normalizedPhone: phoneNorm.normalized,
        status: "failed",
        attemptCount: (existingMeta?.readyEvent?.attemptCount || 0) + 1,
        lastAttemptAt: now,
        errorMessage: err?.message || "WhatsApp send failed",
      },
    });

    return {
      success: false,
      orderId: order.id,
      orderNumber: order.number,
      phone,
      customerName: order.customerName,
      messageType: "ready",
      messageText,
      shareUrl,
      timestamp: now,
      error: err?.message || "Failed to deliver WhatsApp message",
    };
  } finally {
    inFlightRequests.delete(lockKey);
  }
}
