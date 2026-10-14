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

  const shopPhone = shop.phone || "7559803753";

  return `🍰 *${shop.name}*
*${shop.tagline}*
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

💵 Payment Status: ${paymentStatus}

━━━━━━━━━━━━━━━━━━

👨‍🍳 *What's happening now?*

Your order is being freshly prepared. We'll send you a WhatsApp notification as soon as it's ready for pickup.

📍 *${shop.name} — ${shop.tagline}*
📞 ${shopPhone}

Thank you for choosing ${shop.name}! 💛
*Freshly made, joyfully fluffy.* 🍰`;
}

/**
 * Formats a joyful WhatsApp notification when order is ready for pickup
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
  const shopPhone = shop.phone || "7559803753";

  return `🎉 YOUR ORDER IS READY!
🍰 ${shop.name} — ${shop.tagline}
━━━━━━━━━━━━━━━━━━
${customerGreeting}
Your fluffy treats are freshly prepared and READY FOR PICKUP! 🥞✨
🧾 Order No.: ${order.number}
📦 YOUR ORDER
${itemsList}
📍 PICKUP REMINDER
Please visit the ${shop.name} pickup counter and show your order number ${order.number} to collect your treats.
📸 FOLLOW US ON INSTAGRAM
See our fluffy creations and latest updates! 💛
👉 https://www.instagram.com/fuwa_.fluffy
Thank you for choosing ${shop.name}!
Enjoy every fluffy bite! 🥞✨
Team ${shop.name}
📞 ${shopPhone}`;
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
