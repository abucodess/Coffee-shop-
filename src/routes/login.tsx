import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail, AlertCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — FUWA Japanese Fluffy Desserts POS" },
      {
        name: "description",
        content: "Sign in to the FUWA Japanese Fluffy Desserts counter POS.",
      },
      { property: "og:title", content: "Sign In — FUWA Japanese Fluffy Desserts POS" },
      {
        property: "og:description",
        content: "Sign in to the FUWA Japanese Fluffy Desserts counter POS.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, profile, loading: authLoading, signIn, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string | undefined;
    password?: string | undefined;
  }>({});

  // If already authenticated with active account, redirect to counter home
  if (user && profile?.is_active) {
    return <Navigate to="/" replace />;
  }

  // Loading existing session
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-fuwa-cream px-4 text-center">
        <div className="relative flex size-16 items-center justify-center rounded-2xl bg-fuwa-surface p-2 shadow-card ring-1 ring-fuwa-orange/30">
          <img
            src="/logo-sm.png"
            srcSet="/logo-sm.png 128w, /logo-md.png 256w"
            sizes="64px"
            width="64"
            height="64"
            alt="FUWA Japanese Fluffy Desserts"
            className="size-12 object-contain animate-pulse"
          />
        </div>
        <div className="mt-4 space-y-1">
          <div className="text-xl font-black tracking-tight text-fuwa-brown">FUWA</div>
          <div className="font-mono text-xs text-fuwa-brown/65">Checking counter session…</div>
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
    <div className="flex min-h-screen flex-col bg-fuwa-cream text-fuwa-brown lg:flex-row">
      {/* Decorative / Brand Visual Section */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-fuwa-brown px-6 py-10 text-fuwa-cream sm:px-10 lg:w-1/2 lg:min-h-screen lg:p-14">
        {/* Subtle Ambient Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-fuwa-orange/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-black/40 blur-2xl"
        />

        {/* Top Branding */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="grid size-12 place-items-center rounded-2xl bg-fuwa-surface p-1.5 shadow-card ring-1 ring-fuwa-orange/30 sm:size-14">
            <img
              src="/logo-md.png"
              srcSet="/logo-sm.png 128w, /logo-md.png 256w, /logo-lg.png 512w"
              sizes="(max-width: 640px) 48px, (max-width: 1024px) 56px, 64px"
              width="56"
              height="56"
              alt="FUWA Japanese Fluffy Desserts"
              loading="eager"
              decoding="async"
              className="size-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black tracking-tight text-white">FUWA</span>
              <span className="text-xs font-black uppercase tracking-widest text-fuwa-orange">
                ふわふわ
              </span>
            </div>
            <div className="font-mono text-[11px] font-semibold text-fuwa-cream/70">
              Japanese Fluffy Desserts · POS Counter
            </div>
          </div>
        </div>

        {/* Center café showcase - visible on desktop & tablet */}
        <div className="relative z-10 my-10 hidden space-y-6 lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-fuwa-orange/30 bg-fuwa-orange/15 px-3.5 py-1 text-xs font-extrabold text-fuwa-orange-bright">
            <Sparkles className="size-3.5 text-fuwa-orange" />
            <span>Artisan Dessert Station</span>
          </div>

          <h1 className="max-w-md text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
            Fluffy, Warm & Handcrafted.
          </h1>

          <p className="max-w-md text-sm leading-relaxed text-fuwa-cream/80">
            High-speed tablet billing for Japanese Soufflé Pancakes, Dorayaki, ceremonial matcha,
            and specialty desserts with live inventory, thermal receipts, and real-time syncing.
          </p>

          <div className="grid max-w-sm grid-cols-2 gap-3 pt-2 font-mono text-xs">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <div className="text-lg font-black text-fuwa-orange">Touch-First</div>
              <div className="mt-0.5 text-fuwa-cream/70">Fast counter workflow</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <div className="text-lg font-black text-white">Instant</div>
              <div className="mt-0.5 text-fuwa-cream/70">Thermal bills & reports</div>
            </div>
          </div>
        </div>

        {/* Mobile-only tagline */}
        <div className="relative z-10 mt-6 lg:hidden">
          <p className="text-sm font-semibold text-fuwa-cream/80">
            Touch-friendly POS for Japanese Fluffy Desserts.
          </p>
        </div>

        {/* Footer info */}
        <div className="relative z-10 pt-4 font-mono text-xs text-fuwa-cream/60">
          <div>FUWA Japanese Fluffy Desserts POS · Secured with Supabase</div>
        </div>
      </div>

      {/* Login Card Section */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:p-14">
        <div className="w-full max-w-md space-y-6 rounded-3xl border border-fuwa-brown/10 bg-fuwa-surface p-6 sm:p-8 shadow-card-lg backdrop-blur-xs">
          {/* Header */}
          <div className="space-y-1.5">
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-fuwa-orange">
              Counter Access
            </div>
            <h2 className="text-2xl font-black tracking-tight text-fuwa-brown sm:text-3xl">
              Welcome back
            </h2>
            <p className="text-xs sm:text-sm text-fuwa-brown/65">
              Sign in to start billing orders on the counter tablet.
            </p>
          </div>

          {/* Offline / Supabase Not Configured Warning */}
          {!isConfigured && (
            <div className="rounded-xl border border-fuwa-orange/30 bg-fuwa-cream/50 p-3.5 text-xs text-fuwa-brown">
              <div className="font-bold text-fuwa-orange">Setup Note:</div>
              <div className="mt-0.5 text-fuwa-brown/80">
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
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 font-bold"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-fuwa-brown"
              >
                Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-fuwa-brown/50">
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
                  placeholder="staff@fuwadesserts.com"
                  className={`w-full rounded-xl border bg-fuwa-surface py-2.5 pl-10 pr-3.5 font-medium text-fuwa-brown transition-all placeholder:text-fuwa-brown/40 focus:outline-hidden focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    fieldErrors.email
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-fuwa-brown/20 focus:border-fuwa-orange focus:ring-fuwa-orange/20"
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="font-mono text-xs font-medium text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-fuwa-brown"
              >
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-fuwa-brown/50">
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
                  className={`w-full rounded-xl border bg-fuwa-surface py-2.5 pl-10 pr-10 font-medium text-fuwa-brown transition-all placeholder:text-fuwa-brown/40 focus:outline-hidden focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    fieldErrors.password
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-fuwa-brown/20 focus:border-fuwa-orange focus:ring-fuwa-orange/20"
                  }`}
                />
                <button
                  type="button"
                  tabIndex={0}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-fuwa-brown/50 hover:text-fuwa-brown focus:outline-hidden"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="font-mono text-xs font-medium text-red-600">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || authLoading}
                className="relative flex w-full items-center justify-center gap-2 rounded-xl bg-fuwa-orange px-4 py-3 text-sm font-extrabold text-white shadow-card transition-all hover:bg-fuwa-orange-bright active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-white" />
                    <span>Signing in to counter…</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </div>
          </form>

          {/* Quick Info */}
          <div className="rounded-xl border border-fuwa-brown/10 bg-fuwa-cream/40 p-3.5 text-center font-mono text-xs text-fuwa-brown/65">
            <span className="font-bold text-fuwa-brown">FUWA POS</span> · Front of House Counter
          </div>
        </div>
      </div>
    </div>
  );
}
