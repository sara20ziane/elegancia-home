import { enFinance } from "./en.finance";
import { enUpdates } from "./en.updates";
import type { TranslationKey } from "../i18n";
import { enAdmin } from "./en.admin";
import { enTools } from "./en.tools";
import { enStorefront } from "./en.storefront";

/** Mirrors the Arabic keys exactly; a missing key is a compile error. */
export const en: Record<TranslationKey, string> = {
  ...enFinance,
  ...enStorefront,
  ...enAdmin,
  ...enTools,
  ...enUpdates,
};
