export function skuToken(value: string, fallback = "MODELE"): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/œ/gi, "OE")
      .replace(/æ/gi, "AE")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  );
}

/** Preview contract shared with catalog_private.sku_base; DB claims resolve concurrent collisions. */
function shortToken(value: string, fallback: string, length: number) {
  return skuToken(value, fallback).slice(0, length).replace(/-$/, "");
}

export function generateSku(
  model: string,
  setType: string,
  size: string,
  colour: string,
  used: Iterable<string> = [],
): string {
  const type =
    setType === "Parure housse de couette"
      ? "HC"
      : setType === "Parure de drap"
        ? "DR"
        : shortToken(setType, "SET", 5);
  const bed =
    size === "Queen size" ? "QN" : size === "King size" ? "KG" : shortToken(size, "TAILLE", 8);
  const base =
    `ELG-${shortToken(model, "MODELE", 14)}-${type}-${bed}-${shortToken(colour, "UNI", 6)}`
      .slice(0, 36)
      .replace(/-$/, "");
  const taken = new Set(used);
  let sku = base;
  for (let n = 2; taken.has(sku); n++) {
    const suffix = `-${String(n).padStart(2, "0")}`;
    sku = `${base.slice(0, 40 - suffix.length)}${suffix}`;
  }
  return sku;
}
