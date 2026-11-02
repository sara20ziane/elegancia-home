import type { frFinance } from "../locales/fr.finance";
export type FinanceKey = keyof typeof frFinance;
export const key = (value: string) => `finance.${value}` as FinanceKey;
