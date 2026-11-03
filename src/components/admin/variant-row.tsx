import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/form";
import type { AdminVariant } from "@/lib/admin-products";
import { useI18n } from "@/lib/i18n-context";
import { Copy, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toDraft, type VariantDraft } from "./variant-draft";
import { DraftFields } from "./variant-fields";

/**
 * One Elegancia configuration row.
 *
 * Photos are managed once at model level. A configuration only carries the
 * commercial choices that affect what is sold: fabric, set type, piece count,
 * mattress dimension, price and stock.
 */
export function VariantRow({
  variant,
  busy,
  onSave,
  onDuplicate,
  onDelete,
}: {
  variant: AdminVariant;
  busy: boolean;
  onSave: (draft: VariantDraft, isActive: boolean) => void;
  onDuplicate: (draft: VariantDraft) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<VariantDraft>(() => toDraft(variant));
  const baseline = useRef(variant);
  useEffect(() => {
    const before = toDraft(baseline.current);
    const after = toDraft(variant);
    setDraft(
      (current) =>
        Object.fromEntries(
          Object.entries(current).map(([key, value]) => [
            key,
            value === before[key as keyof VariantDraft] ? after[key as keyof VariantDraft] : value,
          ]),
        ) as VariantDraft,
    );
    baseline.current = variant;
  }, [variant]);
  const [active, setActive] = useState(variant.is_active);

  return (
    <li className="flex flex-col gap-3 rounded-[16px] border border-outline bg-surface p-4">
      <DraftFields draft={draft} onChange={setDraft} />

      <div className="flex flex-wrap items-center gap-4">
        <Switch
          label={t("common.active")}
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        <Button size="sm" disabled={busy} onClick={() => onSave(draft, active)}>
          <Save size={15} aria-hidden="true" />
          {t("common.save")}
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => onDuplicate(draft)}>
          <Copy size={15} aria-hidden="true" />
          Dupliquer
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onDelete} className="text-error">
          <Trash2 size={15} aria-hidden="true" />
          {t("common.delete")}
        </Button>
      </div>
    </li>
  );
}
