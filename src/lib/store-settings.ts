import { useSyncExternalStore } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";

export interface StoreSettings {
  name: string;
  address: string;
  logoUrl: string | null;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  name: "FUWA Japanese Fluffy Desserts",
  address: "108 Omotesando Avenue, Shibuya\nTokyo - 150-0001",
  logoUrl: "/logo-lg.png",
};

const STORAGE_KEY = "fuwa-store-settings-v1";

function loadLocalSettings(): StoreSettings {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("mocha-store-settings-v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          name: parsed.name?.trim() || DEFAULT_STORE_SETTINGS.name,
          address: parsed.address?.trim() || DEFAULT_STORE_SETTINGS.address,
          logoUrl: parsed.logoUrl || null,
        };
      }
    }
  } catch {
    /* fallback to default */
  }
  return DEFAULT_STORE_SETTINGS;
}

let currentSettings: StoreSettings = loadLocalSettings();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function persistLocal(settings: StoreSettings) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {
    /* ignore storage quota errors */
  }
}

/**
 * Fetch latest store settings from Supabase (or fallback to cached/default)
 */
export async function fetchStoreSettings(): Promise<StoreSettings> {
  if (!isSupabaseConfigured) {
    return currentSettings;
  }

  try {
    const builder = supabase.from("store_settings");
    if (!builder || typeof builder.select !== "function") {
      return currentSettings;
    }

    const selectQuery = builder.select("id, name, address, logo_url");
    if (!selectQuery) return currentSettings;

    const filtered = typeof selectQuery.eq === "function" ? selectQuery.eq("id", "default") : selectQuery;
    const finalPromise = filtered && typeof filtered.maybeSingle === "function" ? filtered.maybeSingle() : filtered;

    const result = await finalPromise;
    const data = result?.data;
    const error = result?.error;

    if (error) {
      // If table doesn't exist yet in Supabase (42P01, PGRST205), fall back to local state
      if (
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("does not exist") ||
        error.message?.includes("schema cache")
      ) {
        return currentSettings;
      }
      console.warn("Failed to fetch store settings from Supabase:", error);
      return currentSettings;
    }

    if (data) {
      const updated: StoreSettings = {
        name: data.name?.trim() || DEFAULT_STORE_SETTINGS.name,
        address: data.address?.trim() || DEFAULT_STORE_SETTINGS.address,
        logoUrl: data.logo_url || null,
      };
      currentSettings = updated;
      persistLocal(updated);
      notify();
      return updated;
    }
  } catch (err) {
    console.warn("Error fetching store settings:", err);
  }

  return currentSettings;
}

/**
 * Save store settings to Supabase and local cache
 */
export async function saveStoreSettings(
  settings: { name: string; address: string; logoUrl?: string | null },
): Promise<StoreSettings> {
  const trimmedName = settings.name.trim();
  if (!trimmedName) {
    throw new Error("Store name cannot be empty.");
  }

  const updated: StoreSettings = {
    name: trimmedName,
    address: settings.address.trim(),
    logoUrl: settings.logoUrl !== undefined ? settings.logoUrl : currentSettings.logoUrl,
  };

  // Immediate optimistic update
  currentSettings = updated;
  persistLocal(updated);
  notify();

  if (isSupabaseConfigured) {
    try {
      const builder = supabase.from("store_settings");
      if (builder && typeof builder.upsert === "function") {
        const { error } = await builder.upsert(
          {
            id: "default",
            name: updated.name,
            address: updated.address,
            logo_url: updated.logoUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

        if (error) {
          // If table doesn't exist in Supabase yet, keep local update intact
          if (
            error.code === "42P01" ||
            error.code === "PGRST205" ||
            error.message?.includes("does not exist") ||
            error.message?.includes("schema cache")
          ) {
            console.warn("store_settings table not found in Supabase. Stored locally.");
          } else {
            console.error("Failed to save store settings to Supabase:", error);
            throw error;
          }
        }
      }
    } catch (err) {
      console.warn("Error during Supabase store settings upsert:", err);
    }
  }

  return updated;
}

export const STORE_ASSETS_BUCKET = "store-assets";

/**
 * Upload a logo image file to Supabase Storage bucket 'store-assets'
 */
export async function uploadStoreLogo(file: File): Promise<string> {
  const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
  if (!validTypes.includes(file.type)) {
    throw new Error("Invalid file type. Please upload a PNG, JPG, or WEBP image.");
  }

  // 2MB size limit
  const MAX_SIZE = 2 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error("File size exceeds 2MB. Please choose a smaller image.");
  }

  if (!isSupabaseConfigured) {
    // If Supabase is not configured, simulate by returning an object URL
    return URL.createObjectURL(file);
  }

  const fileExt = file.name.split(".").pop() || "png";
  const fileName = `store-logo-${Date.now()}.${fileExt}`;
  const filePath = `branding/${fileName}`;

  let { error: uploadError } = await supabase.storage
    .from(STORE_ASSETS_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    const errMsg = (uploadError.message || "").toLowerCase();
    const isBucketNotFound =
      errMsg.includes("bucket not found") ||
      (uploadError as any)?.statusCode === 404 ||
      (uploadError as any)?.statusCode === "404" ||
      (uploadError as any)?.error === "Bucket not found";

    if (isBucketNotFound) {
      // Attempt auto-creation of bucket if permissions allow
      try {
        const { error: createErr } = await supabase.storage.createBucket(STORE_ASSETS_BUCKET, {
          public: true,
        });
        if (!createErr) {
          const retryUpload = await supabase.storage
            .from(STORE_ASSETS_BUCKET)
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: true,
            });
          uploadError = retryUpload.error;
        }
      } catch {
        /* proceed to helpful error message below */
      }
    }

    if (uploadError) {
      console.error("Storage upload failed:", uploadError);

      if (
        uploadError.message?.toLowerCase().includes("bucket not found") ||
        (uploadError as any)?.statusCode === 404 ||
        (uploadError as any)?.statusCode === "404" ||
        (uploadError as any)?.error === "Bucket not found"
      ) {
        throw new Error(
          "Storage bucket 'store-assets' not found in Supabase. Please create the public bucket 'store-assets' in Supabase Dashboard → Storage.",
        );
      }

      if (
        uploadError.message?.toLowerCase().includes("row-level security") ||
        uploadError.message?.toLowerCase().includes("policy") ||
        uploadError.message?.toLowerCase().includes("permission denied")
      ) {
        throw new Error(
          "Permission denied uploading logo: Only administrators can update store assets. Ensure storage RLS policies allow admin uploads.",
        );
      }

      throw new Error(`Failed to upload logo: ${uploadError.message}`);
    }
  }

  const { data: urlData } = supabase.storage
    .from(STORE_ASSETS_BUCKET)
    .getPublicUrl(filePath);

  if (!urlData?.publicUrl) {
    throw new Error("Failed to retrieve public URL for uploaded logo.");
  }

  return urlData.publicUrl;
}

/**
 * Remove an old logo file from Supabase Storage bucket 'store-assets'
 */
export async function deleteStoreLogo(logoUrl: string | null): Promise<void> {
  if (!logoUrl || !isSupabaseConfigured) return;
  try {
    if (logoUrl.includes(`/${STORE_ASSETS_BUCKET}/`)) {
      const match = logoUrl.match(new RegExp(`${STORE_ASSETS_BUCKET}/(.+)$`));
      if (match && match[1]) {
        const rawPath = match[1].split("?")[0];
        const filePath = decodeURIComponent(rawPath);
        const { error } = await supabase.storage.from(STORE_ASSETS_BUCKET).remove([filePath]);
        if (error) {
          console.warn("Could not delete old logo file from storage:", error.message);
        }
      }
    }
  } catch (err) {
    console.warn("Error deleting old logo file from storage:", err);
  }
}

/**
 * React hook to subscribe to store settings
 */
export function useStoreSettings(): StoreSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentSettings,
    () => DEFAULT_STORE_SETTINGS,
  );
}

/**
 * Initialize store settings on app load
 */
let hasInitialized = false;
export function initStoreSettings() {
  if (hasInitialized || typeof window === "undefined") return;
  hasInitialized = true;
  fetchStoreSettings().catch(() => {});
}
