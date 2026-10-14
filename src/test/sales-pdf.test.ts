import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateSalesPdfReport } from "@/lib/sales-pdf";
import type { Order, MenuItem } from "@/lib/pos-data";

describe("Sales PDF Report Generation", () => {
  let writtenHtml = "";
  let mockPrint = vi.fn();

  beforeEach(() => {
    writtenHtml = "";
    mockPrint = vi.fn();

    const mockDocument = {
      open: vi.fn(),
      write: vi.fn((html: string) => {
        writtenHtml += html;
      }),
      close: vi.fn(),
    };

    const mockWindow = {
      document: mockDocument,
      print: mockPrint,
    };

    vi.spyOn(window, "open").mockReturnValue(mockWindow as unknown as Window);
  });

  const mockMenu: MenuItem[] = [
    {
      id: "p1",
      name: "Original Soufflé Pancake",
      note: "Fluffy pancake",
      price: 240,
      category: "Japanese Soufflé Pancakes",
      color: "amber",
      available: true,
      sortOrder: 1,
    },
    {
      id: "p2",
      name: "Chocolate Fluffy Soufflé",
      note: "Chocolate drizzle",
      price: 260,
      category: "Japanese Soufflé Pancakes",
      color: "amber",
      available: true,
      sortOrder: 2,
    },
    {
      id: "p3",
      name: "Iced Matcha Latte",
      note: "Kyoto matcha",
      price: 180,
      category: "Cold Drinks",
      color: "mint",
      available: true,
      sortOrder: 3,
    },
  ];

  const mockOrders: Order[] = [
    // Day 1 (e.g. 2026-10-10)
    {
      id: "ord-1",
      number: "A-101",
      invoiceNumber: "FUWA-2026-101",
      createdAt: new Date(2026, 9, 10, 10, 30).getTime(), // Oct 10, 2026 10:30 AM
      lines: [
        { id: "p1", name: "Original Soufflé Pancake", price: 240, qty: 2 },
        { id: "p3", name: "Iced Matcha Latte", price: 180, qty: 1 },
      ],
      subtotal: 660,
      tax: 0,
      total: 660,
      payment: "upi",
      status: "paid",
      customerName: "Aarav Sharma",
      customerPhone: "9876543210",
    },
    // Day 1 Order 2
    {
      id: "ord-2",
      number: "A-102",
      createdAt: new Date(2026, 9, 10, 14, 15).getTime(), // Oct 10, 2026 2:15 PM
      lines: [{ id: "p2", name: "Chocolate Fluffy Soufflé", price: 260, qty: 3 }],
      subtotal: 780,
      tax: 0,
      total: 780,
      payment: "cash",
      status: "paid",
      customerName: "Walk-in Guest",
    },
    // Day 2 (e.g. 2026-10-11)
    {
      id: "ord-3",
      number: "A-103",
      createdAt: new Date(2026, 9, 11, 11, 0).getTime(), // Oct 11, 2026 11:00 AM
      lines: [
        { id: "p1", name: "Original Soufflé Pancake", price: 240, qty: 1 },
        { id: "p2", name: "Chocolate Fluffy Soufflé", price: 260, qty: 1 },
      ],
      subtotal: 500,
      tax: 0,
      total: 500,
      payment: "card",
      status: "paid",
    },
  ];

  it("generates sales report with company phone +91 90480 37530 and FSSAI", () => {
    generateSalesPdfReport({
      timeframe: "October 2026",
      generatedAt: new Date(2026, 9, 14, 15, 0),
      orders: mockOrders,
      menu: mockMenu,
    });

    expect(window.open).toHaveBeenCalledWith("", "_blank");
    expect(writtenHtml).toContain("+91 90480 37530");
    expect(writtenHtml).toContain("21326223001036");
    expect(writtenHtml).toContain("FUWA - Japanese Fluffy Desserts");
    expect(writtenHtml).toContain("October 2026");
  });

  it("organizes orders day by day with daily order details", () => {
    generateSalesPdfReport({
      timeframe: "October 2026",
      generatedAt: new Date(2026, 9, 14, 15, 0),
      orders: mockOrders,
      menu: mockMenu,
    });

    // Contains day-by-day dates
    expect(writtenHtml).toContain("October 2026");
    expect(writtenHtml).toContain("Daily Order Details");

    // Orders listed under respective days
    expect(writtenHtml).toContain("A-101");
    expect(writtenHtml).toContain("A-102");
    expect(writtenHtml).toContain("A-103");
    expect(writtenHtml).toContain("Aarav Sharma");
    expect(writtenHtml).toContain("+91 9876543210");
    expect(writtenHtml).toContain("upi");
    expect(writtenHtml).toContain("cash");
    expect(writtenHtml).toContain("card");
  });

  it("displays product units sold breakdown at the end of the report", () => {
    generateSalesPdfReport({
      timeframe: "October 2026",
      generatedAt: new Date(2026, 9, 14, 15, 0),
      orders: mockOrders,
      menu: mockMenu,
    });

    // Check that Product Sales Summary section exists
    expect(writtenHtml).toContain("Product Sales Summary — Total Units Sold Per Product");

    // Total units:
    // Chocolate: 3 + 1 = 4 units
    // Original: 2 + 1 = 3 units
    // Matcha: 1 unit
    // Total: 8 units
    expect(writtenHtml).toContain("Chocolate Fluffy Soufflé");
    expect(writtenHtml).toContain("Original Soufflé Pancake");
    expect(writtenHtml).toContain("Iced Matcha Latte");
    expect(writtenHtml).toContain("4 <span style=\"font-size: 10px; font-weight: normal; color: #7d7265;\">units</span>");
    expect(writtenHtml).toContain("3 <span style=\"font-size: 10px; font-weight: normal; color: #7d7265;\">units</span>");
    expect(writtenHtml).toContain("1 <span style=\"font-size: 10px; font-weight: normal; color: #7d7265;\">units</span>");
    expect(writtenHtml).toContain("8 units");

    // Ensure Product Sales Summary is located AFTER Daily Order Details in the HTML
    const dailyDetailsIndex = writtenHtml.indexOf("Daily Order Details");
    const productSummaryIndex = writtenHtml.indexOf("Product Sales Summary — Total Units Sold Per Product");
    expect(dailyDetailsIndex).toBeGreaterThan(0);
    expect(productSummaryIndex).toBeGreaterThan(dailyDetailsIndex);
  });
});
