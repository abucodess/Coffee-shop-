export type Category = string;

export interface CategoryItem {
  id: string;
  name: string;
}

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
  invoiceNumber?: string | undefined;
  createdAt: number;
  lines: OrderLine[];
  subtotal: number;
  tax: number;
  cgst?: number | undefined;
  sgst?: number | undefined;
  discount?: number | undefined;
  total: number;
  payment: PaymentMethod;
  status: OrderStatus;
  cashier?: string | undefined;
  customerName?: string | undefined;
  customerPhone?: string | undefined;
}

/**
 * Sanitizes phone input by stripping non-numeric characters and extracting standard 10 digits
 */
export function sanitizePhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/**
 * Validates a 10-digit phone number.
 * Empty or undefined is considered valid (optional in POS).
 * If non-empty, must be exactly 10 numeric digits.
 */
export function validatePhoneNumber(phone?: string | null): {
  isValid: boolean;
  error?: string;
} {
  if (!phone || !phone.trim()) {
    return { isValid: true };
  }
  const cleaned = phone.trim();
  if (/^\d{10}$/.test(cleaned)) {
    return { isValid: true };
  }
  return {
    isValid: false,
    error: "Phone number must be exactly 10 digits",
  };
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
  name: "FUWA",
  tagline: "Japanese Fluffy Desserts",
  addressLine1: "108 Omotesando Avenue, Shibuya",
  addressLine2: "Tokyo Dessert Counter",
  pin: "150-0001",
  phone: "+91 98765 43210",
  gstin: "32AAAAA0000A1Z5",
  fssai: "11324000000000",
  isGstRegistered: false,
  cashierName: "Staff 01",
};

export const DEFAULT_CATEGORY_ITEMS: CategoryItem[] = [
  { id: "souffle-pancakes", name: "Japanese Soufflé Pancakes" },
  { id: "dorayaki", name: "Dorayaki" },
  { id: "cold-drinks", name: "Cold Drinks" },
  { id: "espresso-tea", name: "Espresso & Teas" },
  { id: "pastry", name: "Pastry" },
  { id: "bowls", name: "Dessert Bowls" },
];

export const DEFAULT_CATEGORIES: Category[] = [
  "Japanese Soufflé Pancakes",
  "Dorayaki",
  "Cold Drinks",
  "Espresso & Teas",
  "Pastry",
  "Dessert Bowls",
];
export const CATEGORIES: Category[] = DEFAULT_CATEGORIES;

export const DEFAULT_MENU: MenuItem[] = [
  // --- Japanese Soufflé Pancakes (Signature) ---
  {
    id: "classic-souffle",
    name: "Original Fluffy Soufflé",
    note: "Whipped butter, Hokkaido cream & pure maple syrup",
    price: 320,
    category: "Japanese Soufflé Pancakes",
    color: "lemon",
    available: true,
  },
  {
    id: "matcha-souffle",
    name: "Uji Matcha Soufflé",
    note: "Kyoto matcha cream & sweet Azuki red beans",
    price: 380,
    category: "Japanese Soufflé Pancakes",
    color: "mint-soft",
    available: true,
  },
  {
    id: "boba-creme-brulee",
    name: "Boba Crème Brûlée Soufflé",
    note: "Torched caramelized custard & warm brown sugar boba",
    price: 390,
    category: "Japanese Soufflé Pancakes",
    color: "coral",
    available: true,
  },
  {
    id: "strawberry-cloud",
    name: "Strawberry Cloud Soufflé",
    note: "Fresh strawberry compote, chantilly cream & mint",
    price: 360,
    category: "Japanese Soufflé Pancakes",
    color: "coral",
    available: true,
  },
  {
    id: "tiramisu-fluff",
    name: "Tiramisu Soufflé Pancake",
    note: "Mascarpone foam, single-origin espresso & dark cocoa",
    price: 370,
    category: "Japanese Soufflé Pancakes",
    color: "clay",
    available: false,
  },

  // --- Dorayaki (Handcrafted Japanese Pancakes) ---
  {
    id: "classic-dorayaki",
    name: "Classic Red Bean Dorayaki",
    note: "Sweet Azuki bean paste & honey pancake",
    price: 150,
    category: "Dorayaki",
    color: "clay",
    available: true,
  },
  {
    id: "custard-dorayaki",
    name: "Hokkaido Custard Dorayaki",
    note: "Rich Japanese vanilla egg custard",
    price: 160,
    category: "Dorayaki",
    color: "lemon",
    available: true,
  },
  {
    id: "matcha-nama-dorayaki",
    name: "Matcha Nama Dorayaki",
    note: "Ceremonial matcha cream & white chocolate",
    price: 180,
    category: "Dorayaki",
    color: "mint-soft",
    available: true,
  },
  {
    id: "choco-banana-dorayaki",
    name: "Choco Banana Dorayaki",
    note: "Belgian chocolate ganache & caramelized banana",
    price: 175,
    category: "Dorayaki",
    color: "coral",
    available: true,
  },

  // --- Cold Drinks & Teas ---
  {
    id: "iced-matcha",
    name: "Iced Ceremonial Matcha Latte",
    note: "Organic Uji matcha with oat or fresh milk",
    price: 280,
    category: "Cold Drinks",
    color: "mint-soft",
    available: true,
  },
  {
    id: "cold-brew-tonic",
    name: "Yuzu Cold Brew Tonic",
    note: "Citrus yuzu peel & sparkling tonic",
    price: 260,
    category: "Cold Drinks",
    color: "lilac",
    available: true,
  },
  {
    id: "iced-latte",
    name: "Iced Tokyo Latte",
    note: "Double shot over chilled milk and ice",
    price: 220,
    category: "Cold Drinks",
    color: "sky",
    available: true,
  },

  // --- Espresso & Teas ---
  {
    id: "flat-white",
    name: "Flat White",
    note: "Double ristretto with microfoam",
    price: 220,
    category: "Espresso & Teas",
    color: "lemon",
    available: true,
  },
  {
    id: "honey-oat-latte",
    name: "Honey Oat Latte",
    note: "Wild blossom honey & creamy oat milk",
    price: 260,
    category: "Espresso & Teas",
    color: "coral",
    available: true,
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    note: "Classic silky foam & cocoa dusting",
    price: 200,
    category: "Espresso & Teas",
    color: "paper",
    available: true,
  },
  {
    id: "espresso",
    name: "Double Espresso",
    note: "Two shots of house espresso roast",
    price: 150,
    category: "Espresso & Teas",
    color: "clay",
    available: true,
  },
  {
    id: "cortado",
    name: "Cortado",
    note: "Equal parts espresso and steamed milk",
    price: 210,
    category: "Espresso & Teas",
    color: "paper",
    available: false,
  },

  // --- Pastry & Sweets ---
  {
    id: "cardamom-bun",
    name: "Cardamom Bun",
    note: "Freshly baked cardamom spice bun",
    price: 180,
    category: "Pastry",
    color: "clay",
    available: true,
  },
  {
    id: "butter-croissant",
    name: "Butter Croissant",
    note: "Flaky, multi-layered French butter croissant",
    price: 160,
    category: "Pastry",
    color: "lemon",
    available: true,
  },
  {
    id: "morning-bun",
    name: "Cinnamon Morning Bun",
    note: "Caramelized cinnamon sugar twist",
    price: 170,
    category: "Pastry",
    color: "coral",
    available: true,
  },

  // --- Dessert Bowls ---
  {
    id: "acai-bowl",
    name: "Açaí Berry Fluff Bowl",
    note: "Organic açaí, granola, banana & berries",
    price: 340,
    category: "Dessert Bowls",
    color: "sky",
    available: true,
  },
  {
    id: "yogurt-bowl",
    name: "Japanese Parfait Bowl",
    note: "Whipped Greek yogurt, honey & puffed rice",
    price: 290,
    category: "Dessert Bowls",
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
    customerName?: string,
    customerPhone?: string,
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
      customerName,
      customerPhone,
    };
  };
  return [
    mk(
      117,
      12,
      [
        ["classic-souffle", 2],
        ["iced-matcha", 1],
      ],
      "card",
      "paid",
      "Aarav Sharma",
      "9876543210",
    ),
    mk(116, 25, [["boba-creme-brulee", 1], ["classic-dorayaki", 2]], "cash", "paid", "Priya Nair", "9123456789"),
    mk(115, 40, [["matcha-souffle", 1], ["cold-brew-tonic", 1]], "card"),
    mk(
      114,
      58,
      [
        ["custard-dorayaki", 2],
        ["honey-oat-latte", 1],
      ],
      "cash",
    ),
    mk(113, 75, [["classic-dorayaki", 2]], "cash"),
    mk(
      112,
      95,
      [
        ["strawberry-cloud", 1],
        ["iced-matcha", 1],
      ],
      "card",
    ),
    mk(111, 120, [["classic-souffle", 1]], "cash", "cancelled"),
    mk(
      110,
      150,
      [
        ["acai-bowl", 1],
        ["iced-latte", 1],
      ],
      "card",
    ),
  ];
}
