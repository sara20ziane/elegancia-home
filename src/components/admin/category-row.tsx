import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n-context";
import type { AdminCategory } from "@/lib/admin-categories";

const COPY = {
  fr: {
    arabic: "Arabe",
    french: "Français",
    order: "Ordre",
    visible: "Visible",
    hidden: "Masquée",
    models: (count: number) => `${count} modèle${count > 1 ? "s" : ""}`,
    moveUp: "Monter",
    moveDown: "Descendre",
    hide: "Masquer dans la boutique",
    show: "Afficher dans la boutique",
  },
  en: {
    arabic: "Arabic",
    french: "French",
    order: "Order",
    visible: "Visible",
    hidden: "Hidden",
    models: (count: number) => `${count} model${count === 1 ? "" : "s"}`,
    moveUp: "Move up",
    moveDown: "Move down",
    hide: "Hide from store",
    show: "Show in store",
  },
  ar: {
    arabic: "العربية",
    french: "الفرنسية",
    order: "الترتيب",
    visible: "ظاهرة",
    hidden: "مخفية",
    models: (count: number) => `${count} موديل`,
    moveUp: "رفع",
    moveDown: "خفض",
    hide: "إخفاء من المتجر",
    show: "إظهار في المتجر",
  },
} as const;

/** One storefront category, editable in place and ordered for merchandising. */
export function CategoryRow({
  category,
  position,
  first,
  last,
  busy,
  onRename,
  onToggle,
  onMove,
  onDelete,
}: {
  category: AdminCategory;
  position: number;
  first: boolean;
  last: boolean;
  busy: boolean;
  onRename: (name: string, nameFr: string | null) => void;
  onToggle: () => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const { t, locale } = useI18n();
  const c = COPY[locale] ?? COPY.fr;
  const [name, setName] = useState(category.name);
  const [nameFr, setNameFr] = useState(category.name_fr ?? "");
  const dirty = name.trim() !== category.name || nameFr.trim() !== (category.name_fr ?? "");

  return (
    <li className="rounded-[16px] border border-outline bg-surface p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex items-center gap-3 lg:self-center">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
            {String(position).padStart(2, "0")}
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-on-surface-muted">
              {c.order} {position}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={category.is_active ? "positive" : "neutral"}>
                {category.is_active ? c.visible : c.hidden}
              </Badge>
              <span className="font-mono text-xs text-on-surface-muted">
                {c.models(category.product_count)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs text-on-surface-muted">
            <span>{c.arabic}</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label={c.arabic}
              dir="rtl"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-on-surface-muted">
            <span>{c.french}</span>
            <Input
              value={nameFr}
              onChange={(event) => setNameFr(event.target.value)}
              aria-label={c.french}
              dir="ltr"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:self-center">
          {dirty && (
            <Button
              size="sm"
              disabled={busy || name.trim().length < 2}
              onClick={() => onRename(name.trim(), nameFr.trim() || null)}
            >
              <Check size={15} aria-hidden="true" />
              {t("common.save")}
            </Button>
          )}

          <span className="flex items-center gap-1">
            <IconButton
              label={c.moveUp}
              disabled={busy || first}
              onClick={() => onMove(-1)}
            >
              <ArrowUp size={15} />
            </IconButton>
            <IconButton
              label={c.moveDown}
              disabled={busy || last}
              onClick={() => onMove(1)}
            >
              <ArrowDown size={15} />
            </IconButton>
            <IconButton
              label={category.is_active ? c.hide : c.show}
              disabled={busy}
              onClick={onToggle}
            >
              {category.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
            </IconButton>
            <IconButton label={t("common.delete")} disabled={busy} onClick={onDelete} danger>
              <Trash2 size={15} />
            </IconButton>
          </span>
        </div>
      </div>
    </li>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  danger,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        "inline-flex size-9 items-center justify-center rounded-full border border-outline text-on-surface-muted transition-colors hover:bg-surface-mid disabled:opacity-40 " +
        (danger ? "hover:text-error" : "hover:text-on-surface")
      }
    >
      <span aria-hidden="true" className="contents">
        {children}
      </span>
    </button>
  );
}
