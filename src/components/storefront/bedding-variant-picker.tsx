import type { CatalogueVariant } from "@/lib/queries";
import {
  fabricOptions,
  mattressOptions,
  pieceCountOptions,
  setTypeOptions,
  type BeddingChoice,
  type BeddingOption,
} from "@/lib/bedding-variant-options";
import { cn } from "@/lib/utils";

type ChoiceValue = string | number;

function ChoiceRow<T extends ChoiceValue>({
  label,
  selected,
  options,
  format = (value) => String(value),
  onSelect,
}: {
  label: string;
  selected: T | null;
  options: BeddingOption<T>[];
  format?: (value: T) => string;
  onSelect: (value: T) => void;
}) {
  if (options.length === 0) return null;

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 text-sm font-medium text-on-surface">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onSelect(option.value)}
            disabled={!option.inStock}
            aria-pressed={option.value === selected}
            className={cn("size-chip", option.value === selected && "active")}
          >
            {format(option.value)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function BeddingVariantPicker({
  variants,
  choice,
  onChoose,
}: {
  variants: CatalogueVariant[];
  choice: BeddingChoice;
  onChoose: (filter: Partial<BeddingChoice>) => void;
}) {
  const fabrics = fabricOptions(variants);
  const setTypes = setTypeOptions(variants, choice.fabric);
  const pieces = pieceCountOptions(variants, choice.fabric, choice.setType);
  const mattresses = mattressOptions(
    variants,
    choice.fabric,
    choice.setType,
    choice.pieceCount,
  );

  return (
    <div className="flex flex-col gap-5 rounded-[16px] border border-outline bg-surface/70 p-4 sm:p-5">
      <ChoiceRow
        label="Tissu"
        selected={choice.fabric}
        options={fabrics}
        onSelect={(fabric) => onChoose({ fabric })}
      />
      <ChoiceRow
        label="Type de parure"
        selected={choice.setType}
        options={setTypes}
        onSelect={(setType) => onChoose({ fabric: choice.fabric, setType })}
      />
      <ChoiceRow
        label="Nombre de pièces"
        selected={choice.pieceCount}
        options={pieces}
        format={(count) => `${count} pièces`}
        onSelect={(pieceCount) =>
          onChoose({ fabric: choice.fabric, setType: choice.setType, pieceCount })
        }
      />
      <ChoiceRow
        label="Dimension du matelas"
        selected={choice.mattress}
        options={mattresses}
        onSelect={(mattress) =>
          onChoose({
            fabric: choice.fabric,
            setType: choice.setType,
            pieceCount: choice.pieceCount,
            mattress,
          })
        }
      />
    </div>
  );
}

export function BeddingVariantDetails({ variant }: { variant: CatalogueVariant | null }) {
  if (!variant) return null;

  const dimensions = [
    ["Dimension du matelas", variant.size],
    [
      "Drap-housse",
      variant.fitted_sheet_size && variant.fitted_sheet_size !== variant.size
        ? variant.fitted_sheet_size
        : null,
    ],
    ["Drap plat", variant.flat_sheet_size],
    ["Housse de couette", variant.duvet_cover_size],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const hasDetails =
    Boolean(variant.composition) ||
    dimensions.length > 0 ||
    Boolean(variant.fabric) ||
    Boolean(variant.fabric_origin);
  if (!hasDetails) return null;

  return (
    <section className="rounded-[16px] bg-surface-mid/55 p-4 sm:p-5">
      <h2 className="font-display text-base font-semibold text-on-surface">Détails de votre parure</h2>

      {(variant.fabric || variant.fabric_origin) && (
        <p className="mt-2 text-sm text-on-surface-muted">
          {[variant.fabric, variant.fabric_origin ? `Origine : ${variant.fabric_origin}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {variant.composition && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-muted">
            Composition
          </p>
          <p className="mt-1 text-sm leading-6 text-on-surface">{variant.composition}</p>
        </div>
      )}

      {dimensions.length > 0 && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {dimensions.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 border-b border-outline/70 py-1.5">
              <dt className="text-on-surface-muted">{label}</dt>
              <dd className="font-medium text-on-surface" dir="ltr">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
