/** Keep in sync with catalog_private.configuration_key; no derived or accounting fields. */
export function normalizeCommercial(value: string | number | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase();
}

type Configuration = {
  size?: string | null;
  set_type?: string | null;
  piece_count?: string | number | null;
  color_name?: string | null;
  color_hex?: string | null;
  fabric?: string | null;
  fabric_origin?: string | null;
};

export function configurationKey(value: Configuration): string {
  const colour = normalizeCommercial(value.color_name) || normalizeCommercial(value.color_hex);
  const pieces = normalizeCommercial(value.piece_count);
  return JSON.stringify([
    normalizeCommercial(value.size),
    normalizeCommercial(value.set_type),
    /^\d+$/.test(pieces) ? String(Number(pieces)) : pieces,
    colour,
    normalizeCommercial(value.fabric),
    normalizeCommercial(value.fabric_origin),
  ]);
}

export function configurationConflicts(
  proposed: Configuration[],
  existing: Configuration[] = [],
): boolean[] {
  const counts = new Map<string, number>();
  for (const value of proposed)
    counts.set(configurationKey(value), (counts.get(configurationKey(value)) ?? 0) + 1);
  const saved = new Set(existing.map(configurationKey));
  return proposed.map(
    (value) => saved.has(configurationKey(value)) || (counts.get(configurationKey(value)) ?? 0) > 1,
  );
}
