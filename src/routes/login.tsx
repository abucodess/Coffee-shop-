import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail, AlertCircle, Coffee } from "lucide-react";
import { useAuth } from "@/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Mocha Counter POS" },
      {
        name: "description",
        content: "Sign in to your Mocha Counter point of sale.",
      },
      { property: "og:title", content: "Sign In — Mocha Counter POS" },
      {
        property: "og:description",
        content: "Sign in to your Mocha Counter point of sale.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading: authLoading, signIn, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // If already authenticated, redirect to counter home
  if (user) {
    return <Navigate to="/" replace />;
  }

  // Loading existing session
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 text-center">
        <div className="relative flex size-14 items-center justify-center rounded-2xl bg-coffee shadow-card">
          <img
            src="/logo.png"
            alt="Mocha Counter"
            className="size-10 object-contain animate-pulse"
          />
        </div>
        <div className="mt-4 space-y-1">
          <div className="text-lg font-extrabold tracking-tight text-ink">Mocha Counter</div>
          <div className="font-mono text-xs text-ink-soft">Checking counter session…</div>
        </div>
      </div>
    );
  }

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = "Please enter a valid email address";
    }

    if (!password) {
      errs.password = "Password is required";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
        setIsSubmitting(false);
      } else {
        // Successful login: navigate to POS
        navigate({ to: "/", replace: true });
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink lg:flex-row">
      {/* Decorative / Brand Visual Section */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-coffee px-6 py-10 text-cream sm:px-10 lg:w-1/2 lg:min-h-screen lg:p-14">
        {/* Subtle Café Ambient Pattern */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-amber/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-ink/40 blur-2xl"
        />

        {/* Top Branding */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="grid size-12 place-items-center rounded-2xl bg-paper/10 p-1.5 ring-1 ring-white/15 backdrop-blur-xs">
            <img src="/logo.png" alt="Mocha Counter Emblem" className="size-full object-contain" />
          </div>
          <div>
            <div className="text-xl font-black tracking-tight text-paper">Mocha Counter</div>
            <div className="font-mono text-[11px] font-semibold text-cream/70">
              Front of House POS
            </div>
          </div>
        </div>

        {/* Center café showcase - visible on desktop & tablet */}
        <div className="relative z-10 my-10 hidden space-y-6 lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-3.5 py-1 text-xs font-semibold text-amber">
            <Coffee className="size-3.5" />
            <span>Barista & Counter Station</span>
          </div>

          <h1 className="max-w-md text-3xl font-black leading-tight tracking-tight text-paper sm:text-4xl">
            Simple. Fast. Made for Coffee Shops.
          </h1>

          <p className="max-w-md text-sm leading-relaxed text-cream/80">
            Speed through morning rushes with intuitive one-touch billing, instant item
            modifiers, live sales analytics, and reliable Supabase-powered counter sync.
          </p>

          <div className="grid max-w-sm grid-cols-2 gap-3 pt-2 font-mono text-xs">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
              <div className="text-lg font-bold text-amber">₹0 Friction</div>
              <div className="mt-0.5 text-cream/70">One-tap order entry</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
              <div className="text-lg font-bold text-paper">Instant</div>
              <div className="mt-0.5 text-cream/70">Digital & cash receipts</div>
            </div>
          </div>
        </div>

        {/* Mobile-only tagline */}
        <div className="relative z-10 mt-6 lg:hidden">
          <p className="text-sm font-semibold text-cream/80">
            Simple. Fast. Made for Coffee Shops.
          </p>
        </div>

        {/* Footer info */}
        <div className="relative z-10 pt-4 font-mono text-xs text-cream/60">
          <div>Mocha Counter POS · Secured with Supabase Auth</div>
        </div>
      </div>

      {/* Login Card Section */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:p-14">
        <div className="w-full max-w-md space-y-6 rounded-3xl border border-ink/10 bg-paper/90 p-6 sm:p-8 shadow-card-lg backdrop-blur-xs">
          {/* Header */}
          <div className="space-y-1.5">
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-amber-deep">
              Counter Access
            </div>
            <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
              Welcome back
            </h2>
            <p className="text-sm text-ink-soft">
              Sign in to continue to your counter and start taking orders.
            </p>
          </div>

          {/* Offline / Supabase Not Configured Warning */}
          {!isConfigured && (
            <div className="rounded-xl border border-amber/40 bg-lemon/60 p-3.5 text-xs text-ink">
              <div className="font-bold text-amber-deep">Setup Note:</div>
              <div>
                Supabase credentials are not detected in your environment. Provide valid{" "}
                <code className="font-mono text-[11px] font-bold">VITE_SUPABASE_URL</code> and{" "}
                <code className="font-mono text-[11px] font-bold">VITE_SUPABASE_ANON_KEY</code> to
                authenticate with your live database.
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-tomato/30 bg-tomato/10 p-3.5 text-sm text-tomato"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-ink"
              >
                Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-soft">
                  <Mail className="size-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  disabled={isSubmitting}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  placeholder="barista@cafemocha.com"
                  className={`w-full rounded-xl border bg-paper py-2.5 pl-10 pr-3.5 font-medium text-ink transition-all placeholder:text-ink-soft/50 focus:outline-hidden focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    fieldErrors.email
                      ? "border-tomato focus:border-tomato focus:ring-tomato/20"
                      : "border-ink/20 focus:border-coffee focus:ring-amber/30"
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="font-mono text-xs font-medium text-tomato">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-ink"
              >
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-soft">
                  <Lock className="size-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border bg-paper py-2.5 pl-10 pr-10 font-medium text-ink transition-all placeholder:text-ink-soft/50 focus:outline-hidden focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    fieldErrors.password
                      ? "border-tomato focus:border-tomato focus:ring-tomato/20"
                      : "border-ink/20 focus:border-coffee focus:ring-amber/30"
                  }`}
                />
                <button
                  type="button"
                  tabIndex={0}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink-soft hover:text-ink focus:outline-hidden"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="font-mono text-xs font-medium text-tomato">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || authLoading}
                className="relative flex w-full items-center justify-center gap-2 rounded-xl bg-coffee px-4 py-3 text-sm font-bold text-paper shadow-card transition-all hover:bg-ink active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-amber" />
                    <span>Signing in to counter…</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </div>
          </form>

          {/* Quick Info */}
          <div className="rounded-xl border border-ink/10 bg-paper/60 p-4 text-center font-mono text-xs text-ink-soft">
            <span className="font-bold text-ink">Mocha Counter POS</span> · Staff & Barista Station
          </div>
        </div>
      </div>
    </div>
  );
}
