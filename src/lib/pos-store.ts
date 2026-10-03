import { useSyncExternalStore } from "react";
import {
  DEFAULT_MENU,
  TAX_RATE,
  seedOrders,
  type CartLine,
  type MenuItem,
  type Order,
  type PaymentMethod,
} from "./pos-data";

interface PosState {
  menu: MenuItem[];
  orders: Order[];
  cart: CartLine[];
  counter: number;
}

const STORAGE_KEY = "mocha-counter-pos-v1";

function load(): PosState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PosState;
  } catch {
    /* corrupted storage -> reseed */
  }
  return { menu: DEFAULT_MENU, orders: seedOrders(DEFAULT_MENU), cart: [], counter: 118 };
}

let state: PosState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full/blocked — keep in-memory */
  }
}

function setState(next: Partial<PosState>) {
  state = { ...state, ...next };
  persist();
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

/* ----- cart actions ----- */

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

export function cartTotals(cart: CartLine[], menu: MenuItem[]) {
  const subtotal = cart.reduce((s, l) => {
    const item = menu.find((m) => m.id === l.itemId);
    return s + (item ? item.price * l.qty : 0);
  }, 0);
  const tax = subtotal * TAX_RATE;
  return { subtotal, tax, total: subtotal + tax };
}

export function completeOrder(payment: PaymentMethod): Order | null {
  if (state.cart.length === 0) return null;
  const { subtotal, tax, total } = cartTotals(state.cart, state.menu);
  const order: Order = {
    id: `o-${Date.now()}`,
    number: `A-${String(state.counter).padStart(3, "0")}`,
    createdAt: Date.now(),
    lines: state.cart.map((l) => {
      const item = state.menu.find((m) => m.id === l.itemId)!;
      return { name: item.name, price: item.price, qty: l.qty };
    }),
    subtotal,
    tax,
    total,
    payment,
    status: "paid",
  };
  setState({ orders: [order, ...state.orders], cart: [], counter: state.counter + 1 });
  return order;
}

export function cancelOrder(orderId: string) {
  setState({
    orders: state.orders.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o)),
  });
}

/* ----- menu actions ----- */

export function toggleAvailability(itemId: string) {
  setState({
    menu: state.menu.map((m) => (m.id === itemId ? { ...m, available: !m.available } : m)),
  });
}

export function saveMenuItem(item: MenuItem) {
  const exists = state.menu.some((m) => m.id === item.id);
  setState({
    menu: exists
      ? state.menu.map((m) => (m.id === item.id ? item : m))
      : [...state.menu, item],
  });
}

export function deleteMenuItem(itemId: string) {
  setState({
    menu: state.menu.filter((m) => m.id !== itemId),
    cart: state.cart.filter((l) => l.itemId !== itemId),
  });
}
