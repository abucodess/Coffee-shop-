import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FolderPlus, Plus, Tag, Trash2 } from "lucide-react";
import { fmt, type CategoryItem, type MenuItem } from "@/lib/pos-data";
import {
  addCategory,
  deleteCategory,
  deleteMenuItem,
  saveMenuItem,
  toggleAvailability,
  usePos,
} from "@/lib/pos-store";
import { DeleteItemModal } from "@/components/DeleteItemModal";
import { AddCategoryModal } from "@/components/AddCategoryModal";
import { DeleteCategoryModal } from "@/components/DeleteCategoryModal";
import { AdminRoute } from "@/auth";

function ProtectedMenuPage() {
  return (
    <AdminRoute>
      <MenuPage />
    </AdminRoute>
  );
}

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — FUWA Japanese Fluffy Desserts" },
      { name: "description", content: "Manage dessert menu items, prices and stock availability for FUWA." },
      { property: "og:title", content: "Menu — FUWA Japanese Fluffy Desserts" },
      { property: "og:description", content: "Manage dessert menu items, prices and stock availability for FUWA." },
    ],
  }),
  component: ProtectedMenuPage,
});

const COLORS: MenuItem["color"][] = [
  "lemon",
  "coral",
  "mint-soft",
  "lilac",
  "clay",
  "sky",
  "paper",
];

const SWATCH: Record<string, string> = {
  lemon: "bg-lemon",
  coral: "bg-coral",
  "mint-soft": "bg-mint-soft",
  lilac: "bg-lilac",
  clay: "bg-clay",
  sky: "bg-sky",
  paper: "bg-paper",
};

function MenuPage() {
  const menu = usePos((s) => s.menu);
  const categories = usePos((s) => s.categories);
  const menuLoading = usePos((s) => s.menuLoading);
  const categoriesLoading = usePos((s) => s.categoriesLoading);

  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Group items by category in a single pass O(N) with memoization
  const groupedMenu = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    // First seed all known categories
    categories.forEach((c) => map.set(c.name, []));

    // Place each menu item in its category
    menu.forEach((item) => {
      const list = map.get(item.category);
      if (list) {
        list.push(item);
      } else {
        // If an item has a category not yet in categories list, preserve it
        map.set(item.category, [item]);
      }
    });
    return map;
  }, [menu, categories]);

  // All category names to display (union of registered categories and any orphaned item categories)
  const allCategorySections = useMemo(() => {
    const list: { id: string; name: string }[] = [...categories];
    for (const item of menu) {
      if (!list.some((c) => c.name.toLowerCase() === item.category.toLowerCase())) {
        list.push({
          id: item.category.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          name: item.category,
        });
      }
    }
    return list;
  }, [categories, menu]);

  const blank = (defaultCategory?: string): MenuItem => ({
    id: `item-${Date.now()}`,
    name: "",
    note: "",
    price: 0,
    category: defaultCategory || (categories[0]?.name ?? "Japanese Soufflé Pancakes"),
    color: "lemon",
    available: true,
  });

  const handleToggle = async (itemId: string) => {
    try {
      await toggleAvailability(itemId);
    } catch {
      toast.error("Failed to update availability");
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete || isDeletingItem) return;
    setIsDeletingItem(true);
    try {
      await deleteMenuItem(itemToDelete.id);
      toast.success(`${itemToDelete.name} deleted`);
      setItemToDelete(null);
    } catch {
      toast.error("Failed to delete menu item");
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleAddCategory = async (name: string) => {
    try {
      const created = await addCategory(name);
      toast.success(`Category "${created.name}" created`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create category");
      throw err;
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete || isDeletingCategory) return;
    setIsDeletingCategory(true);
    try {
      await deleteCategory(categoryToDelete.id);
      toast.success(`Category "${categoryToDelete.name}" deleted`);
      setCategoryToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete category");
    } finally {
      setIsDeletingCategory(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fuwa-brown sm:text-3xl">Menu Management</h1>
          <p className="mt-1 text-xs sm:text-sm text-fuwa-brown/65">
            Manage dessert menu items, prices, stock availability, and food categories.
          </p>
          {(menuLoading || categoriesLoading) && (
            <p className="mt-1 font-mono text-xs text-fuwa-brown/60">Syncing menu with database…</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsAddCategoryOpen(true)}
            className="press flex items-center gap-2 rounded-xl border border-fuwa-brown/15 bg-fuwa-surface px-4 py-2.5 text-xs font-extrabold text-fuwa-brown shadow-xs hover:bg-fuwa-cream/50 transition-colors"
          >
            <FolderPlus className="size-4 text-fuwa-orange" />
            <span>+ Add category</span>
          </button>
          <button
            onClick={() => setEditing(blank())}
            className="press flex items-center gap-2 rounded-xl bg-fuwa-orange px-5 py-2.5 text-xs font-extrabold text-white shadow-card hover:bg-fuwa-orange-bright transition-all"
          >
            <Plus className="size-4 stroke-[3]" />
            <span>+ Add item</span>
          </button>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="mb-8 rounded-2xl border border-ink/10 bg-paper p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="size-3.5 text-ink-soft" />
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink-soft">
              Active Categories ({categories.length})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsAddCategoryOpen(true)}
            className="text-xs font-bold text-amber hover:underline"
          >
            + New Category
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const count = (groupedMenu.get(cat.name) || []).length;
            return (
              <div
                key={cat.id}
                className="group flex items-center gap-2 rounded-xl border border-ink/10 bg-cream/70 px-3 py-1.5 text-xs font-bold text-coffee"
              >
                <span>{cat.name}</span>
                <span className="rounded-full bg-paper px-1.5 py-0.5 font-mono text-[10px] text-ink-soft border border-ink/10">
                  {count}
                </span>
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(cat)}
                  className="rounded-md p-1 text-ink-soft hover:text-tomato hover:bg-tomato/10 transition-colors opacity-75 group-hover:opacity-100"
                  title={`Delete category "${cat.name}"`}
                  aria-label={`Delete category ${cat.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Sections */}
      {allCategorySections.map((cat) => {
        const items = groupedMenu.get(cat.name) || [];
        return (
          <section key={cat.id} className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink-soft">
                  {cat.name}
                </h2>
                <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-soft">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(blank(cat.name))}
                  className="rounded-lg px-2.5 py-1 text-xs font-bold text-coffee hover:bg-ink/5 transition-colors"
                >
                  + Add to {cat.name}
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(cat)}
                  className="rounded-lg p-1.5 text-ink-soft hover:text-tomato hover:bg-tomato/10 transition-colors"
                  title={`Delete category "${cat.name}"`}
                  aria-label={`Delete category ${cat.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink/20 bg-paper/60 p-6 text-center shadow-xs">
                <p className="text-sm font-medium text-ink-soft">
                  No items in <span className="font-bold text-coffee">"{cat.name}"</span> yet.
                </p>
                <button
                  type="button"
                  onClick={() => setEditing(blank(cat.name))}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-coffee underline underline-offset-4 hover:text-amber"
                >
                  Add the first item to {cat.name}
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-card">
                {items.map((item, i) => (
                  <div
                    key={item.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-cream/30 ${
                      i ? "border-t border-ink/10" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`size-8 shrink-0 rounded-lg border border-ink/10 shadow-xs ${
                          SWATCH[item.color] || "bg-lemon"
                        }`}
                      />
                      <div className="min-w-0">
                        <div
                          className={`truncate text-sm font-bold sm:text-base ${
                            item.available ? "text-ink" : "text-ink-soft line-through"
                          }`}
                        >
                          {item.name}
                        </div>
                        {item.note && (
                          <div className="truncate text-xs text-ink-soft">{item.note}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <span className="font-mono text-sm font-bold text-coffee">{fmt(item.price)}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggle(item.id)}
                          className={`press w-28 shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                            item.available ? "bg-mint-soft text-mint shadow-xs" : "bg-tomato/15 text-tomato shadow-xs"
                          }`}
                        >
                          {item.available ? "Available" : "Out of stock"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(item)}
                          className="press rounded-lg border border-ink/10 bg-cream/50 px-3 py-1.5 text-xs font-bold text-coffee hover:bg-cream transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="press rounded-lg p-1.5 text-ink-soft hover:text-tomato hover:bg-tomato/10 transition-colors"
                          title={`Delete ${item.name}`}
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Edit / New Item Modal */}
      {editing && (
        <EditModal
          item={editing}
          categories={categories}
          isNew={!menu.some((m) => m.id === editing.id)}
          onClose={() => setEditing(null)}
          onDeleteRequest={(item) => {
            setEditing(null);
            setItemToDelete(item);
          }}
          onOpenAddCategory={() => setIsAddCategoryOpen(true)}
        />
      )}

      {/* Delete Item Modal */}
      {itemToDelete && (
        <DeleteItemModal
          item={itemToDelete}
          onClose={() => {
            if (!isDeletingItem) setItemToDelete(null);
          }}
          onConfirm={handleConfirmDeleteItem}
          isDeleting={isDeletingItem}
        />
      )}

      {/* Add Category Modal */}
      {isAddCategoryOpen && (
        <AddCategoryModal
          existingCategories={categories}
          onClose={() => setIsAddCategoryOpen(false)}
          onAdd={handleAddCategory}
        />
      )}

      {/* Delete Category Modal */}
      {categoryToDelete && (
        <DeleteCategoryModal
          category={categoryToDelete}
          itemsInCategory={groupedMenu.get(categoryToDelete.name) || []}
          onClose={() => {
            if (!isDeletingCategory) setCategoryToDelete(null);
          }}
          onConfirm={handleConfirmDeleteCategory}
          isDeleting={isDeletingCategory}
        />
      )}
    </main>
  );
}

function EditModal({
  item,
  categories,
  isNew,
  onClose,
  onDeleteRequest,
  onOpenAddCategory,
}: {
  item: MenuItem;
  categories: CategoryItem[];
  isNew: boolean;
  onClose: () => void;
  onDeleteRequest: (item: MenuItem) => void;
  onOpenAddCategory: () => void;
}) {
  const [draft, setDraft] = useState(item);
  const [price, setPrice] = useState(item.price ? item.price.toFixed(2) : "");
  const [saving, setSaving] = useState(false);
  const valid = draft.name.trim() && Number(price) > 0;
  const field =
    "mt-1 w-full rounded-xl border border-ink/20 bg-cream px-3 py-2.5 font-medium outline-none focus:border-amber";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await saveMenuItem({
        ...draft,
        name: draft.name.trim(),
        price: Math.round(Number(price) * 100) / 100,
      });
      toast.success(isNew ? "Item added" : "Item updated");
      onClose();
    } catch {
      toast.error("Failed to save menu item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
        className="w-full max-w-md my-auto max-h-[92vh] overflow-y-auto space-y-3.5 rounded-3xl bg-paper p-6 shadow-2xl"
      >
        <h2 className="text-xl font-extrabold text-coffee">{isNew ? "New item" : "Edit item"}</h2>
        <label className="block text-sm font-bold">
          Name
          <input
            className={field}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            autoFocus
          />
        </label>
        <label className="block text-sm font-bold">
          Description
          <input
            className={field}
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-bold">
            Price
            <input
              className={field}
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </label>
          <label className="block text-sm font-bold">
            <div className="flex items-center justify-between">
              <span>Category</span>
              <button
                type="button"
                onClick={onOpenAddCategory}
                className="text-[11px] font-bold text-amber hover:underline"
              >
                + New
              </button>
            </div>
            <select
              className={field}
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              {!categories.some((c) => c.name === draft.category) && (
                <option value={draft.category}>{draft.category}</option>
              )}
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="text-sm font-bold">
          Tile color
          <div className="mt-1 flex gap-2">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setDraft({ ...draft, color: c })}
                aria-label={c}
                className={`size-8 rounded-lg border-2 ${SWATCH[c]} ${
                  draft.color === c ? "border-coffee" : "border-ink/10"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={!valid || saving}
            className="press flex-1 rounded-xl bg-coffee py-3 font-bold text-cream disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-xl border border-ink/15 px-4 py-3 font-bold disabled:opacity-40"
          >
            Cancel
          </button>
          {!isNew && (
            <button
              type="button"
              disabled={saving}
              onClick={() => onDeleteRequest(item)}
              className="rounded-xl px-3 py-3 font-bold text-tomato hover:bg-tomato/10 disabled:opacity-40 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
