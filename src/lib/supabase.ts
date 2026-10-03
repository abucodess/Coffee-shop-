import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl !== "https://your-project.supabase.co",
);

if (!isSupabaseConfigured && typeof window !== "undefined") {
  console.warn(
    "[Supabase] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured yet. Falling back to local offline mode.",
  );
}

// Global Supabase client configured with public/anon key only
export const supabase: SupabaseClient = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
