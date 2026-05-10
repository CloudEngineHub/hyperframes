import { memo, useEffect, useRef } from "react";

interface CardContextMenuProps {
  x: number;
  y: number;
  card: { id: string; path: string; title: string };
  onClose: () => void;
  onOpenPreview: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onEditSource: () => void;
}

const MENU_ITEMS = [
  { key: "preview", label: "Open in Preview", action: "onOpenPreview" },
  { key: "duplicate", label: "Duplicate", action: "onDuplicate" },
  { key: "delete", label: "Delete", action: "onDelete" },
  { key: "divider", label: "", action: "" },
  { key: "edit", label: "Edit Source", action: "onEditSource" },
] as const;

export const CardContextMenu = memo(function CardContextMenu({
  x,
  y,
  onClose,
  onOpenPreview,
  onDuplicate,
  onDelete,
  onEditSource,
}: CardContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const actions: Record<string, () => void> = {
    onOpenPreview,
    onDuplicate,
    onDelete,
    onEditSource,
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-xl bg-neutral-900 border border-neutral-700/60 shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: x, top: y }}
    >
      {MENU_ITEMS.map((item) =>
        item.key === "divider" ? (
          <div key="divider" className="my-1 mx-2 h-px bg-neutral-800" />
        ) : (
          <button
            key={item.key}
            type="button"
            className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
              item.key === "delete"
                ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
            }`}
            onClick={() => {
              actions[item.action]?.();
              onClose();
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
});
