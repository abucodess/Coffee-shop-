import { useEffect, useState } from "react";
import { FolderPlus, Loader2, Sparkles, X } from "lucide-react";
import type { CategoryItem } from "@/lib/pos-data";

interface AddCategoryModalProps {
  existingCategories: CategoryItem[];
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
}

const QUICK_SUGGESTIONS = [
  "Hot Beverages",
  "Iced Beverages",
  "Tea & Infusions",
  "Sandwiches",
  "Desserts",
  "Breakfast",
  "Smoothies",
  "Snacks",
];

export function AddCategoryModal({
  existingCategories,
  onClose,
  onAdd,
}: AddCategoryModalProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a category name");
      return;
    }

    const exists = existingCategories.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      setError(`A category named "${trimmed}" already exists`);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onAdd(trimmed);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create category");
      setIsSubmitting(false);
    }
  };

  const handlePickSuggestion = (suggestion: string) => {
    setName(suggestion);
    setError(null);
  };

  // Filter suggestions to exclude already existing categories
  const availableSuggestions = QUICK_SUGGESTIONS.filter(
    (s) => !existingCategories.some((c) => c.name.toLowerCase() === s.toLowerCase()),
  ).slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-ink/15 bg-paper p-6 shadow-card-lg animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber/15 text-coffee ring-6 ring-amber/5">
              <FolderPlus className="size-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-coffee">
                Add Category
              </h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Organize your FUWA dessert offerings.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-ink-soft hover:bg-ink/5 hover:text-coffee transition-colors disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="category-name" className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
              Category Name
            </label>
            <input
              id="category-name"
              type="text"
              autoFocus
              disabled={isSubmitting}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Smoothies, Desserts, Tea"
              className="w-full rounded-2xl border border-ink/20 bg-cream/70 px-4 py-3 text-base font-bold text-coffee placeholder:font-medium placeholder:text-ink-soft/60 focus:border-amber focus:bg-paper focus:outline-none focus:ring-2 focus:ring-amber/20 transition-all"
            />
            {error && (
              <p className="mt-2 text-xs font-bold text-tomato animate-in fade-in duration-150">
                {error}
              </p>
            )}
          </div>

          {/* Quick Suggestions */}
          {availableSuggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft mb-2">
                <Sparkles className="size-3 text-amber" />
                <span>Quick suggestions</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handlePickSuggestion(suggestion)}
                    className="rounded-full border border-ink/15 bg-cream/50 px-3 py-1 text-xs font-bold text-coffee hover:bg-amber/20 hover:border-amber transition-colors disabled:opacity-40"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-ink/10">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="press flex-1 rounded-2xl border border-ink/15 bg-paper py-3 text-sm font-extrabold text-coffee hover:bg-ink/5 disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="press flex-1 flex items-center justify-center gap-2 rounded-2xl bg-amber py-3 text-sm font-extrabold text-coffee shadow-card hover:brightness-105 disabled:opacity-40 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Creating…</span>
                </>
              ) : (
                <span>Create category</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
