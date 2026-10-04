/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { supabase } from "@/lib/supabase";
import { getDateRangeForFilter, buildChartData } from "@/lib/dashboard-dates";
import { type Order } from "@/lib/pos-data";

function mockAuthAdmin() {
  const adminUser = {
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
    full_name: "Head Barista",
    role: "admin",
    is_active: true,
  };

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

  vi.spyOn(supabase, "from").mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: adminProfile, error: null }),
        order: vi.fn().mockResolvedValue({ data: [adminProfile], error: null }),
      } as any;
    }

    const builder: any = {
      select: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => Promise.resolve({ error: null })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      then: (resolve: any, reject: any) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject),
    };
    return builder;
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

describe("Dashboard Date Filtering & Timezone Utilities", () => {
  it("computes Today date boundaries in shop local timezone (Asia/Kolkata)", () => {
    const res = getDateRangeForFilter("today");
    expect(res.badge).toBe("Today");
    expect(res.start).not.toBeNull();
    expect(res.end).not.toBeNull();
    expect(res.start!.getTime()).toBeLessThan(res.end!.getTime());
    expect(res.label).toContain("Today");
  });

  it("computes specific date boundaries for any selected date", () => {
    const res = getDateRangeForFilter("date", { selectedDate: "2026-05-14" });
    expect(res.badge).toBe("Specific Date");
    expect(res.start).not.toBeNull();
    expect(res.end).not.toBeNull();
    expect(res.label).toContain("14 May 2026");
  });

  it("computes month boundaries for any selected month and past years", () => {
    // February 2024 was a leap year (29 days)
    const res2024 = getDateRangeForFilter("month", { year: 2024, month: 2 });
    expect(res2024.badge).toBe("Monthly View");
    expect(res2024.label).toBe("February 2024");
    expect(res2024.end!.getDate()).toBe(29);

    // February 2023 had 28 days
    const res2023 = getDateRangeForFilter("month", { year: 2023, month: 2 });
    expect(res2023.label).toBe("February 2023");
    expect(res2023.end!.getDate()).toBe(28);

    // Past year 2020
    const res2020 = getDateRangeForFilter("month", { year: 2020, month: 10 });
    expect(res2020.label).toBe("October 2020");
    expect(res2020.end!.getDate()).toBe(31);
  });

  it("computes custom date range boundaries and auto-sorts inverted dates", () => {
    const res = getDateRangeForFilter("custom", {
      startDate: "2026-08-01",
      endDate: "2026-08-15",
    });
    expect(res.badge).toBe("Custom Range");
    expect(res.label).toContain("1 Aug 2026");
    expect(res.label).toContain("15 Aug 2026");
    expect(res.start!.getTime()).toBeLessThan(res.end!.getTime());

    // Inverted test
    const inverted = getDateRangeForFilter("custom", {
      startDate: "2026-08-15",
      endDate: "2026-08-01",
    });
    expect(inverted.start!.getTime()).toBeLessThan(inverted.end!.getTime());
  });

  it("returns null boundaries for All time", () => {
    const res = getDateRangeForFilter("all");
    expect(res.badge).toBe("All Time");
    expect(res.start).toBeNull();
    expect(res.end).toBeNull();
    expect(res.label).toContain("All Time");
  });
});

describe("Dashboard Chart Grouping", () => {
  const samplePaidOrders: Order[] = [
    {
      id: "ord-1",
      number: "A-001",
      createdAt: new Date("2026-10-04T09:15:00+05:30").getTime(),
      lines: [{ name: "Flat White", price: 220, qty: 2 }],
      subtotal: 440,
      tax: 0,
      total: 440,
      payment: "cash",
      status: "paid",
    },
    {
      id: "ord-2",
      number: "A-002",
      createdAt: new Date("2026-10-04T09:45:00+05:30").getTime(),
      lines: [{ name: "Cardamom Bun", price: 180, qty: 1 }],
      subtotal: 180,
      tax: 0,
      total: 180,
      payment: "card",
      status: "paid",
    },
    {
      id: "ord-3",
      number: "A-003",
      createdAt: new Date("2026-10-04T14:20:00+05:30").getTime(),
      lines: [{ name: "Iced Latte", price: 220, qty: 1 }],
      subtotal: 220,
      tax: 0,
      total: 220,
      payment: "card",
      status: "paid",
    },
  ];

  it("groups hourly sales for Today and Select date (00:00 to 23:00)", () => {
    const chart = buildChartData("today", new Date(), new Date(), samplePaidOrders);
    expect(chart.length).toBe(24);
    // Hour 9 (09:00) should have 440 + 180 = 620
    const hour9 = chart.find((b) => b.label === "09:00");
    expect(hour9).toBeDefined();
    expect(hour9!.sales).toBe(620);
    expect(hour9!.orders).toBe(2);

    // Hour 14 (14:00) should have 220
    const hour14 = chart.find((b) => b.label === "14:00");
    expect(hour14).toBeDefined();
    expect(hour14!.sales).toBe(220);
    expect(hour14!.orders).toBe(1);

    // Other hours should have 0
    const hour12 = chart.find((b) => b.label === "12:00");
    expect(hour12!.sales).toBe(0);
  });

  it("groups daily sales for Select month", () => {
    const start = new Date("2026-10-01T00:00:00+05:30");
    const end = new Date("2026-10-31T23:59:59.999+05:30");
    const chart = buildChartData("month", start, end, samplePaidOrders);
    expect(chart.length).toBe(31); // October has 31 days
    // Day 4 should have 440 + 180 + 220 = 840
    const day4 = chart.find((b) => b.key === "4");
    expect(day4).toBeDefined();
    expect(day4!.sales).toBe(840);
    expect(day4!.orders).toBe(3);
  });

  it("groups shorter custom ranges by day", () => {
    const start = new Date("2026-10-01T00:00:00+05:30");
    const end = new Date("2026-10-10T23:59:59.999+05:30");
    const chart = buildChartData("custom", start, end, samplePaidOrders);
    expect(chart.length).toBe(10);
    const day4 = chart.find((b) => b.tooltipLabel.includes("4 Oct 2026") || b.key === "2026-10-04");
    expect(day4).toBeDefined();
    expect(day4!.sales).toBe(840);
  });

  it("groups all-time sales by month", () => {
    const chart = buildChartData("all", null, null, samplePaidOrders);
    expect(chart.length).toBeGreaterThan(0);
    const octBucket = chart.find((b) => b.key === "2026-10");
    expect(octBucket).toBeDefined();
    expect(octBucket!.sales).toBe(840);
    expect(octBucket!.orders).toBe(3);
  });
});

describe("Dashboard Page Integration", () => {
  beforeEach(() => {
    mockAuthAdmin();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the dashboard with all 5 filter buttons and displays Today by default", async () => {
    const { baseElement } = await renderApp("/dashboard");

    await waitFor(() => {
      expect(screen.getByTestId("filter-today")).toBeInTheDocument();
    });

    // Check all 5 filter buttons exist
    expect(screen.getByTestId("filter-today")).toBeInTheDocument();
    expect(screen.getByTestId("filter-date")).toBeInTheDocument();
    expect(screen.getByTestId("filter-month")).toBeInTheDocument();
    expect(screen.getByTestId("filter-custom")).toBeInTheDocument();
    expect(screen.getByTestId("filter-all")).toBeInTheDocument();

    // Verify Today is selected by default
    expect(screen.getByTestId("selected-period-label").textContent).toContain("Today");
    expect(baseElement.textContent).toContain("Total Sales");
    expect(baseElement.textContent).toContain("Paid Orders");
    expect(baseElement.textContent).toContain("Average Order Value");
    expect(baseElement.textContent).toContain("Cancelled Orders");
    expect(baseElement.textContent).toContain("Best sellers");
    expect(baseElement.textContent).toContain("Payments");
    expect(baseElement.textContent).toContain("Download PDF Report");
  });

  it("switches to Select date filter and displays the date picker", async () => {
    await renderApp("/dashboard");

    await waitFor(() => {
      expect(screen.getByTestId("filter-date")).toBeInTheDocument();
    });

    const dateBtn = screen.getByTestId("filter-date");
    fireEvent.click(dateBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/Select date/i)).toBeInTheDocument();
      expect(screen.getByText("Specific Date")).toBeInTheDocument();
    });
  });

  it("switches to Select month filter and displays Month & Year dropdowns", async () => {
    await renderApp("/dashboard");

    await waitFor(() => {
      expect(screen.getByTestId("filter-month")).toBeInTheDocument();
    });

    const monthBtn = screen.getByTestId("filter-month");
    fireEvent.click(monthBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/Select month/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Select year/i)).toBeInTheDocument();
      expect(screen.getByText("Monthly View")).toBeInTheDocument();
    });
  });

  it("switches to Custom date range and displays From & To inputs", async () => {
    await renderApp("/dashboard");

    await waitFor(() => {
      expect(screen.getByTestId("filter-custom")).toBeInTheDocument();
    });

    const customBtn = screen.getByTestId("filter-custom");
    fireEvent.click(customBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/Start date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/End date/i)).toBeInTheDocument();
      expect(screen.getByText("Custom Range")).toBeInTheDocument();
    });
  });

  it("switches to All time filter and displays all historical records label", async () => {
    await renderApp("/dashboard");

    await waitFor(() => {
      expect(screen.getByTestId("filter-all")).toBeInTheDocument();
    });

    const allBtn = screen.getByTestId("filter-all");
    fireEvent.click(allBtn);

    await waitFor(() => {
      expect(screen.getByTestId("selected-period-label").textContent).toContain("All Time");
      expect(screen.getByText("All Time")).toBeInTheDocument();
    });
  });

  it("restricts staff users from accessing /dashboard and shows Access Restricted", async () => {
    const staffUser = {
      id: "staff-2",
      email: "staff2@cafemocha.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };
    const staffProfile = {
      id: "staff-2",
      email: "staff2@cafemocha.com",
      full_name: "Staff Barista",
      role: "staff",
      is_active: true,
    };

    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: {
        session: {
          access_token: "mock-token",
          user: staffUser,
        } as any,
      },
      error: null,
    });

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: staffProfile, error: null }),
          order: vi.fn().mockResolvedValue({ data: [staffProfile], error: null }),
        } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any;
    });

    const { baseElement } = await renderApp("/dashboard");

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Access Restricted");
      expect(baseElement.textContent).not.toContain("Total Sales");
    });
  });
});
