import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, translate, type Locale, type TranslationKey } from "./i18n";
export type I18nValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

export const I18nContext = createContext<I18nValue | null>(null);

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Outside the provider (a stray component in a test) fall back to Arabic
  // rather than throwing, so a single missing wrapper cannot blank a page.
  return {
    locale: DEFAULT_LOCALE,
    dir: "rtl",
    setLocale: () => {},
    t: (key, vars) => translate(DEFAULT_LOCALE, key, vars),
  };
}

/** Shorthand for the common case of only needing the translator. */
export function useT() {
  return useI18n().t;
}
