import type { PresetField } from "@/lib/bedding-provenance";
import type { VariantDraft } from "./variant-draft";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { generateSku } from "@/lib/sku";
import type { GeneratedVariant } from "@/lib/variant-generator";
import { DraftFields } from "./variant-fields";

export function GeneratedPreview({
  conflicts,
  model,
  rows,
  onChange,
  differentPrices,
  differentStock,
}: {
  conflicts: boolean[];
  model: string;
  rows: GeneratedVariant[];
  onChange: (rows: GeneratedVariant[]) => void;
  differentPrices: boolean;
  differentStock: boolean;
}) {
  return (
    <div className="flex flex-col gap-3" aria-label="Aperçu des configurations">
      <p className="text-sm">
        Vérifie les propositions. Toute valeur est modifiable avant enregistrement.
      </p>
      {rows.map((row, index) => {
        const change = (next: GeneratedVariant) =>
          onChange(rows.map((old, i) => (i === index ? next : old)));
        return (
          <section
            key={index}
            className="rounded-[12px] border border-outline p-3"
            data-testid="generated-variant"
          >
            <PreviewSummary draft={row.draft} conflict={conflicts[index]} />
            <div className="grid gap-3 sm:grid-cols-2">
              {differentPrices && (
                <>
                  <Field label={`Prix ${row.draft.size}`}>
                    <Input
                      type="number"
                      value={row.draft.price}
                      onChange={(e) =>
                        change({ ...row, draft: { ...row.draft, price: e.target.value } })
                      }
                    />
                  </Field>
                  <Field label={`Prix barré ${row.draft.size}`}>
                    <Input
                      type="number"
                      value={row.draft.compare_at_price}
                      onChange={(e) =>
                        change({
                          ...row,
                          draft: { ...row.draft, compare_at_price: e.target.value },
                        })
                      }
                    />
                  </Field>
                </>
              )}
              {differentStock && (
                <Field label={`Stock ${row.draft.size}`}>
                  <Input
                    type="number"
                    value={row.draft.stock}
                    onChange={(e) =>
                      change({ ...row, draft: { ...row.draft, stock: e.target.value } })
                    }
                  />
                </Field>
              )}
            </div>
            <details>
              <summary className="cursor-pointer text-sm">Modifier cette configuration</summary>
              <DraftFields
                draft={row.draft}
                onChange={(draft) =>
                  change({ draft, automaticSku: draft.sku === row.draft.sku && row.automaticSku })
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  change({
                    automaticSku: true,
                    draft: {
                      ...row.draft,
                      sku: generateSku(
                        model,
                        row.draft.set_type,
                        row.draft.size,
                        row.draft.color_name,
                        rows.filter((_, i) => i !== index).map((item) => item.draft.sku),
                      ),
                    },
                  })
                }
              >
                Régénérer le SKU
              </Button>
            </details>
          </section>
        );
      })}
      <p className="text-xs text-on-surface-muted">
        Si un SKU automatique existe déjà, un suffixe sera ajouté à l’enregistrement.
      </p>
    </div>
  );
}

function PreviewSummary({ draft, conflict }: { draft: VariantDraft; conflict: boolean }) {
  return (
    <>
      {conflict && (
        <p role="alert" className="text-sm text-error">
          Cette configuration commerciale existe déjà. Modifie la taille, le type, les pièces, la
          couleur ou le tissu.
        </p>
      )}
      <h3 className="font-semibold">{draft.size}</h3>
      <p>
        {draft.set_type} · {draft.piece_count || "—"} pièces · {draft.price} DA · Stock{" "}
        {draft.stock}
      </p>
      <p className="text-sm">
        Drap-housse : {displayDimension(draft, "fitted_sheet_size")} · Housse :{" "}
        {displayDimension(draft, "duvet_cover_size")}
      </p>
      <p className="font-mono text-xs">{draft.sku}</p>
    </>
  );
}

function displayDimension(draft: VariantDraft, key: PresetField) {
  const origin = draft.provenance[key];
  return (
    draft[key] ||
    (origin.source === "preset" && origin.state === "not_applicable"
      ? "non applicable"
      : "à compléter")
  );
}
