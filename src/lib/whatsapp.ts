import { SHOP_INFO, fmt, type Order, type ShopInfo } from "./pos-data";

export interface OrderNotificationMeta {
  isReady?: boolean;
  readyAt?: number;
  sendWhatsAppInvoice?: boolean;
  whatsappInvoiceSent?: boolean;
  whatsappReadySent?: boolean;
  lastInvoiceMessage?: string;
  lastReadyMessage?: string;
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
 * Formats a clean, professional WhatsApp invoice message
 */
export function generateInvoiceWhatsAppMessage(
  order: Order,
  shop: ShopInfo = SHOP_INFO,
): string {
  const customerGreeting = order.customerName ? `Hi ${order.customerName.trim()}!` : "Hello!";
  const dateStr = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = new Date(order.createdAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const invoiceNum =
    order.invoiceNumber ||
    `FUWA-${new Date(order.createdAt).getFullYear()}-${order.number.replace(/^A-/, "").padStart(3, "0")}`;

  const itemsList = order.lines
    .map((l) => `  • ${l.qty}x ${l.name} — ${fmt(l.price * l.qty)}`)
    .join("\n");

  return `🍰 *${shop.name}* — ${shop.tagline}
------------------------------------
${customerGreeting} Thank you for your order at ${shop.name}!

🧾 *Order Details:*
• *Order #:* ${order.number}
• *Invoice #:* ${invoiceNum}
• *Date & Time:* ${dateStr}, ${timeStr}
• *Payment Mode:* ${(order.payment || "cash").toUpperCase()}

📋 *Items Ordered:*
${itemsList}

💰 *Grand Total:* *${fmt(order.total)}*
${order.discount ? `🏷️ *Discount Applied:* ${fmt(order.discount)}\n` : ""}------------------------------------
✨ Our team is freshly preparing your fluffy order.
📲 We will notify you here as soon as your order is ready for pickup!

📍 ${shop.addressLine1}, ${shop.addressLine2}
📞 Ph: ${shop.phone}`;
}

/**
 * Formats a joyful WhatsApp notification when order is ready for pickup
 */
export function generateReadyWhatsAppMessage(
  order: Order,
  shop: ShopInfo = SHOP_INFO,
): string {
  const customerGreeting = order.customerName ? `Hi ${order.customerName.trim()}!` : "Hello!";
  const itemsSummary = order.lines.map((l) => `${l.qty}x ${l.name}`).join(", ");

  return `🎉 *YOUR ORDER IS READY!* — ${shop.name}
------------------------------------
${customerGreeting} Great news! Your order *#${order.number}* is freshly prepared and *READY FOR PICKUP*! 🥞✨

📦 *Your Items:*
${itemsSummary}

📍 Please head to the pickup counter with Order *#${order.number}*.

Thank you for your patience and enjoy your fluffy treats! ☕
— Team ${shop.name}`;
}

/**
 * Builds a direct WhatsApp Web / App share link
 */
export function getWhatsAppShareUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const formattedPhone = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
}

export interface SimulatedWhatsAppResult {
  success: boolean;
  orderId: string;
  orderNumber: string;
  phone: string;
  customerName?: string;
  messageType: "invoice" | "ready";
  messageText: string;
  shareUrl: string;
  timestamp: number;
}

/**
 * Simulates sending an invoice to customer's WhatsApp number.
 * Returns payload ready for instant UI feedback or opening direct chat.
 */
export async function simulateSendWhatsAppInvoice(
  order: Order,
): Promise<SimulatedWhatsAppResult> {
  const phone = order.customerPhone || "";
  const messageText = generateInvoiceWhatsAppMessage(order);
  const shareUrl = getWhatsAppShareUrl(phone, messageText);

  // Persist sent status
  saveOrderMeta(order.id, {
    sendWhatsAppInvoice: true,
    whatsappInvoiceSent: true,
    lastInvoiceMessage: messageText,
  });

  return {
    success: true,
    orderId: order.id,
    orderNumber: order.number,
    phone,
    customerName: order.customerName,
    messageType: "invoice",
    messageText,
    shareUrl,
    timestamp: Date.now(),
  };
}

/**
 * Simulates sending an order ready notification to customer's WhatsApp number.
 */
export async function simulateSendWhatsAppReady(
  order: Order,
): Promise<SimulatedWhatsAppResult> {
  const phone = order.customerPhone || "";
  const messageText = generateReadyWhatsAppMessage(order);
  const shareUrl = getWhatsAppShareUrl(phone, messageText);

  // Persist ready status and notification sent
  saveOrderMeta(order.id, {
    isReady: true,
    readyAt: Date.now(),
    whatsappReadySent: !!phone,
    lastReadyMessage: messageText,
  });

  return {
    success: true,
    orderId: order.id,
    orderNumber: order.number,
    phone,
    customerName: order.customerName,
    messageType: "ready",
    messageText,
    shareUrl,
    timestamp: Date.now(),
  };
}
