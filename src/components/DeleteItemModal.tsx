import { useEffect } from "react";
import { AlertTriangle, Loader2, Tag, Trash2, X } from "lucide-react";
import { fmt, type MenuItem } from "@/lib/pos-data";

const SWATCH: Record<string, string> = {
  lemon: "bg-lemon",
  coral: "bg-coral",
  "mint-soft": "bg-mint-soft",
  lilac: "bg-lilac",
  clay: "bg-clay",
  sky: "bg-sky",
  paper: "bg-paper",
};

interface DeleteItemModalProps {
  item: MenuItem;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  isDeleting?: boolean;
}

export function DeleteItemModal({
  item,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteItemModalProps) {
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
    if (isDeleting) return;
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
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-tomato/10 text-tomato ring-6 ring-tomato/5">
              <Trash2 className="size-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-coffee">
                Delete Menu Item
              </h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Remove this product from the café catalog.
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

        {/* Item Summary Preview Card */}
        <div className="mt-5 rounded-2xl border border-ink/10 bg-cream/60 p-4">
          <div className="flex items-center gap-3.5">
            <span
              className={`size-11 shrink-0 rounded-xl border border-ink/15 shadow-xs ${
                SWATCH[item.color] || "bg-lemon"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-extrabold text-base text-coffee">
                  {item.name}
                </h3>
                <span className="font-mono text-base font-extrabold text-coffee shrink-0">
                  {fmt(item.price)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-paper px-2 py-0.5 text-[10px] font-bold text-ink-soft border border-ink/10">
                  <Tag className="size-2.5" />
                  {item.category}
                </span>
                {item.note && (
                  <span className="truncate text-xs text-ink-soft">{item.note}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Warning Callout */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-tomato/20 bg-tomato/10 p-3 text-xs text-tomato">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <p className="leading-snug">
            <strong>Warning:</strong> This item will be permanently removed from the
            cashier billing screen. Historical sales records and completed receipts will
            remain untouched.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="press rounded-xl border border-ink/20 bg-paper px-4 py-2.5 text-sm font-bold text-ink-soft hover:bg-ink/5 hover:text-coffee disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="press flex items-center justify-center gap-2 rounded-xl bg-tomato px-5 py-2.5 text-sm font-extrabold text-white shadow-md shadow-tomato/20 hover:bg-tomato/90 active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {isDeleting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Deleting…</span>
              </>
            ) : (
              <span>Yes, Delete Item</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
