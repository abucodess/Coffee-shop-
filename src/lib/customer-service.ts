import { supabase, isSupabaseConfigured } from "./supabase";
import { sanitizePhoneDigits } from "./pos-data";

export interface CustomerRecord {
  phone: string;
  name: string;
  lastVisited?: number;
}

const CUSTOMERS_STORAGE_KEY = "fuwa-customers-cache-v1";

// High-speed in-memory cache for 0ms synchronous lookups
const inMemoryCache = new Map<string, string>();
let isStorageLoaded = false;

function loadFromStorage() {
  if (isStorageLoaded || typeof localStorage === "undefined") return;
  isStorageLoaded = true;
  try {
    const raw = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (raw) {
      const parsed: Record<string, string> = JSON.parse(raw);
      for (const [phone, name] of Object.entries(parsed)) {
        if (phone && name) {
          inMemoryCache.set(phone, name);
        }
      }
    }
  } catch {
    /* ignore storage errors */
  }
}

function persistCache() {
  if (typeof localStorage === "undefined") return;
  try {
    const obj: Record<string, string> = {};
    inMemoryCache.forEach((name, phone) => {
      obj[phone] = name;
    });
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* storage quota exceeded or unavailable */
  }
}

/**
 * Synchronous instant check for customer in memory cache (0ms)
 */
export function getCachedCustomerName(rawPhone: string): string | null {
  loadFromStorage();
  const phone = sanitizePhoneDigits(rawPhone);
  if (phone.length !== 10) return null;
  return inMemoryCache.get(phone) || null;
}

/**
 * Searches for a customer by 10-digit phone number.
 * Priority:
 * 1. In-memory cache (0ms instant)
 * 2. Supabase 'customers' table
 * 3. Supabase 'orders' table (fallback to past order record)
 */
export async function lookupCustomerByPhone(
  rawPhone: string,
): Promise<{ name: string; phone: string } | null> {
  const phone = sanitizePhoneDigits(rawPhone);
  if (phone.length !== 10) return null;

  loadFromStorage();

  // 1. Instant check in memory
  const cached = inMemoryCache.get(phone);
  if (cached) {
    return { phone, name: cached };
  }

  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    // 2. Query customers table
    const { data: customerData, error: customerErr } = await supabase
      .from("customers")
      .select("name, phone")
      .eq("phone", phone)
      .maybeSingle();

    if (customerData?.name && customerData.name.trim()) {
      const cleanName = customerData.name.trim();
      inMemoryCache.set(phone, cleanName);
      persistCache();
      return { phone, name: cleanName };
    }

    // 3. Fallback: Query past orders table
    const { data: orderData } = await supabase
      .from("orders")
      .select("customer_name")
      .eq("customer_phone", phone)
      .neq("customer_name", "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderData?.customer_name && orderData.customer_name.trim()) {
      const cleanName = orderData.customer_name.trim();
      inMemoryCache.set(phone, cleanName);
      persistCache();
      return { phone, name: cleanName };
    }
  } catch (err) {
    console.warn("Customer lookup query failed:", err);
  }

  return null;
}

/**
 * Stores customer data in Supabase 'customers' table and updates local cache
 */
export async function saveCustomerRecord(rawPhone: string, rawName: string): Promise<void> {
  const phone = sanitizePhoneDigits(rawPhone);
  const name = rawName.trim();
  if (phone.length !== 10 || !name) return;

  // Immediately store in memory and localStorage for 0ms subsequent lookups
  inMemoryCache.set(phone, name);
  persistCache();

  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase.from("customers").upsert(
      {
        phone,
        name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone" },
    );

    if (error && error.code !== "42P01" && error.code !== "PGRST205") {
      // 42P01 / PGRST205 means table does not exist in schema yet, continues gracefully
      console.warn("Failed to upsert customer in Supabase:", error);
    }
  } catch (err) {
    console.warn("Customer persistence error:", err);
  }
}
