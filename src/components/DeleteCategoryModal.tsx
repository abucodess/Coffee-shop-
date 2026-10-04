import { useEffect } from "react";
import { AlertCircle, AlertTriangle, Loader2, Tag, Trash2, X } from "lucide-react";
import { fmt, type CategoryItem, type MenuItem } from "@/lib/pos-data";

interface DeleteCategoryModalProps {
  category: CategoryItem;
  itemsInCategory: MenuItem[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteCategoryModal({
  category,
  itemsInCategory,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteCategoryModalProps) {
  const hasItems = itemsInCategory.length > 0;

  // Dismiss on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, onClose]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDeleting || hasItems) return;
    await onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={() => {
        if (!isDeleting) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-ink/15 bg-paper p-6 shadow-card-lg animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
                hasItems
                  ? "bg-amber/15 text-amber ring-6 ring-amber/5"
                  : "bg-tomato/10 text-tomato ring-6 ring-tomato/5"
              }`}
            >
              {hasItems ? (
                <AlertCircle className="size-6 stroke-[2.2]" />
              ) : (
                <Trash2 className="size-6 stroke-[2.2]" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-coffee">
                {hasItems ? "Cannot Delete Category" : "Delete Category"}
              </h2>
              <p className="text-xs text-ink-soft mt-0.5">
                {hasItems
                  ? "Category has active food & drink items"
                  : "Permanently remove empty category"}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-ink-soft hover:bg-ink/5 hover:text-coffee transition-colors disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        {hasItems ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-amber/30 bg-amber/10 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="size-4 shrink-0 text-amber mt-0.5" />
                <div className="text-xs text-coffee font-medium leading-relaxed">
                  <span className="font-bold">"{category.name}"</span> contains{" "}
                  <span className="font-bold">{itemsInCategory.length}</span>{" "}
                  {itemsInCategory.length === 1 ? "product" : "products"}. To
                  protect orders and database integrity, categories with items
                  cannot be deleted.
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft mb-2">
                Items in this category:
              </p>
              <div className="max-h-40 overflow-y-auto divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-cream/50 px-3">
                {itemsInCategory.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 text-xs"
                  >
                    <span className="font-bold text-coffee truncate mr-2">
                      {item.name}
                    </span>
                    <span className="font-mono font-bold text-ink-soft shrink-0">
                      {fmt(item.price)}
                    </span>
                  </div>
                ))}
                {itemsInCategory.length > 5 && (
                  <div className="py-2 text-center text-[11px] font-bold text-ink-soft">
                    + {itemsInCategory.length - 5} more items
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-ink-soft leading-normal">
              Please delete or reassign these items to another category before
              deleting <span className="font-bold text-coffee">"{category.name}"</span>.
            </p>

            <div className="pt-2 border-t border-ink/10">
              <button
                type="button"
                onClick={onClose}
                className="press w-full rounded-2xl bg-coffee py-3 text-sm font-extrabold text-cream shadow-card hover:bg-coffee/90 transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-ink/10 bg-cream/60 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper border border-ink/10 text-ink-soft">
                  <Tag className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-extrabold text-base text-coffee">
                    {category.name}
                  </h3>
                  <p className="text-xs text-ink-soft">0 products assigned</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-ink-soft leading-normal">
              Are you sure you want to delete{" "}
              <span className="font-bold text-coffee">"{category.name}"</span>?
              It will be removed immediately from both the admin menu and staff
              billing screen.
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-ink/10">
              <button
                type="button"
                disabled={isDeleting}
                onClick={onClose}
                className="press flex-1 rounded-2xl border border-ink/15 bg-paper py-3 text-sm font-extrabold text-coffee hover:bg-ink/5 disabled:opacity-40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="press flex-1 flex items-center justify-center gap-2 rounded-2xl bg-tomato py-3 text-sm font-extrabold text-cream shadow-card hover:bg-tomato/90 disabled:opacity-40 transition-all"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4" />
                    <span>Delete category</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
