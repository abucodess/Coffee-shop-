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

export type PaymentMethod = "cash" | "card" | "upi";
export type OrderStatus = "paid" | "cancelled";

export interface OrderLine {
  name: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  number: string;
  invoiceNumber?: string;
  createdAt: number;
  lines: OrderLine[];
  subtotal: number;
  tax: number;
  cgst?: number;
  sgst?: number;
  discount?: number;
  total: number;
  payment: PaymentMethod;
  status: OrderStatus;
  cashier?: string;
}

// Configurable GST Rates (tax removed - 0%)
export const GST_CONFIG = {
  cgstRate: 0,
  sgstRate: 0,
  get totalGstRate() {
    return 0;
  },
};

export const TAX_RATE = 0;

export interface ShopInfo {
  name: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  pin: string;
  phone: string;
  gstin?: string;
  fssai?: string;
  isGstRegistered: boolean;
  cashierName: string;
}

export const SHOP_INFO: ShopInfo = {
  name: "MOCHA COFFEE HOUSE",
  tagline: "Coffee, Conversations & More",
  addressLine1: "Kanhangad, Kasaragod",
  addressLine2: "Kerala",
  pin: "671315",
  phone: "+91 98765 43210",
  gstin: "32AAAAA0000A1Z5",
  fssai: "11324000000000",
  isGstRegistered: false,
  cashierName: "Staff 01",
};

export const CATEGORIES: Category[] = ["Espresso", "Cold", "Pastry", "Bowls"];

export const DEFAULT_MENU: MenuItem[] = [
  {
    id: "flat-white",
    name: "Flat White",
    note: "Double ristretto",
    price: 220,
    category: "Espresso",
    color: "lemon",
    available: true,
  },
  {
    id: "honey-oat-latte",
    name: "Honey Oat Latte",
    note: "Barista favorite",
    price: 260,
    category: "Espresso",
    color: "coral",
    available: true,
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    note: "Classic foam",
    price: 200,
    category: "Espresso",
    color: "paper",
    available: true,
  },
  {
    id: "espresso",
    name: "Double Espresso",
    note: "Two shots",
    price: 150,
    category: "Espresso",
    color: "clay",
    available: true,
  },
  {
    id: "cortado",
    name: "Cortado",
    note: "Equal parts",
    price: 210,
    category: "Espresso",
    color: "paper",
    available: false,
  },
  {
    id: "iced-matcha",
    name: "Iced Matcha",
    note: "Ceremonial grade",
    price: 280,
    category: "Cold",
    color: "mint-soft",
    available: true,
  },
  {
    id: "cold-brew-tonic",
    name: "Cold Brew Tonic",
    note: "Citrus peel",
    price: 260,
    category: "Cold",
    color: "lilac",
    available: true,
  },
  {
    id: "iced-latte",
    name: "Iced Latte",
    note: "Over ice",
    price: 220,
    category: "Cold",
    color: "sky",
    available: true,
  },
  {
    id: "cardamom-bun",
    name: "Cardamom Bun",
    note: "Baked this morning",
    price: 180,
    category: "Pastry",
    color: "clay",
    available: true,
  },
  {
    id: "butter-croissant",
    name: "Butter Croissant",
    note: "Flaky, warm",
    price: 160,
    category: "Pastry",
    color: "lemon",
    available: true,
  },
  {
    id: "morning-bun",
    name: "Morning Bun",
    note: "Cinnamon sugar",
    price: 170,
    category: "Pastry",
    color: "coral",
    available: true,
  },
  {
    id: "acai-bowl",
    name: "Açaí Bowl",
    note: "Granola & banana",
    price: 340,
    category: "Bowls",
    color: "sky",
    available: true,
  },
  {
    id: "yogurt-bowl",
    name: "Yogurt Bowl",
    note: "Honey & seeds",
    price: 290,
    category: "Bowls",
    color: "mint-soft",
    available: true,
  },
];

export const fmt = (n: number) => `₹${n.toFixed(2)}`;

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
    const tax = 0;
    return {
      id: `seed-${n}`,
      number: `A-${String(n).padStart(3, "0")}`,
      createdAt: now - minsAgo * 60_000,
      lines,
      subtotal,
      tax,
      total: subtotal,
      payment,
      status,
    };
  };
  return [
    mk(
      117,
      12,
      [
        ["flat-white", 2],
        ["cardamom-bun", 1],
      ],
      "card",
    ),
    mk(116, 25, [["acai-bowl", 1]], "cash"),
    mk(115, 40, [["cold-brew-tonic", 1]], "card"),
    mk(
      114,
      58,
      [
        ["honey-oat-latte", 1],
        ["butter-croissant", 2],
      ],
      "cash",
    ),
    mk(113, 75, [["espresso", 2]], "cash"),
    mk(
      112,
      95,
      [
        ["iced-matcha", 1],
        ["morning-bun", 1],
      ],
      "card",
    ),
    mk(111, 120, [["cappuccino", 1]], "cash", "cancelled"),
    mk(
      110,
      150,
      [
        ["yogurt-bowl", 1],
        ["iced-latte", 1],
      ],
      "card",
    ),
  ];
}
