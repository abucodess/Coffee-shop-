import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { supabase } from "@/lib/supabase";

const adminUser = {
  id: "admin-1",
  email: "admin@fuwadesserts.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const adminProfile = {
  id: "admin-1",
  email: "admin@fuwadesserts.com",
  full_name: "Admin One",
  role: "admin",
  is_active: true,
};

function setupMockUsers(profilesList: any[] = [], mockInvoke?: any) {
  const session = {
    access_token: "mock-token",
    refresh_token: "mock-refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: adminUser,
  };

  vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
    data: { session: session as any },
    error: null,
  });

  vi.spyOn(supabase.auth, "onAuthStateChange").mockImplementation((callback) => {
    callback("SIGNED_IN", session as any);
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

  // Intercept getter for supabase.functions so invoke can be reliably mocked
  const invokeHandler =
    mockInvoke ||
    vi.fn().mockResolvedValue({
      data: { success: true, message: "User deleted successfully." },
      error: null,
    });

  Object.defineProperty(supabase, "functions", {
    get: () => ({
      invoke: invokeHandler,
    }),
    configurable: true,
  });

  vi.spyOn(supabase, "from").mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: adminProfile,
          error: null,
        }),
        order: vi.fn().mockResolvedValue({
          data: profilesList,
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

  return { invokeHandler };
}

async function renderAdminUsers() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ["/admin/users"] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
}

afterEach(() => {
  cleanup();
  delete (supabase as any).functions;
  vi.restoreAllMocks();
});

describe("Admin Users Management — Delete User & Account Protection", () => {
  const staffUser = {
    id: "staff-1",
    email: "barista@fuwadesserts.com",
    full_name: "John Barista",
    role: "staff",
    is_active: true,
  };

  const secondAdminUser = {
    id: "admin-2",
    email: "owner@fuwadesserts.com",
    full_name: "Owner Admin",
    role: "admin",
    is_active: true,
  };

  it("renders table with static Loading... indicator without spinners or skeleton loaders before data loads", async () => {
    const session = {
      access_token: "mock-token",
      refresh_token: "mock-refresh",
      expires_in: 3600,
      token_type: "bearer",
      user: adminUser,
    };
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: session as any },
      error: null,
    });
    vi.spyOn(supabase.auth, "onAuthStateChange").mockImplementation((cb) => {
      cb("SIGNED_IN", session as any);
      return { data: { subscription: { unsubscribe: vi.fn(), id: "1", callback: cb } } };
    });
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: adminProfile,
            error: null,
          }),
          // Promise that does not resolve immediately to inspect loading state
          order: vi.fn().mockReturnValue(new Promise(() => {})),
        } as any;
      }
      return { select: vi.fn().mockReturnThis() } as any;
    });

    const { baseElement } = await renderAdminUsers();
    await waitFor(() => {
      expect(baseElement.textContent).toContain("Loading...");
      const loadingEl = baseElement.querySelector("div.overflow-hidden");
      expect(loadingEl?.textContent).toContain("Loading...");
      expect(loadingEl?.querySelector(".animate-spin")).toBeNull();
    });
  });

  it("renders Delete User and Deactivate buttons for other users, but restricts self-deletion", async () => {
    setupMockUsers([adminProfile, staffUser]);

    const { baseElement } = await renderAdminUsers();

    await waitFor(() => {
      expect(baseElement.textContent).toContain("John Barista");
      expect(baseElement.textContent).toContain("Current session");
    });

    // Check actions for staff user
    const deleteButtons = baseElement.querySelectorAll('button[title="Permanently delete user"]');
    expect(deleteButtons.length).toBe(1);

    const deactivateButtons = baseElement.querySelectorAll('button[title="Deactivate user"]');
    expect(deactivateButtons.length).toBe(1);
  });

  it("opens confirmation dialog with user details, permanent warnings, and historical data note", async () => {
    setupMockUsers([adminProfile, staffUser]);

    const { baseElement } = await renderAdminUsers();

    await waitFor(() => {
      expect(baseElement.textContent).toContain("John Barista");
    });

    const deleteBtn = baseElement.querySelector('button[title="Permanently delete user"]');
    expect(deleteBtn).toBeInTheDocument();
    fireEvent.click(deleteBtn!);

    // Confirmation dialog must appear with all required notices
    await waitFor(() => {
      expect(baseElement.textContent).toContain("Delete User Account?");
      expect(baseElement.textContent).toContain("John Barista");
      expect(baseElement.textContent).toContain("barista@fuwadesserts.com");
      expect(baseElement.textContent).toContain("will immediately lose access to the application");
      expect(baseElement.textContent).toContain("This action is permanent and cannot be undone");
      expect(baseElement.textContent).toContain("Historical Data Intact");
      expect(baseElement.textContent).toContain("Permanently Delete User");
    });
  });

  it("canceling confirmation dialog closes modal and does not delete user", async () => {
    setupMockUsers([adminProfile, staffUser]);

    const { baseElement } = await renderAdminUsers();

    await waitFor(() => {
      expect(baseElement.textContent).toContain("John Barista");
    });

    fireEvent.click(baseElement.querySelector('button[title="Permanently delete user"]')!);

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Delete User Account?");
    });

    // Click Cancel button
    const cancelBtn = Array.from(baseElement.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Cancel",
    );
    expect(cancelBtn).toBeDefined();
    fireEvent.click(cancelBtn!);

    await waitFor(() => {
      expect(baseElement.textContent).not.toContain("Delete User Account?");
      expect(baseElement.textContent).toContain("John Barista");
    });
  });

  it("successfully deletes staff user via delete-staff-user Edge Function and updates UI", async () => {
    const invokeSpy = vi.fn().mockResolvedValue({
      data: { success: true, message: "User deleted permanently." },
      error: null,
    });
    setupMockUsers([adminProfile, staffUser], invokeSpy);

    const { baseElement } = await renderAdminUsers();

    await waitFor(() => {
      expect(baseElement.textContent).toContain("John Barista");
    });

    fireEvent.click(baseElement.querySelector('button[title="Permanently delete user"]')!);

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Permanently Delete User");
    });

    const confirmDeleteBtn = Array.from(baseElement.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Permanently Delete User"),
    );
    expect(confirmDeleteBtn).toBeDefined();
    fireEvent.click(confirmDeleteBtn!);

    await waitFor(() => {
      expect(invokeSpy).toHaveBeenCalledWith("delete-staff-user", {
        body: { userId: "staff-1" },
      });
      // User is removed from list
      expect(baseElement.textContent).not.toContain("John Barista");
    });
  });

  it("handles Edge Function deletion error gracefully without removing user from UI", async () => {
    const invokeSpy = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Internal server error occurred." },
    });
    setupMockUsers([adminProfile, staffUser], invokeSpy);

    const { baseElement } = await renderAdminUsers();

    await waitFor(() => {
      expect(baseElement.textContent).toContain("John Barista");
    });

    fireEvent.click(baseElement.querySelector('button[title="Permanently delete user"]')!);

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Permanently Delete User");
    });

    const confirmDeleteBtn = Array.from(baseElement.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Permanently Delete User"),
    );
    fireEvent.click(confirmDeleteBtn!);

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Internal server error occurred.");
      // User is still present in the list
      expect(baseElement.textContent).toContain("John Barista");
    });
  });

  it("blocks deleting the last active admin account if no other active admin remains", async () => {
    // Current user adminProfile is in session, but in the loaded profiles list,
    // admin-1 is deactivated and soleAdmin is the only active admin.
    const soleAdmin = {
      id: "admin-sole",
      email: "sole@fuwadesserts.com",
      full_name: "Sole Active Admin",
      role: "admin",
      is_active: true,
    };
    const inactiveAdminInList = {
      ...adminProfile,
      is_active: false,
    };

    setupMockUsers([inactiveAdminInList, soleAdmin]);

    const { baseElement } = await renderAdminUsers();

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Sole Active Admin");
    });

    const deleteBtn = baseElement.querySelector('button[title="Permanently delete user"]');
    expect(deleteBtn).toBeInTheDocument();
    fireEvent.click(deleteBtn!);

    await waitFor(() => {
      expect(baseElement.textContent).toContain(
        "Action Blocked: This is the last active administrator account",
      );
      const confirmBtn = Array.from(baseElement.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Permanently Delete User"),
      );
      expect(confirmBtn).toBeDisabled();
    });
  });

  it("allows deleting an admin when another active admin remains, showing admin warning", async () => {
    setupMockUsers([adminProfile, secondAdminUser]);

    const { baseElement } = await renderAdminUsers();

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Owner Admin");
    });

    const deleteBtn = baseElement.querySelector('button[title="Permanently delete user"]');
    fireEvent.click(deleteBtn!);

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Admin Warning: You are deleting an administrator account");
      const confirmBtn = Array.from(baseElement.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Permanently Delete User"),
      );
      expect(confirmBtn).not.toBeDisabled();
    });
  });

  it("allows deactivating and reactivating a user", async () => {
    let activeState = false;
    const updateSpy = vi.fn().mockImplementation((payload) => {
      activeState = payload.is_active;
      return {
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const session = {
      access_token: "mock-token",
      refresh_token: "mock-refresh",
      expires_in: 3600,
      token_type: "bearer",
      user: adminUser,
    };

    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: session as any },
      error: null,
    });
    vi.spyOn(supabase.auth, "onAuthStateChange").mockImplementation((cb) => {
      cb("SIGNED_IN", session as any);
      return { data: { subscription: { unsubscribe: vi.fn(), id: "1", callback: cb } } };
    });

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: adminProfile,
            error: null,
          }),
          order: vi.fn().mockResolvedValue({
            data: [
              adminProfile,
              { id: "staff-1", email: "barista@fuwadesserts.com", full_name: "John Barista", role: "staff", is_active: false },
            ],
            error: null,
          }),
          update: updateSpy,
        } as any;
      }
      return { select: vi.fn().mockReturnThis() } as any;
    });

    const { baseElement } = await renderAdminUsers();

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Reactivate");
    });

    const reactivateBtn = baseElement.querySelector('button[title="Reactivate user"]');
    expect(reactivateBtn).toBeInTheDocument();
    fireEvent.click(reactivateBtn!);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: true }),
      );
    });
  });
});
