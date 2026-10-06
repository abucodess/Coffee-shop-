import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  UserPlus,
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  Eye,
  EyeOff,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { AdminRoute, useAuth, type UserProfile } from "@/auth";

function UsersManagementPage() {
  return (
    <AdminRoute>
      <UsersManagement />
    </AdminRoute>
  );
}

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Staff & Users — FUWA Japanese Fluffy Desserts" },
      {
        name: "description",
        content: "Manage FUWA dessert counter staff and administrator permissions.",
      },
      { property: "og:title", content: "Staff & Users — FUWA Japanese Fluffy Desserts" },
      {
        property: "og:description",
        content: "Manage FUWA dessert counter staff and administrator permissions.",
      },
    ],
  }),
  component: UsersManagementPage,
});

interface ProfileRow extends UserProfile {
  created_at?: string;
}

function UsersManagement() {
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Delete User State
  const [userToDelete, setUserToDelete] = useState<ProfileRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string | undefined;
    email?: string | undefined;
    password?: string | undefined;
  }>({});

  const loadProfiles = async () => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured) {
        // Mock fallback if offline/no supabase configured
        setProfiles([
          {
            id: currentUser?.id || "admin-mock-1",
            email: currentUser?.email || "admin@fuwadesserts.com",
            full_name: "Admin Manager",
            role: "admin",
            is_active: true,
            created_at: new Date().toISOString(),
          },
        ]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, is_active, created_at")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to fetch profiles:", error);
        toast.error("Could not load users: " + error.message);
      } else {
        setProfiles(
          (data || []).map((row) => ({
            id: row.id,
            email: row.email,
            full_name: row.full_name || "",
            role: row.role as "admin" | "staff",
            is_active: row.is_active !== false,
            created_at: row.created_at,
          })),
        );
      }
    } catch (err) {
      console.error("Error loading profiles:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleToggleActive = async (profile: ProfileRow) => {
    if (profile.id === currentUser?.id) {
      toast.error("You cannot deactivate your own account.");
      return;
    }

    setTogglingId(profile.id);
    const newStatus = !profile.is_active;

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from("profiles")
          .update({
            is_active: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);

        if (error) {
          throw error;
        }
      }

      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, is_active: newStatus } : p)),
      );

      toast.success(
        `${profile.full_name || profile.email} has been ${
          newStatus ? "activated" : "deactivated"
        }.`,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update account status.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    if (userToDelete.id === currentUser?.id) {
      setDeleteError("You cannot delete your own account.");
      return;
    }

    const remainingActiveAdmins = profiles.filter(
      (p) => p.role === "admin" && p.is_active && p.id !== userToDelete.id,
    ).length;

    if (
      userToDelete.role === "admin" &&
      userToDelete.is_active &&
      remainingActiveAdmins === 0
    ) {
      setDeleteError(
        "Cannot delete this account: It is the last active administrator. Another active administrator must exist.",
      );
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      if (!isSupabaseConfigured) {
        // Offline / mock fallback
        setProfiles((prev) => prev.filter((p) => p.id !== userToDelete.id));
        toast.success(
          `User ${userToDelete.full_name || userToDelete.email} has been permanently deleted.`,
        );
        setUserToDelete(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "delete-staff-user",
        {
          body: { userId: userToDelete.id },
        },
      );

      if (error) {
        let errorMsg = error.message;
        try {
          if (
            (error as any).context &&
            typeof (error as any).context.json === "function"
          ) {
            const body = await (error as any).context.json();
            if (body?.error) {
              errorMsg = body.error;
            }
          }
        } catch {
          // fallback
        }

        if (
          error.message?.includes("Failed to send a request to the Edge Function") ||
          error.message?.includes("404") ||
          error.message?.includes("FunctionsFetchError")
        ) {
          errorMsg =
            "The Supabase Edge Function 'delete-staff-user' is not yet deployed on your Supabase project. Deploy it using 'supabase functions deploy delete-staff-user'.";
        }

        setDeleteError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      if (data?.error) {
        setDeleteError(data.error);
        toast.error(data.error);
        return;
      }

      // Successfully deleted
      setProfiles((prev) => prev.filter((p) => p.id !== userToDelete.id));
      toast.success(
        data?.message ||
          `User ${userToDelete.full_name || userToDelete.email} has been permanently deleted.`,
      );
      setUserToDelete(null);
    } catch (err: any) {
      console.error("Delete user error:", err);
      const msg = err.message || "Failed to delete user.";
      setDeleteError(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const validateForm = () => {
    const errs: { fullName?: string; email?: string; password?: string } = {};
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      errs.fullName = "Full name is required.";
    }

    if (!trimmedEmail) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = "Please enter a valid email address.";
    }

    if (!password) {
      errs.password = "Temporary password is required.";
    } else if (password.length < 6) {
      errs.password = "Password must be at least 6 characters.";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm()) {
      return;
    }

    setIsCreating(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = fullName.trim();

      // Check if user already exists in current list
      if (profiles.some((p) => p.email.toLowerCase() === trimmedEmail)) {
        setFormError("A user with this email address already exists.");
        setIsCreating(false);
        return;
      }

      // Invoke Supabase Edge Function to securely create auth.users and profile record
      const { data, error } = await supabase.functions.invoke("create-staff-user", {
        body: {
          email: trimmedEmail,
          password: password,
          full_name: trimmedName,
        },
      });

      if (error) {
        let errorMsg = error.message;
        // Check for specific Edge Function missing / not deployed hint
        if (
          error.message?.includes("Failed to send a request to the Edge Function") ||
          error.message?.includes("404") ||
          error.message?.includes("FunctionsFetchError")
        ) {
          errorMsg =
            "The Supabase Edge Function 'create-staff-user' is not yet deployed on your Supabase project. Deploy it using 'supabase functions deploy create-staff-user' or create the user in the Supabase Dashboard.";
        }
        setFormError(errorMsg);
        setIsCreating(false);
        return;
      }

      if (data?.error) {
        setFormError(data.error);
        setIsCreating(false);
        return;
      }

      toast.success(`Staff account for ${trimmedName} created successfully!`);

      // Reset form and close modal
      setFullName("");
      setEmail("");
      setPassword("");
      setIsModalOpen(false);

      // Reload updated profiles list
      await loadProfiles();
    } catch (err: any) {
      console.error("Create user error:", err);
      setFormError(err.message || "Failed to create staff user.");
    } finally {
      setIsCreating(false);
    }
  };

  // Filter profiles based on search query
  const filteredProfiles = profiles.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.email.toLowerCase().includes(q) ||
      p.full_name.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q)
    );
  });

  const totalUsers = profiles.length;
  const staffCount = profiles.filter((p) => p.role === "staff").length;
  const activeCount = profiles.filter((p) => p.is_active).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-deep">
              Access Control
            </span>
            <span className="rounded-full bg-amber/20 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase text-amber-deep">
              Admin Only
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
            User Management
          </h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Manage FUWA dessert counter staff and administrator permissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadProfiles}
            disabled={isLoading}
            title="Refresh user list"
            className="flex items-center gap-1.5 rounded-xl border border-ink/15 bg-paper px-3 py-2 font-mono text-xs font-bold text-ink shadow-card transition-colors hover:bg-ink/5 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setFieldErrors({});
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-coffee px-4 py-2.5 text-sm font-bold text-paper shadow-card transition-all hover:bg-ink active:translate-y-0.5"
          >
            <UserPlus className="size-4 text-amber" />
            <span>Add Staff Account</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink/10 bg-paper p-4 shadow-card">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              Total Accounts
            </span>
            <Users className="size-4 text-coffee" />
          </div>
          <div className="mt-2 text-2xl font-black text-ink">{totalUsers}</div>
          <div className="mt-0.5 text-xs text-ink-soft">Active system profiles</div>
        </div>

        <div className="rounded-2xl border border-ink/10 bg-paper p-4 shadow-card">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              Active Staff
            </span>
            <UserCheck className="size-4 text-mint" />
          </div>
          <div className="mt-2 text-2xl font-black text-ink">{staffCount}</div>
          <div className="mt-0.5 text-xs text-ink-soft">Counter & order access</div>
        </div>

        <div className="col-span-2 rounded-2xl border border-ink/10 bg-paper p-4 shadow-card sm:col-span-1">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              Status Ratio
            </span>
            <ShieldCheck className="size-4 text-amber-deep" />
          </div>
          <div className="mt-2 text-2xl font-black text-ink">
            {activeCount} / {totalUsers}
          </div>
          <div className="mt-0.5 text-xs text-ink-soft">Enabled accounts</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or role…"
            className="w-full rounded-xl border border-ink/15 bg-paper py-2 pl-9 pr-4 text-sm font-medium text-ink placeholder:text-ink-soft/60 focus:border-coffee focus:outline-hidden focus:ring-2 focus:ring-amber/30"
          />
        </div>

        <div className="font-mono text-xs text-ink-soft">
          Showing {filteredProfiles.length} of {profiles.length} users
        </div>
      </div>

      {/* Users Table / List */}
      <div className="mt-4 overflow-hidden rounded-2xl border-2 border-ink/15 bg-paper shadow-card">
        {isLoading ? (
          <div className="flex min-h-[260px] items-center justify-center p-8 text-center">
            <span className="font-mono text-sm font-bold text-ink-soft">
              Loading...
            </span>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-cream text-ink-soft">
              <Users className="size-6" />
            </div>
            <div>
              <div className="font-extrabold text-ink">No users found</div>
              <div className="mt-0.5 text-xs text-ink-soft">
                {search ? "No profiles match your search criteria." : "No staff accounts registered yet."}
              </div>
            </div>
            {!search && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-coffee px-4 py-2 text-xs font-bold text-paper transition-colors hover:bg-ink"
              >
                <UserPlus className="size-3.5" />
                <span>Create First Staff Account</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink/10 bg-cream/60 font-mono text-xs font-bold uppercase tracking-wider text-ink-soft">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    User / Name
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Email
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Role
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10 font-medium text-ink">
                {filteredProfiles.map((p) => {
                  const isCurrent = p.id === currentUser?.id;
                  const isToggling = togglingId === p.id;

                  return (
                    <tr
                      key={p.id}
                      className="transition-colors hover:bg-cream/40"
                    >
                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`grid size-9 shrink-0 place-items-center rounded-xl font-mono text-xs font-black shadow-xs ${
                              p.role === "admin"
                                ? "bg-coffee text-amber"
                                : "bg-cream text-ink"
                            }`}
                          >
                            {(p.full_name || p.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-ink">
                              {p.full_name || "—"}
                              {isCurrent && (
                                <span className="ml-2 rounded-md bg-amber/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-deep">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-xs text-ink-soft sm:hidden">
                              {p.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4 font-mono text-xs text-ink">
                        {p.email}
                      </td>

                      {/* Role */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-extrabold uppercase ${
                            p.role === "admin"
                              ? "border border-amber/40 bg-amber/15 text-amber-deep"
                              : "border border-ink/20 bg-cream text-ink-soft"
                          }`}
                        >
                          {p.role === "admin" ? (
                            <>
                              <ShieldCheck className="size-3" />
                              <span>Admin</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="size-3" />
                              <span>Staff</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold ${
                            p.is_active
                              ? "bg-mint/15 text-mint"
                              : "bg-tomato/15 text-tomato"
                          }`}
                        >
                          {p.is_active ? (
                            <>
                              <span className="size-1.5 rounded-full bg-mint" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <span className="size-1.5 rounded-full bg-tomato" />
                              <span>Deactivated</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        {isCurrent ? (
                          <span className="font-mono text-xs italic text-ink-soft">
                            Current session
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {/* Deactivate / Reactivate User */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(p)}
                              disabled={isToggling}
                              title={
                                p.is_active
                                  ? "Deactivate user"
                                  : "Reactivate user"
                              }
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs font-bold transition-all disabled:opacity-50 ${
                                p.is_active
                                  ? "border-amber/40 bg-amber/10 text-amber-deep hover:bg-amber/20"
                                  : "border-mint/40 bg-mint/10 text-mint hover:bg-mint/20"
                              }`}
                            >
                              {p.is_active ? (
                                <UserX className="size-3" />
                              ) : (
                                <UserCheck className="size-3" />
                              )}
                              <span>
                                {isToggling
                                  ? "Updating..."
                                  : p.is_active
                                    ? "Deactivate"
                                    : "Reactivate"}
                              </span>
                            </button>

                            {/* Delete User */}
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError(null);
                                setUserToDelete(p);
                              }}
                              title="Permanently delete user"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-tomato/30 bg-tomato/10 px-2.5 py-1.5 font-mono text-xs font-bold text-tomato transition-all hover:bg-tomato hover:text-paper active:translate-y-0.5"
                            >
                              <Trash2 className="size-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Permissions Explanatory Card */}
      <div className="mt-6 grid gap-4 rounded-2xl border border-ink/10 bg-paper/60 p-5 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-ink">
            <ShieldCheck className="size-4 text-amber-deep" />
            <span>Administrator Privileges</span>
          </div>
          <p className="text-xs leading-relaxed text-ink-soft">
            Full control over POS counter billing, order processing, menu item creation & pricing,
            live sales analytics, daily revenue summaries, and staff account management.
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-ink">
            <UserCheck className="size-4 text-mint" />
            <span>Staff Privileges</span>
          </div>
          <p className="text-xs leading-relaxed text-ink-soft">
            Focused counter station access: taking customer orders, processing cash/card/UPI payments,
            and printing or viewing customer receipts. Restricted from financial analytics and user administration.
          </p>
        </div>
      </div>

      {/* Add Staff Account Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-coffee/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-ink/20 bg-paper p-6 shadow-2xl">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => !isCreating && setIsModalOpen(false)}
              disabled={isCreating}
              className="absolute right-5 top-5 rounded-full p-1.5 text-ink-soft transition-colors hover:bg-ink/10 hover:text-ink disabled:opacity-50"
            >
              <X className="size-5" />
            </button>

            {/* Modal Title */}
            <div className="space-y-1 pr-6">
              <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-deep">
                <UserPlus className="size-3.5" />
                <span>New Staff Member</span>
              </div>
              <h2 className="text-xl font-black tracking-tight text-ink">
                Create Staff Account
              </h2>
              <p className="text-xs text-ink-soft">
                Staff accounts can operate the counter till and view orders.
              </p>
            </div>

            {/* Error Banner */}
            {formError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-tomato/30 bg-tomato/10 p-3 text-xs text-tomato"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="flex-1 font-medium">{formError}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateUser} noValidate className="mt-4 space-y-3.5">
              {/* Full Name */}
              <div className="space-y-1">
                <label
                  htmlFor="staff-name"
                  className="block text-xs font-bold uppercase tracking-wider text-ink"
                >
                  Full Name
                </label>
                <input
                  id="staff-name"
                  type="text"
                  autoFocus
                  disabled={isCreating}
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.fullName) {
                      setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                    }
                  }}
                  placeholder="e.g. Rahul Sharma"
                  className={`w-full rounded-xl border bg-cream/40 px-3.5 py-2 text-sm font-medium text-ink transition-colors placeholder:text-ink-soft/50 focus:outline-hidden focus:ring-2 disabled:opacity-60 ${
                    fieldErrors.fullName
                      ? "border-tomato focus:ring-tomato/20"
                      : "border-ink/20 focus:border-coffee focus:ring-amber/30"
                  }`}
                />
                {fieldErrors.fullName && (
                  <p className="font-mono text-xs text-tomato">
                    {fieldErrors.fullName}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label
                  htmlFor="staff-email"
                  className="block text-xs font-bold uppercase tracking-wider text-ink"
                >
                  Email Address
                </label>
                <input
                  id="staff-email"
                  type="email"
                  disabled={isCreating}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  placeholder="staff@fuwadesserts.com"
                  className={`w-full rounded-xl border bg-cream/40 px-3.5 py-2 text-sm font-medium text-ink transition-colors placeholder:text-ink-soft/50 focus:outline-hidden focus:ring-2 disabled:opacity-60 ${
                    fieldErrors.email
                      ? "border-tomato focus:ring-tomato/20"
                      : "border-ink/20 focus:border-coffee focus:ring-amber/30"
                  }`}
                />
                {fieldErrors.email && (
                  <p className="font-mono text-xs text-tomato">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Temporary Password */}
              <div className="space-y-1">
                <label
                  htmlFor="staff-password"
                  className="block text-xs font-bold uppercase tracking-wider text-ink"
                >
                  Temporary Password
                </label>
                <div className="relative">
                  <input
                    id="staff-password"
                    type={showPassword ? "text" : "password"}
                    disabled={isCreating}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    placeholder="Min. 6 characters"
                    className={`w-full rounded-xl border bg-cream/40 px-3.5 py-2 pr-10 text-sm font-medium text-ink transition-colors placeholder:text-ink-soft/50 focus:outline-hidden focus:ring-2 disabled:opacity-60 ${
                      fieldErrors.password
                        ? "border-tomato focus:ring-tomato/20"
                        : "border-ink/20 focus:border-coffee focus:ring-amber/30"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-soft hover:text-ink"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="font-mono text-xs text-tomato">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Note on security */}
              <div className="rounded-xl border border-ink/10 bg-cream/50 p-3 font-mono text-[11px] text-ink-soft">
                <div className="flex items-center gap-1 font-bold text-ink">
                  <CheckCircle2 className="size-3 text-mint" />
                  <span>Role: Staff</span>
                </div>
                <div className="mt-0.5">
                  Created accounts receive 'staff' role automatically. They cannot create accounts or alter FUWA menu pricing.
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isCreating}
                  className="rounded-xl border border-ink/20 bg-paper px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center gap-2 rounded-xl bg-coffee px-5 py-2.5 text-xs font-bold text-paper shadow-card transition-all hover:bg-ink active:translate-y-0.5 disabled:opacity-60"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-amber" />
                      <span>Creating Account…</span>
                    </>
                  ) : (
                    <span>Create User</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Dialog */}
      {userToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-coffee/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-tomato/40 bg-paper p-6 shadow-2xl">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => !isDeleting && setUserToDelete(null)}
              disabled={isDeleting}
              className="absolute right-5 top-5 rounded-full p-1.5 text-ink-soft transition-colors hover:bg-ink/10 hover:text-ink disabled:opacity-50"
              aria-label="Close dialog"
            >
              <X className="size-5" />
            </button>

            {/* Modal Title */}
            <div className="space-y-1 pr-6">
              <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-tomato">
                <AlertTriangle className="size-3.5" />
                <span>Permanent Deletion</span>
              </div>
              <h2
                id="delete-user-modal-title"
                className="text-xl font-black tracking-tight text-ink"
              >
                Delete User Account?
              </h2>
              <p className="text-xs text-ink-soft">
                Confirm whether you want to permanently remove this user account.
              </p>
            </div>

            {/* User Details Box */}
            <div className="mt-4 rounded-2xl border border-ink/10 bg-cream/50 p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`grid size-10 shrink-0 place-items-center rounded-xl font-mono text-xs font-black shadow-xs ${
                    userToDelete.role === "admin"
                      ? "bg-coffee text-amber"
                      : "bg-cream text-ink"
                  }`}
                >
                  {(userToDelete.full_name || userToDelete.email)
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-ink">
                      {userToDelete.full_name || "—"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase ${
                        userToDelete.role === "admin"
                          ? "border border-amber/40 bg-amber/15 text-amber-deep"
                          : "border border-ink/20 bg-paper text-ink-soft"
                      }`}
                    >
                      {userToDelete.role}
                    </span>
                  </div>
                  <div className="truncate font-mono text-xs text-ink-soft">
                    {userToDelete.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Warning Points */}
            <div className="mt-4 space-y-2 rounded-xl border border-tomato/20 bg-tomato/5 p-3.5 text-xs text-ink">
              <div className="flex items-start gap-2 text-tomato">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold text-tomato">
                    Please note the following consequences:
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-ink-soft">
                    <li>
                      <strong className="text-ink">
                        {userToDelete.full_name || userToDelete.email}
                      </strong>{" "}
                      will immediately lose access to the application.
                    </li>
                    <li>
                      Their Supabase Auth login and linked profile record will be permanently deleted.
                    </li>
                    <li>
                      <strong className="text-tomato">
                        This action is permanent and cannot be undone.
                      </strong>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Data preservation reassurance */}
            <div className="mt-3 rounded-xl border border-mint/30 bg-mint/5 p-3 text-[11px] text-ink-soft">
              <div className="flex items-center gap-1.5 font-bold text-mint">
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span>Historical Data Intact</span>
              </div>
              <p className="mt-1 leading-relaxed">
                Historical orders, receipts, and order-item snapshots handled by this user remain preserved in the system.
              </p>
            </div>

            {/* Admin account protection notice */}
            {userToDelete.role === "admin" && (() => {
              const remainingActiveAdmins = profiles.filter(
                (p) => p.role === "admin" && p.is_active && p.id !== userToDelete.id,
              ).length;
              const isLastActiveAdmin = userToDelete.is_active && remainingActiveAdmins === 0;

              return (
                <div className="mt-3">
                  {isLastActiveAdmin ? (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-xl border border-tomato/40 bg-tomato/15 p-3 text-xs font-semibold text-tomato"
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <div>
                        Action Blocked: This is the last active administrator account.
                        Another active administrator must exist before deleting this user.
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-xl border border-amber/40 bg-amber/10 p-3 text-xs font-medium text-amber-deep">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      <div>
                        Admin Warning: You are deleting an administrator account.
                        Make sure you have access to another active administrator login.
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Error Banner */}
            {deleteError && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl border border-tomato/30 bg-tomato/10 p-3 text-xs text-tomato"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="flex-1 font-medium">{deleteError}</div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="rounded-xl border border-ink/20 bg-paper px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={
                  isDeleting ||
                  (userToDelete.role === "admin" &&
                    userToDelete.is_active &&
                    profiles.filter(
                      (p) => p.role === "admin" && p.is_active && p.id !== userToDelete.id,
                    ).length === 0)
                }
                className="flex items-center gap-2 rounded-xl bg-tomato px-5 py-2.5 text-xs font-bold text-paper shadow-card transition-all hover:bg-tomato/90 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                <span>
                  {isDeleting ? "Deleting..." : "Permanently Delete User"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
