export type Category = "Espresso" | "Cold" | "Pastry" | "Bowls";

export interface MenuItem {
  id: string;
  name: string;
  note: string;
  price: number;
  category: Category;
  color: "lemon" | "coral" | "mint-soft" | "lilac" | "clay" | "sky" | "paper";
  available: boolean;
}

export interface CartLine {
  itemId: string;
  qty: number;
}

export type PaymentMethod = "cash" | "card";
export type OrderStatus = "paid" | "cancelled";

export interface OrderLine {
  name: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  number: string;
  createdAt: number;
  lines: OrderLine[];
  subtotal: number;
  tax: number;
  total: number;
  payment: PaymentMethod;
  status: OrderStatus;
}

export const TAX_RATE = 0.08;

export const CATEGORIES: Category[] = ["Espresso", "Cold", "Pastry", "Bowls"];

export const DEFAULT_MENU: MenuItem[] = [
  { id: "flat-white", name: "Flat White", note: "Double ristretto", price: 4.25, category: "Espresso", color: "lemon", available: true },
  { id: "honey-oat-latte", name: "Honey Oat Latte", note: "Barista favorite", price: 5.5, category: "Espresso", color: "coral", available: true },
  { id: "cappuccino", name: "Cappuccino", note: "Classic foam", price: 4.5, category: "Espresso", color: "paper", available: true },
  { id: "espresso", name: "Double Espresso", note: "Two shots", price: 3.25, category: "Espresso", color: "clay", available: true },
  { id: "cortado", name: "Cortado", note: "Equal parts", price: 5.75, category: "Espresso", color: "paper", available: false },
  { id: "iced-matcha", name: "Iced Matcha", note: "Ceremonial grade", price: 5.0, category: "Cold", color: "mint-soft", available: true },
  { id: "cold-brew-tonic", name: "Cold Brew Tonic", note: "Citrus peel", price: 6.75, category: "Cold", color: "lilac", available: true },
  { id: "iced-latte", name: "Iced Latte", note: "Over ice", price: 5.0, category: "Cold", color: "sky", available: true },
  { id: "cardamom-bun", name: "Cardamom Bun", note: "Baked this morning", price: 4.5, category: "Pastry", color: "clay", available: true },
  { id: "butter-croissant", name: "Butter Croissant", note: "Flaky, warm", price: 3.75, category: "Pastry", color: "lemon", available: true },
  { id: "morning-bun", name: "Morning Bun", note: "Cinnamon sugar", price: 4.25, category: "Pastry", color: "coral", available: true },
  { id: "acai-bowl", name: "Açaí Bowl", note: "Granola & banana", price: 9.0, category: "Bowls", color: "sky", available: true },
  { id: "yogurt-bowl", name: "Yogurt Bowl", note: "Honey & seeds", price: 7.5, category: "Bowls", color: "mint-soft", available: true },
];

export const fmt = (n: number) => `$${n.toFixed(2)}`;

export function seedOrders(menu: MenuItem[]): Order[] {
  const now = Date.now();
  const mk = (
    n: number,
    minsAgo: number,
    picks: [string, number][],
    payment: PaymentMethod,
    status: OrderStatus = "paid",
  ): Order => {
    const lines = picks.map(([id, qty]) => {
      const item = menu.find((m) => m.id === id)!;
      return { name: item.name, price: item.price, qty };
    });
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const tax = subtotal * TAX_RATE;
    return {
      id: `seed-${n}`,
      number: `A-${String(n).padStart(3, "0")}`,
      createdAt: now - minsAgo * 60_000,
      lines,
      subtotal,
      tax,
      total: subtotal + tax,
      payment,
      status,
    };
  };
  return [
    mk(117, 12, [["flat-white", 2], ["cardamom-bun", 1]], "card"),
    mk(116, 25, [["acai-bowl", 1]], "cash"),
    mk(115, 40, [["cold-brew-tonic", 1]], "card"),
    mk(114, 58, [["honey-oat-latte", 1], ["butter-croissant", 2]], "cash"),
    mk(113, 75, [["espresso", 2]], "cash"),
    mk(112, 95, [["iced-matcha", 1], ["morning-bun", 1]], "card"),
    mk(111, 120, [["cappuccino", 1]], "cash", "cancelled"),
    mk(110, 150, [["yogurt-bowl", 1], ["iced-latte", 1]], "card"),
  ];
}
