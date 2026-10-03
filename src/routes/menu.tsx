import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { CATEGORIES, fmt, type Category, type MenuItem } from "@/lib/pos-data";
import { deleteMenuItem, saveMenuItem, toggleAvailability, usePos } from "@/lib/pos-store";
import { DeleteItemModal } from "@/components/DeleteItemModal";

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
      { title: "Menu — Mocha Counter POS" },
      { name: "description", content: "Manage menu items, prices and stock availability." },
      { property: "og:title", content: "Menu — Mocha Counter POS" },
      { property: "og:description", content: "Manage menu items, prices and stock availability." },
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
  const menuLoading = usePos((s) => s.menuLoading);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Group items by category in a single pass O(N) with memoization
  const groupedMenu = useMemo(() => {
    const map = new Map<Category, MenuItem[]>();
    CATEGORIES.forEach((c) => map.set(c, []));
    menu.forEach((item) => {
      const list = map.get(item.category);
      if (list) list.push(item);
    });
    return map;
  }, [menu]);

  const blank = (): MenuItem => ({
    id: `item-${Date.now()}`,
    name: "",
    note: "",
    price: 0,
    category: "Espresso",
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

  const handleConfirmDelete = async () => {
    if (!itemToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteMenuItem(itemToDelete.id);
      toast.success(`${itemToDelete.name} deleted`);
      setItemToDelete(null);
    } catch {
      toast.error("Failed to delete menu item");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Menu</h1>
          {menuLoading && (
            <p className="mt-1 font-mono text-xs text-ink-soft">Syncing menu with Supabase…</p>
          )}
        </div>
        <button
          onClick={() => setEditing(blank())}
          className="press rounded-xl bg-amber px-5 py-3 text-sm font-extrabold text-coffee shadow-card"
        >
          + Add item
        </button>
      </div>

      {CATEGORIES.map((cat) => {
        const items = groupedMenu.get(cat) || [];
        if (!items.length) return null;
        return (
          <section key={cat} className="mb-6">
            <h2 className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-ink-soft">
              {cat}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-card">
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-ink/10" : ""}`}
                >
                  <span
                    className={`size-8 shrink-0 rounded-lg border border-ink/10 ${SWATCH[item.color]}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate font-bold ${item.available ? "" : "text-ink-soft line-through"}`}
                    >
                      {item.name}
                    </div>
                    <div className="truncate text-xs text-ink-soft">{item.note}</div>
                  </div>
                  <span className="font-mono text-sm font-bold">{fmt(item.price)}</span>
                  <button
                    onClick={() => handleToggle(item.id)}
                    className={`press w-28 shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                      item.available ? "bg-mint-soft text-mint" : "bg-tomato/15 text-tomato"
                    }`}
                  >
                    {item.available ? "Available" : "Out of stock"}
                  </button>
                  <button
                    onClick={() => setEditing(item)}
                    className="rounded-lg px-3 py-1.5 text-sm font-bold text-ink-soft hover:bg-ink/5 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemToDelete(item)}
                    className="rounded-lg p-1.5 text-ink-soft hover:text-tomato hover:bg-tomato/10 transition-colors"
                    title={`Delete ${item.name}`}
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {editing && (
        <EditModal
          item={editing}
          isNew={!menu.some((m) => m.id === editing.id)}
          onClose={() => setEditing(null)}
          onDeleteRequest={(item) => {
            setEditing(null);
            setItemToDelete(item);
          }}
        />
      )}

      {itemToDelete && (
        <DeleteItemModal
          item={itemToDelete}
          onClose={() => {
            if (!isDeleting) setItemToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
        />
      )}
    </main>
  );
}

function EditModal({
  item,
  isNew,
  onClose,
  onDeleteRequest,
}: {
  item: MenuItem;
  isNew: boolean;
  onClose: () => void;
  onDeleteRequest: (item: MenuItem) => void;
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
        className="w-full max-w-md space-y-3 rounded-2xl bg-paper p-6 shadow-card-lg"
      >
        <h2 className="text-xl font-extrabold">{isNew ? "New item" : "Edit item"}</h2>
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
            Category
            <select
              className={field}
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
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
                className={`size-8 rounded-lg border-2 ${SWATCH[c]} ${draft.color === c ? "border-coffee" : "border-ink/10"}`}
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
