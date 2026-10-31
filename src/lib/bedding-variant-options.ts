import type { CatalogueVariant } from "./queries";

export type BeddingChoice = {
  colour: string | null;
  fabric: string | null;
  setType: string | null;
  pieceCount: number | null;
  mattress: string | null;
};

export type BeddingOption<T extends string | number> = {
  value: T;
  inStock: boolean;
};

export function isBeddingProduct(variants: CatalogueVariant[]): boolean {
  return variants.some(
    (variant) =>
      Boolean(variant.fabric) ||
      Boolean(variant.set_type) ||
      variant.piece_count !== null ||
      Boolean(variant.composition) ||
      Boolean(variant.fitted_sheet_size) ||
      Boolean(variant.duvet_cover_size),
  );
}

export function beddingChoiceForVariant(variant: CatalogueVariant | undefined): BeddingChoice {
  return {
    colour: variant?.color_name ?? null,
    fabric: variant?.fabric ?? null,
    setType: variant?.set_type ?? null,
    pieceCount: variant?.piece_count ?? null,
    mattress: variant?.size ?? null,
  };
}

export function initialBeddingChoice(variants: CatalogueVariant[]): BeddingChoice {
  const first = variants.find((variant) => variant.stock > 0) ?? variants[0];
  return beddingChoiceForVariant(first);
}

type BeddingFilter = Partial<BeddingChoice>;

function matchesFilter(variant: CatalogueVariant, filter: BeddingFilter): boolean {
  if (filter.colour !== undefined && variant.color_name !== filter.colour) return false;
  if (filter.fabric !== undefined && variant.fabric !== filter.fabric) return false;
  if (filter.setType !== undefined && variant.set_type !== filter.setType) return false;
  if (filter.pieceCount !== undefined && variant.piece_count !== filter.pieceCount) return false;
  if (filter.mattress !== undefined && variant.size !== filter.mattress) return false;
  return true;
}

export function chooseBeddingVariant(
  variants: CatalogueVariant[],
  filter: BeddingFilter,
): CatalogueVariant | null {
  const matches = variants.filter((variant) => matchesFilter(variant, filter));
  return matches.find((variant) => variant.stock > 0) ?? matches[0] ?? null;
}

export function findBeddingVariant(
  variants: CatalogueVariant[],
  choice: BeddingChoice,
): CatalogueVariant | null {
  return chooseBeddingVariant(variants, choice);
}

function uniqueOptions<T extends string | number>(
  variants: CatalogueVariant[],
  valueOf: (variant: CatalogueVariant) => T | null,
): BeddingOption<T>[] {
  const options = new Map<T, BeddingOption<T>>();
  for (const variant of variants) {
    const value = valueOf(variant);
    if (value === null) continue;
    const current = options.get(value);
    if (current) current.inStock ||= variant.stock > 0;
    else options.set(value, { value, inStock: variant.stock > 0 });
  }
  return [...options.values()];
}

function matchesColour(variant: CatalogueVariant, colour: string | null): boolean {
  return colour === null || variant.color_name === colour;
}

export function beddingColourOptions(variants: CatalogueVariant[]): BeddingOption<string>[] {
  return uniqueOptions(variants, (variant) => variant.color_name);
}

export function fabricOptions(
  variants: CatalogueVariant[],
  colour: string | null = null,
): BeddingOption<string>[] {
  const filtered = variants.filter((variant) => matchesColour(variant, colour));
  return uniqueOptions(filtered, (variant) => variant.fabric);
}

export function setTypeOptions(
  variants: CatalogueVariant[],
  fabric: string | null,
  colour: string | null = null,
): BeddingOption<string>[] {
  const filtered = variants.filter(
    (variant) =>
      matchesColour(variant, colour) && (fabric === null || variant.fabric === fabric),
  );
  return uniqueOptions(filtered, (variant) => variant.set_type);
}

export function pieceCountOptions(
  variants: CatalogueVariant[],
  fabric: string | null,
  setType: string | null,
  colour: string | null = null,
): BeddingOption<number>[] {
  const filtered = variants.filter(
    (variant) =>
      matchesColour(variant, colour) &&
      (fabric === null || variant.fabric === fabric) &&
      (setType === null || variant.set_type === setType),
  );
  return uniqueOptions(filtered, (variant) => variant.piece_count);
}

export function mattressOptions(
  variants: CatalogueVariant[],
  fabric: string | null,
  setType: string | null,
  pieceCount: number | null,
  colour: string | null = null,
): BeddingOption<string>[] {
  const filtered = variants.filter(
    (variant) =>
      matchesColour(variant, colour) &&
      (fabric === null || variant.fabric === fabric) &&
      (setType === null || variant.set_type === setType) &&
      (pieceCount === null || variant.piece_count === pieceCount),
  );
  return uniqueOptions(filtered, (variant) => variant.size);
}
