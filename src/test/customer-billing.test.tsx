import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  sanitizePhoneDigits,
  validatePhoneNumber,
  type Order,
  type MenuItem,
} from "@/lib/pos-data";
import { ReceiptModal } from "@/components/Receipt";

describe("Customer Phone Number Validation", () => {
  it("sanitizes phone numbers correctly", () => {
    expect(sanitizePhoneDigits("9876543210")).toBe("9876543210");
    expect(sanitizePhoneDigits("98765 43210")).toBe("9876543210");
    expect(sanitizePhoneDigits("98765-43210")).toBe("9876543210");
    expect(sanitizePhoneDigits("+91 98765 43210")).toBe("9876543210");
    expect(sanitizePhoneDigits("09876543210")).toBe("9876543210");
    expect(sanitizePhoneDigits("abc98765xyz43210")).toBe("9876543210");
    // Max 10 digits
    expect(sanitizePhoneDigits("123456789012345")).toBe("1234567890");
  });

  it("validates that phone number must be exactly 10 digits", () => {
    // Valid cases
    expect(validatePhoneNumber("9876543210").isValid).toBe(true);
    expect(validatePhoneNumber("").isValid).toBe(true); // Optional
    expect(validatePhoneNumber("   ").isValid).toBe(true); // Optional
    expect(validatePhoneNumber(undefined).isValid).toBe(true);

    // Invalid cases
    const shortResult = validatePhoneNumber("987654321");
    expect(shortResult.isValid).toBe(false);
    expect(shortResult.error).toMatch(/10 digits/i);

    const longResult = validatePhoneNumber("98765432101");
    expect(longResult.isValid).toBe(false);
    expect(longResult.error).toMatch(/10 digits/i);

    const invalidCharsResult = validatePhoneNumber("98765abc10");
    expect(invalidCharsResult.isValid).toBe(false);
  });
});

describe("Receipt Display with Customer Details", () => {
  const dummyOrderWithCustomer: Order = {
    id: "order-test-1",
    number: "A-150",
    invoiceNumber: "MC-2026-150",
    createdAt: new Date("2026-10-06T14:30:00Z").getTime(),
    lines: [
      { name: "Flat White", price: 220, qty: 1 },
      { name: "Butter Croissant", price: 160, qty: 1 },
    ],
    subtotal: 380,
    tax: 0,
    total: 380,
    payment: "upi",
    status: "paid",
    cashier: "Staff 01",
    customerName: "Rahul Sharma",
    customerPhone: "9876543210",
  };

  const dummyOrderWithoutCustomer: Order = {
    id: "order-test-2",
    number: "A-151",
    invoiceNumber: "MC-2026-151",
    createdAt: new Date("2026-10-06T14:35:00Z").getTime(),
    lines: [{ name: "Espresso", price: 150, qty: 1 }],
    subtotal: 150,
    tax: 0,
    total: 150,
    payment: "cash",
    status: "paid",
    cashier: "Cashier",
  };

  it("renders customer name and phone on receipt when present", () => {
    render(<ReceiptModal order={dummyOrderWithCustomer} onClose={vi.fn()} />);

    expect(screen.getByText("Rahul Sharma")).toBeInTheDocument();
    expect(screen.getByText("9876543210")).toBeInTheDocument();
    expect(screen.getByText("Customer:")).toBeInTheDocument();
    expect(screen.getByText("Phone:")).toBeInTheDocument();
  });

  it("omits customer name and phone when not provided", () => {
    render(<ReceiptModal order={dummyOrderWithoutCustomer} onClose={vi.fn()} />);

    expect(screen.queryByText("Customer:")).not.toBeInTheDocument();
    expect(screen.queryByText("Phone:")).not.toBeInTheDocument();
  });
});

describe("Order Creation with Customer Details", () => {
  it("stores customerName and customerPhone on created order", async () => {
    const { createOrder } = await import("@/lib/pos-api");
    const testMenu: MenuItem = {
      id: "test-latte",
      name: "Iced Latte",
      note: "",
      price: 220,
      category: "Cold",
      color: "sky",
      available: true,
    };

    const order = await createOrder(
      [{ item: testMenu, qty: 2 }],
      "upi",
      0,
      "Barista Test",
      "Ananya Sen",
      "9988776655",
    );

    expect(order.customerName).toBe("Ananya Sen");
    expect(order.customerPhone).toBe("9988776655");
    expect(order.total).toBe(440);
  });
});

describe("Order Search Filtering by Customer", () => {
  const sampleOrders: Order[] = [
    {
      id: "o1",
      number: "A-101",
      createdAt: Date.now(),
      lines: [{ name: "Flat White", price: 220, qty: 1 }],
      subtotal: 220,
      tax: 0,
      total: 220,
      payment: "card",
      status: "paid",
      cashier: "Staff 01",
      customerName: "Vikram Malhotra",
      customerPhone: "9876543210",
    },
    {
      id: "o2",
      number: "A-102",
      createdAt: Date.now(),
      lines: [{ name: "Cold Brew", price: 260, qty: 1 }],
      subtotal: 260,
      tax: 0,
      total: 260,
      payment: "upi",
      status: "paid",
      cashier: "Staff 02",
      customerName: "Deepika Rao",
      customerPhone: "9123456789",
    },
  ];

  it("filters orders by customer name", () => {
    const q = "vikram";
    const filtered = sampleOrders.filter(
      (o) =>
        String(o.number).includes(q) ||
        (o.cashier && o.cashier.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.customerPhone && o.customerPhone.includes(q)),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.customerName).toBe("Vikram Malhotra");
  });

  it("filters orders by customer phone number", () => {
    const q = "91234";
    const filtered = sampleOrders.filter(
      (o) =>
        String(o.number).includes(q) ||
        (o.cashier && o.cashier.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.customerPhone && o.customerPhone.includes(q)),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.customerPhone).toBe("9123456789");
  });
});
