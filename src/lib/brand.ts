import type { Locale } from "./i18n";

export const BRAND_NAME = "Cotonia Home";
export const BRAND_HORIZONTAL = "/brand/cotonia-horizontal.svg";
export const BRAND_MONOGRAM = "/brand/cotonia-monogram.svg";

const copy = {
  fr: {
    category: "Linge de maison",
    description: "Découvrez le linge de maison Cotonia Home, du linge de lit aux plaids et jetées.",
    menu: "Navigation principale",
    openMenu: "Ouvrir le menu",
  },
  en: {
    category: "Home linens",
    description: "Discover Cotonia Home linens, from bedding to blankets and throws.",
    menu: "Main navigation",
    openMenu: "Open menu",
  },
  ar: {
    category: "مفروشات الدار",
    description: "اكتشفي مفروشات Cotonia Home، من أطقم الفرش حتى البلايدات وأغطية السرير.",
    menu: "القائمة الرئيسية",
    openMenu: "افتحي القائمة",
  },
} satisfies Record<Locale, Record<string, string>>;

export function brandCopy(locale: Locale) {
  return copy[locale];
}

export function rebrandStoreCopy(text: string | null | undefined) {
  return text?.replace(/\bElegancia(?:\s+Home)?\b/gi, BRAND_NAME) ?? null;
}
