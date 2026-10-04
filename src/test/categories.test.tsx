import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddCategoryModal } from "@/components/AddCategoryModal";
import { DeleteCategoryModal } from "@/components/DeleteCategoryModal";
import { addCategory, deleteCategory, usePos } from "@/lib/pos-store";
import * as posApi from "@/lib/pos-api";
import type { CategoryItem, MenuItem } from "@/lib/pos-data";

describe("Category Management", () => {
  const mockCategories: CategoryItem[] = [
    { id: "espresso", name: "Espresso" },
    { id: "cold", name: "Cold" },
    { id: "pastry", name: "Pastry" },
  ];

  const mockItems: MenuItem[] = [
    {
      id: "flat-white",
      name: "Flat White",
      note: "Double ristretto",
      price: 220,
      category: "Espresso",
      color: "lemon",
      available: true,
    },
  ];

  describe("AddCategoryModal", () => {
    it("renders modal with category input and quick suggestions", () => {
      render(
        <AddCategoryModal
          existingCategories={mockCategories}
          onClose={vi.fn()}
          onAdd={vi.fn()}
        />,
      );

      expect(screen.getByRole("heading", { name: /add category/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. Smoothies/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /create category/i })).toBeInTheDocument();
    });

    it("prevents submitting an existing category name", async () => {
      const onAdd = vi.fn();
      render(
        <AddCategoryModal
          existingCategories={mockCategories}
          onClose={vi.fn()}
          onAdd={onAdd}
        />,
      );

      const input = screen.getByPlaceholderText(/e\.g\. Smoothies/i);
      fireEvent.change(input, { target: { value: "Espresso" } });
      fireEvent.click(screen.getByRole("button", { name: /create category/i }));

      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      expect(onAdd).not.toHaveBeenCalled();
    });

    it("submits a new unique category name successfully", async () => {
      const onAdd = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      render(
        <AddCategoryModal
          existingCategories={mockCategories}
          onClose={onClose}
          onAdd={onAdd}
        />,
      );

      const input = screen.getByPlaceholderText(/e\.g\. Smoothies/i);
      fireEvent.change(input, { target: { value: "Smoothies" } });
      fireEvent.click(screen.getByRole("button", { name: /create category/i }));

      await waitFor(() => {
        expect(onAdd).toHaveBeenCalledWith("Smoothies");
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe("DeleteCategoryModal", () => {
    it("warns and disables delete when items exist in the category", () => {
      const onConfirm = vi.fn();
      render(
        <DeleteCategoryModal
          category={mockCategories[0]}
          itemsInCategory={mockItems}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />,
      );

      expect(screen.getByText(/cannot delete category/i)).toBeInTheDocument();
      expect(screen.getByText(/flat white/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /understood/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /delete category/i })).not.toBeInTheDocument();
    });

    it("allows deletion when category is empty", async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      render(
        <DeleteCategoryModal
          category={{ id: "empty-cat", name: "Empty Category" }}
          itemsInCategory={[]}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />,
      );

      expect(screen.getByRole("heading", { name: /delete category/i })).toBeInTheDocument();
      expect(screen.getByText(/0 products assigned/i)).toBeInTheDocument();

      const deleteBtn = screen.getByRole("button", { name: /delete category/i });
      fireEvent.click(deleteBtn);

      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe("Store Category Actions", () => {
    it("prevents deleting category with items in pos-store", async () => {
      await expect(deleteCategory("Espresso")).rejects.toThrow(/still belong to it/i);
    });

    it("rejects empty category names in addCategory", async () => {
      await expect(addCategory("   ")).rejects.toThrow(/cannot be empty/i);
    });
  });
});
