import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyLocaleToDocument,
  DEFAULT_LOCALE,
  detectLocale,
  hasLocaleCookie,
  persistLocale,
  readStoredLocale,
  translate,
  type Locale,
} from "./i18n";

import { I18nContext, type I18nValue } from "./locale-context";
/**
 * Locale provider.
 *
 * Starts from the locale the server rendered with, read from the same cookie, so
 * server and first client render agree and nothing flips after hydration. Only
 * a first visit has no cookie; then the browser's language is detected once and
 * remembered, so every later page is rendered right from the start.
 */
export function I18nProvider({
  initialLocale = DEFAULT_LOCALE,
  children,
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    if (hasLocaleCookie()) return;
    const next = readStoredLocale() ?? detectLocale();
    persistLocale(next);
    if (next !== initialLocale) setLocaleState(next);
    applyLocaleToDocument(next);
  }, [initialLocale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
    applyLocaleToDocument(next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
