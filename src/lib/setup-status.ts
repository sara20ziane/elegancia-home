import type { StoreSettings } from "./store-settings";

/**
 * What a shop still shows buyers that is missing or made up.
 *
 * A fresh install ships demo contact details so the storefront renders, and the
 * reference shop went live with them: a WhatsApp button to a number nobody
 * answers and a tax number of zeros. This is the list the dashboard nags about
 * until each is real.
 */
export type SetupGap = "name" | "phone" | "whatsapp" | "delivery" | "legal";

const DEMO_NAMES = new Set(["", "my shop", "openstore dz"]);

/** Mirrors `is_valid_dz_phone()` in schema.sql: mobile or landline, local or +213. */
export function isValidDzPhone(raw: string | null | undefined): boolean {
  const p = (raw ?? "").replace(/[^0-9+]/g, "");
  return (
    /^0[5-7][0-9]{8}$/.test(p) ||
    /^\+?213[5-7][0-9]{8}$/.test(p) ||
    /^0[2-4][0-9]{7,8}$/.test(p) ||
    /^\+?213[2-4][0-9]{7,8}$/.test(p)
  );
}

/** The demo seed's numbers are mostly zeros; a real one never is. */
export function isPlaceholder(value: string | null | undefined): boolean {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 0 || /0{6,}/.test(digits);
}

export function setupGaps(settings: StoreSettings | null, zoneCount: number): SetupGap[] {
  if (!settings) return [];
  const gaps: SetupGap[] = [];
  if (DEMO_NAMES.has(settings.name.trim().toLowerCase())) gaps.push("name");
  if (!isValidDzPhone(settings.phone) || isPlaceholder(settings.phone)) gaps.push("phone");
  if (isPlaceholder(settings.whatsapp)) gaps.push("whatsapp");
  if (zoneCount === 0) gaps.push("delivery");
  if (
    !settings.legal_name?.trim() ||
    isPlaceholder(settings.nif) ||
    isPlaceholder(settings.rc_number)
  ) {
    gaps.push("legal");
  }
  return gaps;
}
