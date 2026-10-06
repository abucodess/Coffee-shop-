import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { supabase } from "@/lib/supabase";
import {
  saveStoreSettings,
  fetchStoreSettings,
  uploadStoreLogo,
  deleteStoreLogo,
  STORE_ASSETS_BUCKET,
} from "@/lib/store-settings";
import { ReceiptModal } from "@/components/Receipt";
import type { Order } from "@/lib/pos-data";

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
        full_name: "Admin User",
        role: "admin",
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
      } as any;
    }

    if (table === "store_settings") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "default",
            name: "Mocha Counter Test Shop",
            address: "123 Beach Road\nKochi, Kerala - 682001",
            logo_url: "https://example.com/logo.png",
          },
          error: null,
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      } as any;
    }

    return {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
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

describe("Store Information Settings Page", () => {
  const adminUser = { id: "admin-1", email: "admin@cafemocha.com" };
  const adminProfile = {
    id: "admin-1",
    email: "admin@cafemocha.com",
    full_name: "Store Admin",
    role: "admin",
    is_active: true,
  };

  const staffUser = { id: "staff-1", email: "staff@cafemocha.com" };
  const staffProfile = {
    id: "staff-1",
    email: "staff@cafemocha.com",
    full_name: "Store Staff",
    role: "staff",
    is_active: true,
  };

  it("renders Store Information form elements for admin", async () => {
    mockAuth(adminUser, adminProfile);
    await renderApp("/settings/store");

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Store Information" })).toBeInTheDocument();
      expect(screen.getByText("Manage your store details and branding.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /back to settings/i })).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { level: 2, name: "Store Logo" })).toBeInTheDocument();
    expect(screen.getByLabelText(/store name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/store address/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("validates that store name cannot be saved empty", async () => {
    mockAuth(adminUser, adminProfile);
    await renderApp("/settings/store");

    const nameInput = await screen.findByLabelText(/store name/i);
    await waitFor(() => {
      expect(nameInput).toHaveValue("Mocha Counter Test Shop");
    });

    fireEvent.change(nameInput, { target: { value: "   " } });

    await waitFor(() => {
      const saveBtn = screen.getByRole("button", { name: /save changes/i });
      expect(saveBtn).toBeDisabled();
    });
  });

  it("allows editing store name and address and submitting changes", async () => {
    mockAuth(adminUser, adminProfile);
    await renderApp("/settings/store");

    await waitFor(() => {
      expect(screen.getByLabelText(/store name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/store name/i);
    const addressInput = screen.getByLabelText(/store address/i);

    fireEvent.change(nameInput, { target: { value: "Artisan Coffee House" } });
    fireEvent.change(addressInput, { target: { value: "45 Hill View Road\nWayanad, Kerala - 673121" } });

    expect(nameInput).toHaveValue("Artisan Coffee House");
    expect(addressInput).toHaveValue("45 Hill View Road\nWayanad, Kerala - 673121");

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).not.toBeDisabled();
    });
  });

  it("handles logo file selection and preview before saving", async () => {
    mockAuth(adminUser, adminProfile);
    await renderApp("/settings/store");

    await waitFor(() => {
      expect(screen.getByText(/store logo/i)).toBeInTheDocument();
    });

    // Mock createObjectURL
    window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-preview");
    window.URL.revokeObjectURL = vi.fn();

    const fileInput = document.getElementById("store-logo-input") as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const mockFile = new File(["dummy content"], "logo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByText("Preview")).toBeInTheDocument();
    });

    // Test removing logo
    const removeBtn = screen.getByRole("button", { name: /remove logo/i });
    fireEvent.click(removeBtn);

    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
  });

  it("shows error for file exceeding 2MB size limit", async () => {
    mockAuth(adminUser, adminProfile);
    await renderApp("/settings/store");

    await waitFor(() => {
      expect(screen.getByText(/store logo/i)).toBeInTheDocument();
    });

    const fileInput = document.getElementById("store-logo-input") as HTMLInputElement;
    const oversizedFile = new File(["a".repeat(3 * 1024 * 1024)], "large.png", {
      type: "image/png",
    });
    Object.defineProperty(oversizedFile, "size", { value: 3 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    await waitFor(() => {
      expect(screen.getByText(/exceeds 2mb/i)).toBeInTheDocument();
    });
  });

  it("reflects updated store settings in printed receipt", async () => {
    await saveStoreSettings({
      name: "Grand Café Mocha",
      address: "Marine Drive, Kochi, Kerala",
      logoUrl: "https://example.com/grand-logo.png",
    });

    const sampleOrder: Order = {
      id: "ord-test",
      number: "A-001",
      createdAt: Date.now(),
      lines: [{ name: "Espresso", price: 150, qty: 1 }],
      subtotal: 150,
      total: 150,
      tax: 0,
      cgst: 0,
      sgst: 0,
      payment: "cash",
      status: "paid",
    };

    render(<ReceiptModal order={sampleOrder} onClose={vi.fn()} />);

    expect(screen.getByText("Grand Café Mocha")).toBeInTheDocument();
    expect(screen.getByText("Marine Drive, Kochi, Kerala")).toBeInTheDocument();
    const logoImg = screen.getByAltText("Grand Café Mocha");
    expect(logoImg).toHaveAttribute("src", "https://example.com/grand-logo.png");
  });

  it("restricts non-admin staff from accessing /settings/store", async () => {
    mockAuth(staffUser, staffProfile);
    await renderApp("/settings/store");

    await waitFor(() => {
      expect(screen.getByText(/access restricted/i)).toBeInTheDocument();
    });
  });

  describe("Logo Storage Bucket & Error Handling", () => {
    it("ensures the storage bucket name is exactly 'store-assets'", () => {
      expect(STORE_ASSETS_BUCKET).toBe("store-assets");
    });

    it("throws helpful actionable error message when bucket is not found", async () => {
      const uploadMock = vi.fn().mockResolvedValue({
        error: { message: "Bucket not found", statusCode: 404 },
      });
      const createBucketMock = vi.fn().mockResolvedValue({
        error: { message: "Unauthorized" },
      });

      vi.spyOn(supabase.storage, "from").mockImplementation((bucket: string) => {
        expect(bucket).toBe("store-assets");
        return {
          upload: uploadMock,
          getPublicUrl: vi.fn(),
        } as any;
      });
      vi.spyOn(supabase.storage, "createBucket").mockImplementation(createBucketMock as any);

      const testFile = new File(["sample"], "logo.png", { type: "image/png" });
      await expect(uploadStoreLogo(testFile)).rejects.toThrow(
        /Storage bucket 'store-assets' not found in Supabase/i,
      );
    });

    it("displays friendly bucket not found error in UI when saving a staged logo", async () => {
      mockAuth(adminUser, adminProfile);

      vi.spyOn(supabase.storage, "from").mockImplementation((bucket: string) => {
        expect(bucket).toBe("store-assets");
        return {
          upload: vi.fn().mockResolvedValue({ error: { message: "Bucket not found" } }),
          getPublicUrl: vi.fn(),
        } as any;
      });

      await renderApp("/settings/store");

      await waitFor(() => {
        expect(screen.getByText(/store logo/i)).toBeInTheDocument();
      });

      window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-preview");
      window.URL.revokeObjectURL = vi.fn();

      const fileInput = document.getElementById("store-logo-input") as HTMLInputElement;
      const mockFile = new File(["dummy content"], "logo.png", { type: "image/png" });
      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      const saveBtn = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/Storage bucket 'store-assets' not found/i)).toBeInTheDocument();
      });
    });

    it("successfully uploads to store-assets and retrieves public URL", async () => {
      const uploadMock = vi.fn().mockResolvedValue({ error: null });
      const getPublicUrlMock = vi.fn().mockReturnValue({
        data: {
          publicUrl:
            "https://example.supabase.co/storage/v1/object/public/store-assets/branding/test-logo.png",
        },
      });

      vi.spyOn(supabase.storage, "from").mockImplementation((bucket: string) => {
        expect(bucket).toBe("store-assets");
        return {
          upload: uploadMock,
          getPublicUrl: getPublicUrlMock,
        } as any;
      });

      const testFile = new File(["sample"], "brand.png", { type: "image/png" });
      const publicUrl = await uploadStoreLogo(testFile);

      expect(publicUrl).toBe(
        "https://example.supabase.co/storage/v1/object/public/store-assets/branding/test-logo.png",
      );
      expect(uploadMock).toHaveBeenCalled();
    });

    it("deleteStoreLogo removes file from store-assets bucket", async () => {
      const removeMock = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase.storage, "from").mockImplementation((bucket: string) => {
        expect(bucket).toBe("store-assets");
        return {
          remove: removeMock,
        } as any;
      });

      await deleteStoreLogo(
        "https://example.supabase.co/storage/v1/object/public/store-assets/branding/old-logo.png",
      );

      expect(removeMock).toHaveBeenCalledWith(["branding/old-logo.png"]);
    });
  });
});
