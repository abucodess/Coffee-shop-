import { useSyncExternalStore } from "react";
import {
  DEFAULT_MENU,
  DEFAULT_CATEGORY_ITEMS,
  seedOrders,
  type CartLine,
  type CategoryItem,
  type MenuItem,
  type Order,
  type PaymentMethod,
} from "./pos-data";
import {
  fetchProducts,
  fetchOrders,
  fetchCategories,
  createCategoryInDb,
  deleteCategoryInDb,
  saveProduct,
  deleteProduct as deleteProductInDb,
  toggleProductAvailability,
  createOrder as createOrderInDb,
  cancelOrderInDb,
  updateOrderReadyInDb,
} from "./pos-api";
import {
  simulateSendWhatsAppInvoice,
  simulateSendWhatsAppReady,
  saveOrderMeta,
  getAllOrderMeta,
  normalizeWhatsAppPhone,
} from "./whatsapp";
import { supabase, isSupabaseConfigured } from "./supabase";

export interface PosState {
  menu: MenuItem[];
  categories: CategoryItem[];
  orders: Order[];
  cart: CartLine[];
  counter: number;
  menuLoading: boolean;
  categoriesLoading: boolean;
  ordersLoading: boolean;
  isSubmittingOrder: boolean;
  actionLoadingId: string | null;
  error: string | null;
}

const STORAGE_KEY = "fuwa-counter-pos-v1";

function loadInitialState(): PosState {
  let menu = DEFAULT_MENU;
  let categories: CategoryItem[] = DEFAULT_CATEGORY_ITEMS;
  let orders = isSupabaseConfigured ? [] : seedOrders(DEFAULT_MENU);
  let cart: CartLine[] = [];
  let counter = 118;

  try {
    if (typeof localStorage !== "undefined") {
      const raw =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem("mocha-counter-pos-v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.menu && Array.isArray(parsed.menu)) menu = parsed.menu;
        if (parsed.categories && Array.isArray(parsed.categories) && parsed.categories.length > 0) {
          categories = parsed.categories;
        }
        if (!isSupabaseConfigured && parsed.orders && Array.isArray(parsed.orders)) {
          orders = parsed.orders;
        }
        if (parsed.cart && Array.isArray(parsed.cart)) cart = parsed.cart;
        if (typeof parsed.counter === "number") counter = parsed.counter;
      }
    }
  } catch {
    /* corrupted storage -> fallback */
  }

  return {
    menu,
    categories,
    orders,
    cart,
    counter,
    menuLoading: isSupabaseConfigured,
    categoriesLoading: isSupabaseConfigured,
    ordersLoading: isSupabaseConfigured,
    isSubmittingOrder: false,
    actionLoadingId: null,
    error: null,
  };
}

let state: PosState = loadInitialState();
const listeners = new Set<() => void>();

function persistLocalCart() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          menu: state.menu,
          categories: state.categories,
          orders: isSupabaseConfigured ? [] : state.orders,
          cart: state.cart,
          counter: state.counter,
        }),
      );
    }
  } catch {
    /* storage full/blocked */
  }
}

function setState(next: Partial<PosState>) {
  state = { ...state, ...next };
  persistLocalCart();
  listeners.forEach((l) => l());
}

export function usePos<T>(selector: (s: PosState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
  );
}

// ----------------------------------------------------
// Initial Cloud Sync
// ----------------------------------------------------
// Initial Cloud Sync & Realtime
// ----------------------------------------------------

let hasInitialized = false;
let realtimeChannel: any = null;
let realtimeCategoriesChannel: any = null;
const deletedItemIds = new Set<string>();
let lastMutationTime = 0;
let lastFocusFetchTime = 0;
const FOCUS_COOLDOWN_MS = 15000;

export function subscribeToCategoriesChanges() {
  if (realtimeCategoriesChannel || !isSupabaseConfigured || typeof window === "undefined") return;

  try {
    realtimeCategoriesChannel = supabase
      .channel("pos-categories-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        async (payload: any) => {
          try {
            if (payload?.eventType === "DELETE" && payload?.old?.id) {
              const deletedId = payload.old.id;
              setState({
                categories: state.categories.filter((c) => c.id !== deletedId),
              });
              return;
            }

            const freshCats = await fetchCategories();
            if (freshCats && freshCats.length > 0) {
              setState({ categories: freshCats });
            }
          } catch (err) {
            console.error("Realtime categories update failed:", err);
          }
        },
      )
      .subscribe();
  } catch (err) {
    console.warn("Failed to subscribe to realtime categories changes:", err);
  }
}

export function subscribeToMenuChanges() {
  if (realtimeChannel || !isSupabaseConfigured || typeof window === "undefined") return;

  try {
    realtimeChannel = supabase
      .channel("pos-products-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        async (payload: any) => {
          try {
            // Instant in-memory removal on DELETE event without re-querying stale data
            if (payload?.eventType === "DELETE" && payload?.old?.id) {
              const deletedId = payload.old.id;
              deletedItemIds.add(deletedId);
              setState({
                menu: state.menu.filter((m) => m.id !== deletedId),
                cart: state.cart.filter((l) => l.itemId !== deletedId),
              });
              return;
            }

            const freshMenu = await fetchProducts();
            if (freshMenu) {
              const sanitized = freshMenu.filter((m) => !deletedItemIds.has(m.id));
              setState({ menu: sanitized });
            }
          } catch (err) {
            console.error("Realtime menu update failed:", err);
          }
        },
      )
      .subscribe();
  } catch (err) {
    console.warn("Failed to subscribe to realtime products changes:", err);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("focus", () => {
    const now = Date.now();
    // Do not trigger background fetch if:
    // 1. A mutation occurred recently (e.g. user just closed a confirm() dialog)
    // 2. We already synced recently (within 15 seconds)
    if (now - lastMutationTime < 5000 || now - lastFocusFetchTime < FOCUS_COOLDOWN_MS) {
      return;
    }
    lastFocusFetchTime = now;

    if (isSupabaseConfigured) {
      refreshMenu().catch(() => {});
      refreshCategories().catch(() => {});
    }
  });
}

export async function initializePosStore(force: boolean = false): Promise<void> {
  if ((hasInitialized && !force) || !isSupabaseConfigured) return;
  hasInitialized = true;

  subscribeToMenuChanges();
  subscribeToCategoriesChanges();

  setState({ menuLoading: true, categoriesLoading: true, ordersLoading: true });

  try {
    const [remoteMenu, remoteOrders, remoteCategories] = await Promise.all([
      fetchProducts().catch((err) => {
        console.error("Initial products fetch failed:", err);
        return null;
      }),
      fetchOrders().catch((err) => {
        console.error("Initial orders fetch failed:", err);
        return null;
      }),
      fetchCategories().catch((err) => {
        console.error("Initial categories fetch failed:", err);
        return null;
      }),
    ]);

    const cleanMenu = remoteMenu
      ? remoteMenu.filter((m) => !deletedItemIds.has(m.id))
      : state.menu;

    setState({
      menu: cleanMenu,
      categories:
        remoteCategories && remoteCategories.length > 0
          ? remoteCategories
          : state.categories,
      orders: remoteOrders ?? state.orders,
      menuLoading: false,
      categoriesLoading: false,
      ordersLoading: false,
    });
  } catch (err) {
    console.error("Store initialization failed:", err);
    setState({
      menuLoading: false,
      categoriesLoading: false,
      ordersLoading: false,
      error: "Failed to sync with Supabase",
    });
  }
}

// ----------------------------------------------------
// Cart Actions (Client-Side State)
// ----------------------------------------------------

export function addToCart(itemId: string) {
  const existing = state.cart.find((l) => l.itemId === itemId);
  const cart = existing
    ? state.cart.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + 1 } : l))
    : [...state.cart, { itemId, qty: 1 }];
  setState({ cart });
}

export function setQty(itemId: string, qty: number) {
  const cart =
    qty <= 0
      ? state.cart.filter((l) => l.itemId !== itemId)
      : state.cart.map((l) => (l.itemId === itemId ? { ...l, qty } : l));
  setState({ cart });
}

export function clearCart() {
  setState({ cart: [] });
}

export function cartTotals(cart: CartLine[], menu: MenuItem[], discountAmount: number = 0) {
  const grossSubtotal = cart.reduce((s, l) => {
    const item = menu.find((m) => m.id === l.itemId);
    return s + (item ? item.price * l.qty : 0);
  }, 0);

  const discount = Math.min(Math.max(0, discountAmount), grossSubtotal);
  const total = Math.max(0, grossSubtotal - discount);

  return {
    subtotal: grossSubtotal,
    taxableAmount: total,
    discount,
    cgst: 0,
    sgst: 0,
    tax: 0,
    total,
  };
}

// ----------------------------------------------------
// Order Actions (Database-backed)
// ----------------------------------------------------

export async function completeOrder(
  payment: PaymentMethod,
  discount: number = 0,
  cashier?: string,
  customerName?: string,
  customerPhone?: string,
  sendWhatsAppInvoice: boolean = true,
): Promise<Order | null> {
  if (state.cart.length === 0 || state.isSubmittingOrder) return null;

  const cartLines = state.cart
    .map((line) => {
      const item = state.menu.find((m) => m.id === line.itemId);
      return item ? { item, qty: line.qty } : null;
    })
    .filter((entry): entry is { item: MenuItem; qty: number } => entry !== null);

  if (cartLines.length === 0) return null;

  setState({ isSubmittingOrder: true });

  try {
    const order = await createOrderInDb(
      cartLines,
      payment,
      discount,
      cashier,
      customerName,
      customerPhone,
      sendWhatsAppInvoice,
    );

    // If customer phone is provided and whatsapp invoice requested, normalize and send safely
    if (sendWhatsAppInvoice && customerPhone && order) {
      const phoneNorm = normalizeWhatsAppPhone(customerPhone);
      if (phoneNorm.isValid) {
        simulateSendWhatsAppInvoice(order).catch((err) => {
          console.warn("Simulated WhatsApp invoice trigger failed:", err);
        });
      } else {
        saveOrderMeta(order.id, {
          whatsappInvoiceSent: false,
          invoiceEvent: {
            id: `${order.id}-invoice`,
            orderId: order.id,
            orderNumber: order.number,
            messageType: "invoice",
            recipientPhone: customerPhone,
            normalizedPhone: "",
            status: "failed",
            attemptCount: 1,
            lastAttemptAt: Date.now(),
            errorMessage: phoneNorm.error || "Invalid customer phone number",
          },
        });
      }
    }

    // Only clear cart and append order upon successful persistence
    setState({
      orders: [order, ...state.orders],
      cart: [],
      counter: state.counter + 1,
      isSubmittingOrder: false,
    });

    return order;
  } catch (error) {
    setState({ isSubmittingOrder: false });
    console.error("Order submission failed:", error);
    throw error;
  }
}

export interface MarkOrderReadyResult {
  success: boolean;
  orderId: string;
  orderNumber?: string;
  wasAlreadyReady: boolean;
  notified: boolean;
  alreadyNotified: boolean;
  phoneNormalized?: string;
  warning?: string;
  error?: string;
}

export async function markOrderReady(
  orderId: string,
  options?: { notifyWhatsApp?: boolean; forceResend?: boolean },
): Promise<MarkOrderReadyResult> {
  const target = state.orders.find((o) => o.id === orderId);
  const allMeta = getAllOrderMeta();
  const meta = allMeta[orderId] || {};

  const wasAlreadyReady = Boolean(target?.isReady || meta.isReady);
  const wasAlreadySent = Boolean(
    target?.whatsappReadySent || meta.whatsappReadySent || meta.readyEvent?.status === "sent",
  );

  const now = Date.now();
  const readyTimestamp = target?.readyAt || meta.readyAt || now;

  // 1. Optimistic update in state
  if (target) {
    setState({
      orders: state.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              isReady: true,
              readyAt: readyTimestamp,
            }
          : o,
      ),
    });
  }

  // 2. Persist ready status in metadata
  saveOrderMeta(orderId, {
    isReady: true,
    readyAt: readyTimestamp,
  });

  // 3. Persist to DB asynchronously
  try {
    await updateOrderReadyInDb(orderId, true);
  } catch (err) {
    console.warn("Failed to sync order ready status to database:", err);
  }

  // 4. Status Transition Detection:
  // If order was ALREADY ready, do NOT trigger notification again
  if (wasAlreadyReady) {
    return {
      success: true,
      orderId,
      orderNumber: target?.number,
      wasAlreadyReady: true,
      notified: false,
      alreadyNotified: wasAlreadySent,
    };
  }

  // Transition from non-ready to ready:
  let notified = false;
  let alreadyNotified = wasAlreadySent;
  let warning: string | undefined;

  const phone = target?.customerPhone;
  const shouldAttemptNotify = options?.notifyWhatsApp !== false && !wasAlreadySent;

  if (shouldAttemptNotify) {
    if (!phone) {
      warning = "Customer has no phone number. Order marked ready without WhatsApp notification.";
    } else {
      const phoneNorm = normalizeWhatsAppPhone(phone);
      if (!phoneNorm.isValid) {
        warning = `Customer phone number is invalid (${phoneNorm.error || "invalid format"}). WhatsApp notification was not sent.`;
        saveOrderMeta(orderId, {
          readyEvent: {
            id: `${orderId}-ready`,
            orderId,
            orderNumber: target?.number || "",
            messageType: "ready",
            recipientPhone: phone,
            normalizedPhone: "",
            status: "failed",
            attemptCount: 1,
            lastAttemptAt: Date.now(),
            errorMessage: phoneNorm.error || "Invalid phone number",
          },
        });
      } else if (target) {
        try {
          const res = await simulateSendWhatsAppReady(target, {
            forceResend: options?.forceResend,
          });
          if (res.success && !res.alreadySent) {
            notified = true;
            setState({
              orders: state.orders.map((o) =>
                o.id === orderId ? { ...o, whatsappReadySent: true } : o,
              ),
            });
          } else if (res.alreadySent) {
            alreadyNotified = true;
          } else if (res.error) {
            warning = `WhatsApp notification could not be delivered: ${res.error}`;
          }
        } catch (err: any) {
          warning = `WhatsApp notification failed: ${err?.message || "Unknown error"}`;
        }
      }
    }
  }

  return {
    success: true,
    orderId,
    orderNumber: target?.number,
    wasAlreadyReady: false,
    notified,
    alreadyNotified,
    phoneNormalized: phone ? normalizeWhatsAppPhone(phone).displayFormatted : undefined,
    warning,
  };
}

export async function markOrderPreparing(orderId: string): Promise<void> {
  const target = state.orders.find((o) => o.id === orderId);

  if (target) {
    setState({
      orders: state.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              isReady: false,
              readyAt: undefined,
            }
          : o,
      ),
    });
  }

  saveOrderMeta(orderId, {
    isReady: false,
    readyAt: undefined,
  });

  try {
    await updateOrderReadyInDb(orderId, false);
  } catch (err) {
    console.warn("Failed to sync order preparing status to database:", err);
  }
}

export async function notifyOrderWhatsAppReady(orderId: string): Promise<void> {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order || !order.customerPhone) return;

  setState({
    orders: state.orders.map((o) =>
      o.id === orderId ? { ...o, whatsappReadySent: true } : o,
    ),
  });

  saveOrderMeta(orderId, { whatsappReadySent: true });
  await simulateSendWhatsAppReady(order);
}

export async function notifyOrderWhatsAppInvoice(orderId: string): Promise<void> {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order || !order.customerPhone) return;

  setState({
    orders: state.orders.map((o) =>
      o.id === orderId ? { ...o, whatsappInvoiceSent: true } : o,
    ),
  });

  saveOrderMeta(orderId, { whatsappInvoiceSent: true });
  await simulateSendWhatsAppInvoice(order);
}

export async function cancelOrder(orderId: string): Promise<void> {
  setState({ actionLoadingId: orderId });

  try {
    await cancelOrderInDb(orderId);
    setState({
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, status: "cancelled", isReady: false } : o)),
      actionLoadingId: null,
    });
  } catch (err) {
    setState({ actionLoadingId: null });
    console.error("Order cancellation failed:", err);
    throw err;
  }
}

// ----------------------------------------------------
// Menu Actions (Database-backed)
// ----------------------------------------------------

export async function toggleAvailability(itemId: string): Promise<void> {
  lastMutationTime = Date.now();
  const item = state.menu.find((m) => m.id === itemId);
  if (!item) return;

  const nextAvailable = !item.available;
  // Optimistic update
  setState({
    menu: state.menu.map((m) => (m.id === itemId ? { ...m, available: nextAvailable } : m)),
  });

  try {
    await toggleProductAvailability(itemId, nextAvailable);
  } catch (err) {
    // Rollback on failure
    setState({
      menu: state.menu.map((m) => (m.id === itemId ? { ...m, available: item.available } : m)),
    });
    console.error("Failed to toggle availability:", err);
    throw err;
  }
}

export async function saveMenuItem(item: MenuItem): Promise<void> {
  lastMutationTime = Date.now();
  deletedItemIds.delete(item.id);
  const exists = state.menu.some((m) => m.id === item.id);
  const prevMenu = [...state.menu];
  const prevCategories = [...state.categories];

  const categoryName = item.category.trim();
  const catExists = state.categories.some(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
  );
  const nextCategories = catExists
    ? state.categories
    : [
        ...state.categories,
        {
          id: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          name: categoryName,
        },
      ];

  // Optimistic update
  setState({
    menu: exists ? state.menu.map((m) => (m.id === item.id ? item : m)) : [...state.menu, item],
    categories: nextCategories,
  });

  try {
    await saveProduct(item);
  } catch (err) {
    // Rollback
    setState({ menu: prevMenu, categories: prevCategories });
    console.error("Failed to save menu item:", err);
    throw err;
  }
}

export async function deleteMenuItem(itemId: string): Promise<void> {
  lastMutationTime = Date.now();
  deletedItemIds.add(itemId);
  const prevMenu = [...state.menu];
  const prevCart = [...state.cart];

  // Optimistic update
  setState({
    menu: state.menu.filter((m) => m.id !== itemId),
    cart: state.cart.filter((l) => l.itemId !== itemId),
  });

  try {
    await deleteProductInDb(itemId);
  } catch (err) {
    // Rollback on genuine failure
    deletedItemIds.delete(itemId);
    setState({ menu: prevMenu, cart: prevCart });
    console.error("Failed to delete menu item:", err);
    throw err;
  }
}

// ----------------------------------------------------
// Category Actions (Database-backed)
// ----------------------------------------------------

export async function addCategory(name: string): Promise<CategoryItem> {
  lastMutationTime = Date.now();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Category name cannot be empty");
  }

  const existing = state.categories.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) {
    throw new Error(`Category "${existing.name}" already exists`);
  }

  const tempSlug =
    trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `cat-${Date.now()}`;
  const tempItem: CategoryItem = { id: tempSlug, name: trimmed };
  const prevCategories = [...state.categories];

  // Optimistic update
  setState({ categories: [...state.categories, tempItem] });

  try {
    const saved = await createCategoryInDb(trimmed);
    setState({
      categories: state.categories.map((c) => (c.id === tempSlug ? saved : c)),
    });
    return saved;
  } catch (err) {
    // Rollback
    setState({ categories: prevCategories });
    console.error("Failed to add category:", err);
    throw err;
  }
}

export async function deleteCategory(categoryIdOrName: string): Promise<void> {
  lastMutationTime = Date.now();
  const cat = state.categories.find(
    (c) =>
      c.id === categoryIdOrName ||
      c.name.toLowerCase() === categoryIdOrName.toLowerCase(),
  );
  const catName = cat ? cat.name : categoryIdOrName;
  const targetId = cat ? cat.id : categoryIdOrName;

  // Local safety check: ensure no products are assigned to this category in memory
  const itemsInCat = state.menu.filter(
    (m) => m.category.toLowerCase() === catName.toLowerCase(),
  );
  if (itemsInCat.length > 0) {
    const names = itemsInCat.map((m) => m.name).slice(0, 3).join(", ");
    const more = itemsInCat.length > 3 ? ` and ${itemsInCat.length - 3} more` : "";
    throw new Error(
      `Cannot delete category "${catName}": ${itemsInCat.length} product${itemsInCat.length > 1 ? "s" : ""} (${names}${more}) still belong to it. Please reassign or delete them first.`,
    );
  }

  const prevCategories = [...state.categories];
  // Optimistic update
  setState({
    categories: state.categories.filter((c) => c.id !== targetId),
  });

  try {
    await deleteCategoryInDb(targetId);
  } catch (err) {
    // Rollback
    setState({ categories: prevCategories });
    console.error("Failed to delete category:", err);
    throw err;
  }
}

export async function refreshCategories(): Promise<void> {
  if (!isSupabaseConfigured) return;
  setState({ categoriesLoading: true });
  try {
    const categories = await fetchCategories();
    if (categories && categories.length > 0) {
      setState({ categories, categoriesLoading: false });
    } else {
      setState({ categoriesLoading: false });
    }
  } catch (err) {
    setState({ categoriesLoading: false });
    throw err;
  }
}

// Refresh triggers
export async function refreshOrders(): Promise<void> {
  if (!isSupabaseConfigured) return;
  setState({ ordersLoading: true });
  try {
    const orders = await fetchOrders();
    setState({ orders, ordersLoading: false });
  } catch (err) {
    setState({ ordersLoading: false });
    throw err;
  }
}

export async function refreshMenu(): Promise<void> {
  if (!isSupabaseConfigured) return;
  // If a mutation was performed recently, skip background fetch to avoid clobbering optimistic state
  if (Date.now() - lastMutationTime < 3000) return;

  setState({ menuLoading: true });
  try {
    const rawMenu = await fetchProducts();
    const menu = rawMenu ? rawMenu.filter((m) => !deletedItemIds.has(m.id)) : state.menu;
    setState({ menu, menuLoading: false });
  } catch (err) {
    setState({ menuLoading: false });
    throw err;
  }
}
