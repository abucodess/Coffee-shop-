import { useSyncExternalStore } from "react";
import {
  DEFAULT_MENU,
  seedOrders,
  type CartLine,
  type MenuItem,
  type Order,
  type PaymentMethod,
} from "./pos-data";
import {
  fetchProducts,
  fetchOrders,
  saveProduct,
  deleteProduct as deleteProductInDb,
  toggleProductAvailability,
  createOrder as createOrderInDb,
  cancelOrderInDb,
} from "./pos-api";
import { supabase, isSupabaseConfigured } from "./supabase";

export interface PosState {
  menu: MenuItem[];
  orders: Order[];
  cart: CartLine[];
  counter: number;
  menuLoading: boolean;
  ordersLoading: boolean;
  isSubmittingOrder: boolean;
  actionLoadingId: string | null;
  error: string | null;
}

const STORAGE_KEY = "mocha-counter-pos-v1";

function loadInitialState(): PosState {
  let menu = DEFAULT_MENU;
  let orders = isSupabaseConfigured ? [] : seedOrders(DEFAULT_MENU);
  let cart: CartLine[] = [];
  let counter = 118;

  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.menu && Array.isArray(parsed.menu)) menu = parsed.menu;
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
    orders,
    cart,
    counter,
    menuLoading: isSupabaseConfigured,
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
const deletedItemIds = new Set<string>();
let lastMutationTime = 0;
let lastFocusFetchTime = 0;
const FOCUS_COOLDOWN_MS = 15000;

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
    }
  });
}

export async function initializePosStore(force: boolean = false): Promise<void> {
  if ((hasInitialized && !force) || !isSupabaseConfigured) return;
  hasInitialized = true;

  subscribeToMenuChanges();

  setState({ menuLoading: true, ordersLoading: true });

  try {
    const [remoteMenu, remoteOrders] = await Promise.all([
      fetchProducts().catch((err) => {
        console.error("Initial products fetch failed:", err);
        return null;
      }),
      fetchOrders().catch((err) => {
        console.error("Initial orders fetch failed:", err);
        return null;
      }),
    ]);

    const cleanMenu = remoteMenu
      ? remoteMenu.filter((m) => !deletedItemIds.has(m.id))
      : state.menu;

    setState({
      menu: cleanMenu,
      orders: remoteOrders ?? state.orders,
      menuLoading: false,
      ordersLoading: false,
    });
  } catch (err) {
    console.error("Store initialization failed:", err);
    setState({
      menuLoading: false,
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
    const order = await createOrderInDb(cartLines, payment, discount, cashier);

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

export async function cancelOrder(orderId: string): Promise<void> {
  setState({ actionLoadingId: orderId });

  try {
    await cancelOrderInDb(orderId);
    setState({
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o)),
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

  // Optimistic update
  setState({
    menu: exists ? state.menu.map((m) => (m.id === item.id ? item : m)) : [...state.menu, item],
  });

  try {
    await saveProduct(item);
  } catch (err) {
    // Rollback
    setState({ menu: prevMenu });
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
