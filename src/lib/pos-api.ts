import { supabase, isSupabaseConfigured } from "./supabase";
import {
  type Category,
  type MenuItem,
  type Order,
  type OrderLine,
  type PaymentMethod,
  DEFAULT_MENU,
  SHOP_INFO,
} from "./pos-data";

// Category ID mapping helpers (retained for backward compatibility)
export const CATEGORY_MAP: Record<string, string> = {
  Espresso: "espresso",
  Cold: "cold",
  Pastry: "pastry",
  Bowls: "bowls",
};

export const REVERSE_CATEGORY_MAP: Record<string, string> = {
  espresso: "Espresso",
  cold: "Cold",
  pastry: "Pastry",
  bowls: "Bowls",
};

export interface DbCategory {
  id: string;
  name: string;
}

export interface CategoryItem {
  id: string;
  name: string;
}

export const DEFAULT_CATEGORY_ITEMS: CategoryItem[] = [
  { id: "espresso", name: "Espresso" },
  { id: "cold", name: "Cold" },
  { id: "pastry", name: "Pastry" },
  { id: "bowls", name: "Bowls" },
];

export interface DbProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  color: MenuItem["color"];
  is_available: boolean;
}

export interface DbOrder {
  id: string;
  order_number: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_method: PaymentMethod;
  status: "paid" | "cancelled";
  created_at: string;
  cancelled_at: string | null;
  cashier?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  total: number;
}

/**
 * Fetch all categories from Supabase
 */
export async function fetchCategories(): Promise<CategoryItem[]> {
  if (!isSupabaseConfigured) return DEFAULT_CATEGORY_ITEMS;

  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch categories from Supabase:", error);
    return DEFAULT_CATEGORY_ITEMS;
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return DEFAULT_CATEGORY_ITEMS;
  }

  return data as CategoryItem[];
}

/**
 * Create a new category in Supabase
 */
export async function createCategoryInDb(name: string): Promise<CategoryItem> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Category name cannot be empty");
  }

  const slug =
    trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `cat-${Date.now()}`;

  if (!isSupabaseConfigured) {
    return { id: slug, name: trimmed };
  }

  // Check if a category with this name or slug already exists
  const { data: existing } = await supabase
    .from("categories")
    .select("id, name")
    .or(`id.eq.${slug},name.ilike.${trimmed}`)
    .maybeSingle();

  if (existing) {
    throw new Error(`A category named "${existing.name}" already exists`);
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      id: slug,
      name: trimmed,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id, name")
    .single();

  if (error || !data) {
    console.error("Failed to create category in Supabase:", error);
    throw error || new Error("Failed to create category");
  }

  return data as CategoryItem;
}

/**
 * Delete a category in Supabase (Guarded against orphaned products)
 */
export async function deleteCategoryInDb(categoryIdOrName: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  // Resolve category by ID or name
  const { data: cat } = await supabase
    .from("categories")
    .select("id, name")
    .or(`id.eq.${categoryIdOrName},name.ilike.${categoryIdOrName}`)
    .maybeSingle();

  const targetId = cat ? cat.id : categoryIdOrName;
  const catName = cat ? cat.name : categoryIdOrName;

  // 1. Guard check: ensure no products are assigned to this category
  const { data: products, error: checkError } = await supabase
    .from("products")
    .select("id, name")
    .eq("category_id", targetId);

  if (checkError) {
    console.error("Failed to check products for category:", checkError);
    throw checkError;
  }

  if (products && products.length > 0) {
    const names = products
      .map((p) => p.name)
      .slice(0, 3)
      .join(", ");
    const more = products.length > 3 ? ` and ${products.length - 3} more` : "";
    throw new Error(
      `Cannot delete category "${catName}": ${products.length} product${products.length > 1 ? "s" : ""} (${names}${more}) still belong to it. Please reassign or delete these items first.`,
    );
  }

  // 2. Perform delete
  const { error } = await supabase.from("categories").delete().eq("id", targetId);
  if (error) {
    console.error("Failed to delete category:", error);
    throw error;
  }
}

/**
 * Fetch all categories and products from Supabase.
 * If empty and configured, seed initial DEFAULT_MENU.
 */
export async function fetchProducts(): Promise<MenuItem[]> {
  if (!isSupabaseConfigured) return [];

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, description, price, category_id, color, is_available, categories(id, name)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch products from Supabase:", error);
    throw error;
  }

  // If table is completely empty, automatically seed with DEFAULT_MENU
  if (!products || !Array.isArray(products) || products.length === 0) {
    return await seedInitialMenu();
  }

  return (products as any[]).map((p) => ({
    id: p.id,
    name: p.name,
    note: p.description || "",
    price: Number(p.price),
    category: p.categories?.name || p.category_id || "Espresso",
    color: p.color || "lemon",
    available: Boolean(p.is_available),
  }));
}

/**
 * Seed initial DEFAULT_MENU into Supabase if empty
 */
export async function seedInitialMenu(): Promise<MenuItem[]> {
  if (!isSupabaseConfigured) return DEFAULT_MENU;

  // 1. Ensure categories exist
  const categoriesToInsert = [
    { id: "espresso", name: "Espresso" },
    { id: "cold", name: "Cold" },
    { id: "pastry", name: "Pastry" },
    { id: "bowls", name: "Bowls" },
  ];

  await supabase.from("categories").upsert(categoriesToInsert, { onConflict: "id" });

  // 2. Insert default products
  const productsToInsert = DEFAULT_MENU.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.note,
    price: item.price,
    category_id: item.category.toLowerCase(),
    color: item.color,
    is_available: item.available,
  }));

  const { data, error } = await supabase
    .from("products")
    .upsert(productsToInsert, { onConflict: "id" })
    .select("id, name, description, price, category_id, color, is_available, categories(id, name)");

  if (error || !data || !Array.isArray(data)) {
    if (error) console.error("Error seeding initial menu:", error);
    return DEFAULT_MENU;
  }

  return (data as any[]).map((p) => ({
    id: p.id,
    name: p.name,
    note: p.description || "",
    price: Number(p.price),
    category: p.categories?.name || p.category_id || "Espresso",
    color: p.color || "lemon",
    available: Boolean(p.is_available),
  }));
}

/**
 * Upsert product in Supabase
 */
export async function saveProduct(item: MenuItem): Promise<void> {
  if (!isSupabaseConfigured) return;

  const categoryName = item.category.trim();
  let categorySlug =
    categoryName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "espresso";

  // Check if categories table has this category; if not, ensure it exists so foreign key is satisfied
  const { data: existingCat } = await supabase
    .from("categories")
    .select("id, name")
    .or(`id.eq.${categorySlug},name.ilike.${categoryName}`)
    .maybeSingle();

  if (existingCat) {
    categorySlug = existingCat.id;
  } else {
    // Upsert the new category to ensure FK satisfaction
    await supabase.from("categories").upsert(
      {
        id: categorySlug,
        name: categoryName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  }

  const { error } = await supabase.from("products").upsert(
    {
      id: item.id,
      name: item.name,
      description: item.note,
      price: item.price,
      category_id: categorySlug,
      color: item.color,
      is_available: item.available,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Failed to save product:", error);
    throw error;
  }
}

/**
 * Toggle product availability
 */
export async function toggleProductAvailability(id: string, available: boolean): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from("products")
    .update({ is_available: available, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Failed to toggle product availability:", error);
    throw error;
  }
}

/**
 * Delete product from Supabase (Historical order items have ON DELETE SET NULL or preserved snapshots)
 */
export async function deleteProduct(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    console.error("Failed to delete product:", error);
    throw error;
  }
}

/**
 * Fetch all orders with their order items snapshot
 */
export async function fetchOrders(): Promise<Order[]> {
  if (!isSupabaseConfigured) return [];

  let queryResult = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      subtotal,
      tax,
      total,
      payment_method,
      status,
      cashier,
      customer_name,
      customer_phone,
      created_at,
      cancelled_at,
      order_items (
        id,
        product_name,
        unit_price,
        quantity,
        total
      )
    `,
    )
    .order("created_at", { ascending: false });

  // If customer_name or cashier column doesn't exist yet in remote schema, retry with basic query
  if (
    queryResult.error &&
    (queryResult.error.code === "42703" ||
      queryResult.error.code === "PGRST204" ||
      queryResult.error.message?.includes("column"))
  ) {
    queryResult = await supabase
      .from("orders")
      .select(
        `
        id,
        order_number,
        subtotal,
        tax,
        total,
        payment_method,
        status,
        created_at,
        cancelled_at,
        order_items (
          id,
          product_name,
          unit_price,
          quantity,
          total
        )
      `,
      )
      .order("created_at", { ascending: false });
  }

  const { data, error } = queryResult;

  if (error) {
    console.error("Failed to fetch orders:", error);
    throw error;
  }

  if (!data) return [];

  return data.map((o: any) => {
    const subtotal = Number(o.subtotal);
    const invoiceNum = o.order_number
      ? `FUWA-${new Date(o.created_at).getFullYear()}-${o.order_number.replace(/^A-/, "").padStart(3, "0")}`
      : undefined;

    return {
      id: o.id,
      number: o.order_number,
      invoiceNumber: invoiceNum,
      createdAt: new Date(o.created_at).getTime(),
      lines: (o.order_items || []).map((item: any) => ({
        name: item.product_name,
        price: Number(item.unit_price),
        qty: item.quantity,
      })),
      subtotal,
      tax: 0,
      cgst: 0,
      sgst: 0,
      total: Number(o.total),
      payment: o.payment_method,
      status: o.status,
      cashier: o.cashier || SHOP_INFO.cashierName,
      customerName: o.customer_name || undefined,
      customerPhone: o.customer_phone || undefined,
    };
  });
}

/**
 * Generate a database-safe unique order number in format A-001, A-002, etc.
 */
async function generateNextOrderNumber(): Promise<string> {
  // First try PostgreSQL RPC if function exists
  const { data, error } = await supabase.rpc("generate_order_number");
  if (!error && data) {
    return data as string;
  }

  // Fallback: Query the latest order number from orders table
  const { data: latest } = await supabase
    .from("orders")
    .select("order_number")
    .order("created_at", { ascending: false })
    .limit(1);

  if (latest && latest.length > 0 && latest[0].order_number) {
    const match = latest[0].order_number.match(/A-(\d+)/);
    if (match && match[1]) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `A-${String(nextNum).padStart(3, "0")}`;
    }
  }

  return "A-001";
}

/**
 * Create order and snapshot line items in Supabase
 */
export async function createOrder(
  lines: { item: MenuItem; qty: number }[],
  payment: PaymentMethod,
  discount: number = 0,
  cashier: string = "Cashier",
  customerName?: string,
  customerPhone?: string,
): Promise<Order> {
  if (lines.length === 0) {
    throw new Error("Cannot create an empty order");
  }

  const grossSubtotal = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const validDiscount = Math.min(Math.max(0, discount), grossSubtotal);
  const total = Math.round((grossSubtotal - validDiscount) * 100) / 100;
  const tax = 0;
  const cgst = 0;
  const sgst = 0;

  const orderId = `o-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const orderNumber = isSupabaseConfigured
    ? await generateNextOrderNumber()
    : `A-${Date.now().toString().slice(-3)}`;

  const currentYear = new Date().getFullYear();
  const invoiceNumber = `FUWA-${currentYear}-${orderNumber.replace(/^A-/, "").padStart(3, "0")}`;

  const cleanCustomerName = customerName?.trim() || undefined;
  const cleanCustomerPhone = customerPhone?.trim() || undefined;

  if (isSupabaseConfigured) {
    // Security check: verify current authenticated user is active
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        throw new Error(
          "Staff account is deactivated. You cannot submit orders.",
        );
      }
    }

    // 1. Insert order record
    const orderPayload: any = {
      id: orderId,
      order_number: orderNumber,
      subtotal: Math.round(grossSubtotal * 100) / 100,
      tax: 0,
      total: total,
      payment_method: payment,
      status: "paid",
      created_at: new Date().toISOString(),
      cashier: cashier,
      customer_name: cleanCustomerName || "",
      customer_phone: cleanCustomerPhone || "",
    };

    let { error: orderError } = await supabase.from("orders").insert(orderPayload);

    // If customer or cashier columns do not exist in older DB schema, retry without them
    if (
      orderError &&
      (orderError.code === "42703" ||
        orderError.code === "PGRST204" ||
        orderError.message?.includes("customer") ||
        orderError.message?.includes("cashier") ||
        orderError.message?.includes("column"))
    ) {
      delete orderPayload.customer_name;
      delete orderPayload.customer_phone;
      const retryResult = await supabase.from("orders").insert(orderPayload);
      orderError = retryResult.error;

      if (
        orderError &&
        (orderError.code === "42703" ||
          orderError.code === "PGRST204" ||
          orderError.message?.includes("cashier"))
      ) {
        delete orderPayload.cashier;
        const retryResult2 = await supabase.from("orders").insert(orderPayload);
        orderError = retryResult2.error;
      }
    }

    // If existing database has legacy constraint only allowing ('cash', 'card'), gracefully retry
    if (
      orderError &&
      (orderError.code === "23514" ||
        orderError.message?.includes("orders_payment_method_check")) &&
      payment === "upi"
    ) {
      console.warn(
        "Retrying order insertion with fallback payment method for legacy database constraint...",
      );
      orderPayload.payment_method = "card";
      const retryResult = await supabase.from("orders").insert(orderPayload);
      orderError = retryResult.error;
    }

    if (orderError) {
      console.error("Order creation failed in Supabase:", orderError);
      throw orderError;
    }

    // 2. Insert snapshot order_items
    const orderItemsToInsert = lines.map((l) => ({
      order_id: orderId,
      product_id: l.item.id,
      product_name: l.item.name,
      unit_price: l.item.price,
      quantity: l.qty,
      total: Math.round(l.item.price * l.qty * 100) / 100,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItemsToInsert);

    if (itemsError) {
      console.error("Order items insertion failed:", itemsError);
    }
  }

  const orderLines: OrderLine[] = lines.map((l) => ({
    name: l.item.name,
    price: l.item.price,
    qty: l.qty,
  }));

  return {
    id: orderId,
    number: orderNumber,
    invoiceNumber,
    createdAt: Date.now(),
    lines: orderLines,
    subtotal: grossSubtotal,
    discount: validDiscount,
    cgst,
    sgst,
    tax,
    total,
    payment,
    status: "paid",
    cashier: cashier,
    customerName: cleanCustomerName,
    customerPhone: cleanCustomerPhone,
  };
}

/**
 * Cancel an order in Supabase
 */
export async function cancelOrderInDb(orderId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      throw new Error(
        "Staff account is deactivated. You cannot cancel orders.",
      );
    }
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    console.error("Failed to cancel order in Supabase:", error);
    throw error;
  }
}

/**
 * Fetch orders by date range from Supabase.
 * If startDate and/or endDate are provided, queries only orders within range.
 */
export async function fetchOrdersByRange(
  startDate?: Date | null,
  endDate?: Date | null,
): Promise<Order[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      subtotal,
      tax,
      total,
      payment_method,
      status,
      cashier,
      customer_name,
      customer_phone,
      created_at,
      cancelled_at,
      order_items (
        id,
        product_name,
        unit_price,
        quantity,
        total
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(10000);

  if (startDate) {
    query = query.gte("created_at", startDate.toISOString());
  }
  if (endDate) {
    query = query.lte("created_at", endDate.toISOString());
  }

  let { data, error } = await query;

  // Fallback query if customer_name or cashier column missing
  if (
    error &&
    (error.code === "42703" ||
      error.code === "PGRST204" ||
      error.message?.includes("column"))
  ) {
    let fallbackQuery = supabase
      .from("orders")
      .select(
        `
        id,
        order_number,
        subtotal,
        tax,
        total,
        payment_method,
        status,
        created_at,
        cancelled_at,
        order_items (
          id,
          product_name,
          unit_price,
          quantity,
          total
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(10000);

    if (startDate) {
      fallbackQuery = fallbackQuery.gte("created_at", startDate.toISOString());
    }
    if (endDate) {
      fallbackQuery = fallbackQuery.lte("created_at", endDate.toISOString());
    }
    const fallbackRes = await fallbackQuery;
    data = fallbackRes.data;
    error = fallbackRes.error;
  }

  if (error) {
    console.error("Failed to fetch orders by range from Supabase:", error);
    throw error;
  }

  if (!data) return [];

  return data.map((rawOrder) => {
    const o = rawOrder as DbOrder & {
      cashier?: string;
      customer_name?: string | null;
      customer_phone?: string | null;
      order_items?: DbOrderItem[];
    };
    const subtotal = Number(o.subtotal);
    const invoiceNum = o.order_number
      ? `FUWA-${new Date(o.created_at).getFullYear()}-${o.order_number.replace(/^A-/, "").padStart(3, "0")}`
      : undefined;

    return {
      id: o.id,
      number: o.order_number,
      invoiceNumber: invoiceNum,
      createdAt: new Date(o.created_at).getTime(),
      lines: (o.order_items || []).map((item) => ({
        name: item.product_name,
        price: Number(item.unit_price),
        qty: item.quantity,
      })),
      subtotal,
      tax: 0,
      cgst: 0,
      sgst: 0,
      total: Number(o.total),
      payment: o.payment_method,
      status: o.status,
      cashier: o.cashier || SHOP_INFO.cashierName,
      customerName: o.customer_name || undefined,
      customerPhone: o.customer_phone || undefined,
    };
  });
}
