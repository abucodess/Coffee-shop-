// Supabase Edge Function: create-staff-user
// Secure administrative creation of staff accounts.
//
// This function runs server-side in the Supabase Deno runtime.
// The SUPABASE_SERVICE_ROLE_KEY is injected automatically by Supabase.
// It is NEVER exposed to the frontend / client browser.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[create-staff-user] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({
          error:
            "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing on Edge Function runtime.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Validate caller authentication from the Bearer token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create client scoped to caller's JWT to inspect caller identity
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid session or token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Create admin client with service-role key to verify caller role & perform admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile, error: profileCheckError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (profileCheckError || callerProfile?.role !== "admin") {
      return new Response(
        JSON.stringify({
          error: "Forbidden: Only administrators can create staff accounts.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Parse payload
    const body = await req.json().catch(() => ({}));
    const { email, password, full_name } = body;

    const trimmedEmail = (email ?? "").trim().toLowerCase();
    const trimmedName = (full_name ?? "").trim();
    const rawPassword = password ?? "";

    // Validation
    if (!trimmedEmail) {
      return new Response(
        JSON.stringify({ error: "Email is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return new Response(
        JSON.stringify({ error: "Please provide a valid email address." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!rawPassword || rawPassword.length < 6) {
      return new Response(
        JSON.stringify({
          error: "Password must be at least 6 characters long.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 5. Use Supabase Admin Auth API to create auth.users record
    // Auto-confirm the email so staff can immediately log in at the counter
    const { data: newAuthData, error: createAuthError } =
      await adminClient.auth.admin.createUser({
        email: trimmedEmail,
        password: rawPassword,
        email_confirm: true,
        user_metadata: {
          full_name: trimmedName,
          role: "staff",
        },
      });

    if (createAuthError) {
      console.error("[create-staff-user] Auth creation error:", createAuthError.message);
      return new Response(
        JSON.stringify({ error: createAuthError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const createdUserId = newAuthData.user?.id;
    if (!createdUserId) {
      return new Response(
        JSON.stringify({ error: "Failed to generate user record." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 6. Ensure profile row exists and has role='staff' and is_active=true
    const { error: profileUpsertError } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: createdUserId,
          email: trimmedEmail,
          full_name: trimmedName,
          role: "staff",
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (profileUpsertError) {
      console.warn(
        "[create-staff-user] Warning: Profile upsert error (trigger may have already populated it):",
        profileUpsertError.message,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: createdUserId,
          email: trimmedEmail,
          full_name: trimmedName,
          role: "staff",
          is_active: true,
        },
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[create-staff-user] Uncaught error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
