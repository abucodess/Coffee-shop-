import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { supabase } from "@/lib/supabase";

function mockAuth(user: any = null, profile: any = null) {
  const session = user
    ? {
        access_token: "mock-token",
        refresh_token: "mock-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      }
    : null;

  vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
    data: { session: session as any },
    error: null,
  });

  vi.spyOn(supabase.auth, "onAuthStateChange").mockImplementation((callback) => {
    callback(session ? "SIGNED_IN" : "INITIAL_SESSION", session as any);
    return {
      data: {
        subscription: {
          unsubscribe: vi.fn(),
          id: "mock-sub",
          callback,
        },
      },
    };
  });

  vi.spyOn(supabase, "from").mockImplementation((table: string) => {
    if (table === "profiles") {
      const activeProfile = profile || (user ? {
        id: user.id,
        email: user.email,
        full_name: "Test User",
        role: "staff",
        is_active: true,
      } : null);

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: activeProfile,
          error: activeProfile ? null : { message: "Not found" },
        }),
        order: vi.fn().mockResolvedValue({
          data: activeProfile ? [activeProfile] : [],
          error: null,
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any;
    }

    return {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as any;
  });
}

async function renderApp(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Authentication & Protected Routes", () => {
  it("renders the /login route with email, password fields and sign in button", async () => {
    mockAuth(null);
    const { baseElement } = await renderApp("/login");

    await waitFor(() => {
      expect(baseElement.querySelector("#email")).toBeInTheDocument();
      expect(baseElement.querySelector("#password")).toBeInTheDocument();
      expect(baseElement.textContent).toContain("Sign In");
      expect(baseElement.textContent).not.toContain("Sign Up");
    });
  });

  it("validates empty email and password on login submit", async () => {
    mockAuth(null);
    const { baseElement } = await renderApp("/login");

    const submitBtn = baseElement.querySelector('button[type="submit"]');
    expect(submitBtn).toBeInTheDocument();

    fireEvent.click(submitBtn!);

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Email is required");
      expect(baseElement.textContent).toContain("Password is required");
    });
  });

  it("shows an error message for invalid credentials", async () => {
    mockAuth(null);
    vi.spyOn(supabase.auth, "signInWithPassword").mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: "Invalid login credentials",
        status: 400,
        name: "AuthApiError",
      },
    });

    const { baseElement } = await renderApp("/login");

    const emailInput = baseElement.querySelector("#email");
    const passwordInput = baseElement.querySelector("#password");
    const submitBtn = baseElement.querySelector('button[type="submit"]');

    fireEvent.change(emailInput!, { target: { value: "invalid@cafe.com" } });
    fireEvent.change(passwordInput!, { target: { value: "wrongpassword" } });
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Invalid email or password.");
    });
  });

  it("redirects unauthenticated user accessing / to /login", async () => {
    mockAuth(null);
    const { baseElement } = await renderApp("/");

    await waitFor(() => {
      expect(baseElement.querySelector("#email")).toBeInTheDocument();
      expect(baseElement.textContent).toContain("Welcome back");
    });
  });

  it("redirects unauthenticated user accessing /dashboard to /login", async () => {
    mockAuth(null);
    const { baseElement } = await renderApp("/dashboard");

    await waitFor(() => {
      expect(baseElement.querySelector("#email")).toBeInTheDocument();
      expect(baseElement.textContent).toContain("Welcome back");
    });
  });

  it("redirects unauthenticated user accessing /menu to /login", async () => {
    mockAuth(null);
    const { baseElement } = await renderApp("/menu");

    await waitFor(() => {
      expect(baseElement.querySelector("#email")).toBeInTheDocument();
      expect(baseElement.textContent).toContain("Welcome back");
    });
  });

  it("redirects unauthenticated user accessing /orders to /login", async () => {
    mockAuth(null);
    const { baseElement } = await renderApp("/orders");

    await waitFor(() => {
      expect(baseElement.querySelector("#email")).toBeInTheDocument();
      expect(baseElement.textContent).toContain("Welcome back");
    });
  });

  it("renders POS header with user email, role, and logout button when authenticated", async () => {
    const mockUser = {
      id: "usr-123",
      email: "barista@cafemocha.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };
    mockAuth(mockUser);

    const { baseElement } = await renderApp("/");

    await waitFor(() => {
      expect(baseElement.textContent).toContain("barista@cafemocha.com");
      expect(baseElement.textContent).toContain("Staff");
      expect(baseElement.textContent).toContain("Logout");
    });
  });

  it("redirects authenticated user visiting /login to root /", async () => {
    const mockUser = {
      id: "usr-123",
      email: "barista@cafemocha.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };
    mockAuth(mockUser);

    const { baseElement } = await renderApp("/login");

    await waitFor(() => {
      expect(baseElement.textContent).toContain("barista@cafemocha.com");
      expect(baseElement.querySelector("#password")).not.toBeInTheDocument();
    });
  });

  it("restricts staff users from accessing /admin/users", async () => {
    const mockStaff = {
      id: "staff-1",
      email: "staff@cafemocha.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };
    const staffProfile = {
      id: "staff-1",
      email: "staff@cafemocha.com",
      full_name: "Staff Barista",
      role: "staff",
      is_active: true,
    };
    mockAuth(mockStaff, staffProfile);

    const { baseElement } = await renderApp("/admin/users");

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Access Restricted");
      expect(baseElement.textContent).toContain("Back to Billing");
    });
  });

  it("restricts staff users from accessing /dashboard", async () => {
    const mockStaff = {
      id: "staff-1",
      email: "staff@cafemocha.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };
    const staffProfile = {
      id: "staff-1",
      email: "staff@cafemocha.com",
      full_name: "Staff Barista",
      role: "staff",
      is_active: true,
    };
    mockAuth(mockStaff, staffProfile);

    const { baseElement } = await renderApp("/dashboard");

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Access Restricted");
    });
  });

  it("allows admin users to access /admin/users and displays user management", async () => {
    const mockAdmin = {
      id: "admin-1",
      email: "admin@cafemocha.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };
    const adminProfile = {
      id: "admin-1",
      email: "admin@cafemocha.com",
      full_name: "Admin Manager",
      role: "admin",
      is_active: true,
    };
    mockAuth(mockAdmin, adminProfile);

    const { baseElement } = await renderApp("/admin/users");

    await waitFor(() => {
      expect(baseElement.textContent).toContain("User Management");
      expect(baseElement.textContent).toContain("Add Staff Account");
      expect(baseElement.textContent).toContain("Admin");
    });
  });
});
