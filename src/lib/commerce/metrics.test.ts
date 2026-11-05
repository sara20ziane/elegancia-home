import { it, expect } from "vitest";
import {
  averageConfirmedOrder,
  refusalRate,
  revenueTrend,
  wilayasToWatch,
  type Analytics,
} from "../analytics";
import { cropRect } from "../image-frame";
import { canonicalPhone } from "../admin-phones";
import { configurationChecks, type SetupAudit } from "../setup-audit";
const sample = {
  totals: { orders: 10, confirmedOrders: 4, confirmedValue: 40000, refused: 1 },
  byWilaya: [
    { wilaya: "Alger", rate: 0.5, eligible: false },
    { wilaya: "Oran", rate: 0.25, eligible: true },
  ],
} as Analytics;
it("calcule le panier confirmé sur les commandes confirmées et le taux sur tous les ordres", () => {
  expect(averageConfirmedOrder(sample)).toBe(10000);
  expect(refusalRate(sample)).toBe(0.1);
  expect(averageConfirmedOrder(undefined)).toBe(0);
  expect(wilayasToWatch(sample).map((w) => w.wilaya)).toEqual(["Oran"]);
});
it("n'invente pas 100 % de croissance quand la période de référence vaut zéro", () => {
  expect(
    revenueTrend({ revenue: [0, 0, 500, 500].map((value) => ({ value })) } as Analytics),
  ).toBeNull();
  expect(
    revenueTrend({ revenue: [100, 100, 150, 150].map((value) => ({ value })) } as Analytics),
  ).toBe(0.5);
});
it("normalise les écritures du numéro et permet un cadrage horizontal sans déformation", () => {
  for (const number of ["0555 12 34 56", "+213555123456", "213555123456", "00213555123456"])
    expect(canonicalPhone(number)).toBe("0555123456");
  expect(cropRect(2000, 1000, { aspect: 4 / 5, focus: 0.5, focusX: 1 })).toEqual({
    sx: 1200,
    sy: 0,
    cw: 800,
    ch: 1000,
  });
  expect(() => cropRect(2000, 1000, { aspect: 4 / 5, focus: 0.5, focusX: 2 })).toThrow();
});
it("la checklist n'affiche pas une boutique absente ou un catalogue vide comme prêts", () => {
  const checks = configurationChecks(null, {
    published: 0,
    missingPhotos: 0,
    missingVariants: 0,
    invalidPrices: 0,
    demoContent: 0,
    deliveryReady: false,
    checkoutReady: false,
  } as SetupAudit);
  expect(checks.filter((c) => c.ok).map((c) => c.label)).toEqual([
    "Aucune donnée de démonstration détectée",
  ]);
});
