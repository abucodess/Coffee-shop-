import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Link, Navigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type UserRole = "admin" | "staff";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Fetch user profile row from public.profiles.
 */
async function fetchProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, is_active")
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.warn("[Auth] Profile fetch failed:", error?.message);
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name || "",
      role: (data.role === "admin" ? "admin" : "staff") as UserRole,
      is_active: data.is_active !== false,
    };
  } catch (err) {
    console.warn("[Auth] Profile fetch error:", err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id);
      if (p && !p.is_active) {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        return;
      }
      setProfile(p);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Fetch current active session (from persistent storage)
    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession }, error }) => {
        if (!isMounted) return;
        if (error) {
          console.warn("[Auth] Failed to restore session:", error.message);
        }

        if (initialSession?.user) {
          const p = await fetchProfile(initialSession.user.id);
          if (!isMounted) return;

          // If user account is deactivated, invalidate session immediately
          if (p && !p.is_active) {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }

          setProfile(p);
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("[Auth] Session recovery error:", err);
        setLoading(false);
      });

    // 2. Listen to ongoing auth state transitions (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;

      if (newSession?.user) {
        const p = await fetchProfile(newSession.user.id);
        if (!isMounted) return;

        if (p && !p.is_active) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setProfile(p);
      } else {
        setProfile(null);
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (
    email: string,
    password: string,
  ): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        let message = "Invalid email or password.";
        const raw = error.message?.toLowerCase() ?? "";
        if (!raw.includes("invalid login credentials")) {
          if (raw.includes("email not confirmed")) {
            message = "Please confirm your email before signing in.";
          } else if (raw.includes("rate limit") || raw.includes("too many requests")) {
            message = "Too many attempts. Please wait a moment and try again.";
          } else if (raw.includes("network") || raw.includes("failed to fetch")) {
            message = "Network connection issue. Please check your internet and try again.";
          } else {
            message = error.message;
          }
        }
        return { error: message };
      }

      // Check if the user profile exists and whether account is active
      if (data.user) {
        const p = await fetchProfile(data.user.id);
        if (p && !p.is_active) {
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setProfile(null);
          return {
            error:
              "This staff account has been deactivated. Please contact an administrator.",
          };
        }
        setProfile(p);
      }

      setUser(data.user);
      setSession(data.session);
      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to sign in. Please try again.";
      return { error: message };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[Auth] Sign out error:", err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
    }
  };

  const isAdmin = profile?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signOut,
        isConfigured: isSupabaseConfigured,
        isAdmin,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="relative flex size-14 items-center justify-center rounded-2xl bg-coffee shadow-card">
          <img
            src="/logo.png"
            alt="Mocha Counter"
            className="size-10 object-contain animate-pulse"
          />
        </div>
        <div className="space-y-1">
          <div className="text-base font-extrabold tracking-tight text-ink">
            Mocha Counter
          </div>
          <div className="font-mono text-xs text-ink-soft">
            Checking counter session…
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * Route guard for admin-only pages.
 * Shows access restricted state if user is staff or unauthenticated.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="relative flex size-14 items-center justify-center rounded-2xl bg-coffee shadow-card">
          <img
            src="/logo.png"
            alt="Mocha Counter"
            className="size-10 object-contain animate-pulse"
          />
        </div>
        <div className="space-y-1">
          <div className="text-base font-extrabold tracking-tight text-ink">
            Mocha Counter
          </div>
          <div className="font-mono text-xs text-ink-soft">
            Verifying permissions…
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-tomato/10 text-tomato">
          <ShieldAlert className="size-8" />
        </div>
        <div className="space-y-1">
          <div className="text-xl font-extrabold tracking-tight text-ink">
            Access Restricted
          </div>
          <p className="max-w-sm text-sm text-ink-soft">
            This section is reserved for Café Administrators. Your staff account does
            not have permission to view or manage this page.
          </p>
        </div>
        <Link
          to="/"
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-coffee px-5 py-2.5 text-sm font-bold text-paper shadow-card transition-colors hover:bg-ink"
        >
          Back to Billing
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
