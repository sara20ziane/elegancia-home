import { describe, it, expect } from "vitest";
import { algiersDate, financePeriod, financeMoney, financeCsv } from "./period";
describe("périodes financières Africa/Algiers et DZD", () => {
  it("rattache minuit algérien à la bonne date", () => {
    expect(algiersDate(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01");
    expect(algiersDate(new Date("2026-10-31T22:30:00Z"))).toBe("2026-10-31");
  });
  it("calcule aujourd’hui, sept jours, mois et année", () => {
    expect(financePeriod("today", "2026-11-02")).toEqual({ from: "2026-11-02", to: "2026-11-02" });
    expect(financePeriod("week", "2026-11-02").from).toBe("2026-10-27");
    expect(financePeriod("month", "2026-11-02").from).toBe("2026-11-01");
    expect(financePeriod("year", "2026-11-02").from).toBe("2026-01-01");
  });
  it("distingue coût inconnu de zéro et utilise DZD", () => {
    expect(financeMoney(null)).toBe("—");
    expect(financeMoney(0)).not.toBe("—");
    expect(financeMoney(100.5)).toMatch(/100,50/);
  });
  it("protège les exports CSV contre les formules et échappe les guillemets", () => {
    expect(financeCsv([{ client: '=HYPERLINK("bad")', amount: 100 }])).toContain("'=HYPERLINK");
    expect(financeCsv([{ text: 'a"b' }])).toContain('a""b');
  });
});
