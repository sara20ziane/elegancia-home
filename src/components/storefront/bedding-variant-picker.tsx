import type { CatalogueVariant } from "@/lib/queries";
import {
  beddingColourOptions,
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

function firstColourImage(variants: CatalogueVariant[], colour: string): string | null {
  for (const variant of variants) {
    if (variant.color_name !== colour) continue;
    const image = [...variant.variant_images].sort((a, b) => a.sort_order - b.sort_order)[0];
    if (image) return image.url;
  }
  return null;
}

function ColourChoiceRow({
  variants,
  selected,
  options,
  onSelect,
}: {
  variants: CatalogueVariant[];
  selected: string | null;
  options: BeddingOption<string>[];
  onSelect: (colour: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 text-sm font-medium text-on-surface">
        Couleur{selected ? ` : ${selected}` : ""}
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((option) => {
          const image = firstColourImage(variants, option.value);
          const active = option.value === selected;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              disabled={!option.inStock}
              aria-pressed={active}
              aria-label={`Couleur ${option.value}`}
              className={cn(
                "overflow-hidden rounded-[14px] border bg-surface text-left transition",
                active ? "border-primary ring-2 ring-primary/20" : "border-outline hover:border-primary/50",
                !option.inStock && "opacity-45",
              )}
            >
              {image ? (
                <img
                  src={image}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="block aspect-[4/3] w-full bg-surface-mid" aria-hidden="true" />
              )}
              <span className="block px-2.5 py-2 text-xs font-medium text-on-surface">
                {option.value}
              </span>
            </button>
          );
        })}
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
  const colours = beddingColourOptions(variants);
  const colour = choice.colour ?? null;
  const fabrics = fabricOptions(variants, colour);
  const setTypes = setTypeOptions(variants, choice.fabric, colour);
  const pieces = pieceCountOptions(variants, choice.fabric, choice.setType, colour);
  const mattresses = mattressOptions(
    variants,
    choice.fabric,
    choice.setType,
    choice.pieceCount,
    colour,
  );

  return (
    <div className="flex flex-col gap-5 rounded-[16px] border border-outline bg-surface/70 p-4 sm:p-5">
      <ColourChoiceRow
        variants={variants}
        selected={colour}
        options={colours}
        onSelect={(nextColour) => onChoose({ colour: nextColour })}
      />
      <ChoiceRow
        label="Tissu"
        selected={choice.fabric}
        options={fabrics}
        onSelect={(fabric) => onChoose({ colour, fabric })}
      />
      <ChoiceRow
        label="Type de parure"
        selected={choice.setType}
        options={setTypes}
        onSelect={(setType) => onChoose({ colour, fabric: choice.fabric, setType })}
      />
      <ChoiceRow
        label="Nombre de pièces"
        selected={choice.pieceCount}
        options={pieces}
        format={(count) => `${count} pièces`}
        onSelect={(pieceCount) =>
          onChoose({ colour, fabric: choice.fabric, setType: choice.setType, pieceCount })
        }
      />
      <ChoiceRow
        label="Taille"
        selected={choice.mattress}
        options={mattresses}
        onSelect={(mattress) =>
          onChoose({
            colour,
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
    ["Taille", variant.size],
    ["Dimension du matelas", variant.fitted_sheet_size],
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
