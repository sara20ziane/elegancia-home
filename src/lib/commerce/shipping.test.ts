// @vitest-environment node
import { it, expect, vi } from "vitest";
import { PDFDocument } from "@pdfme/pdf-lib";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { shippingTemplate, renderShippingPdf } from "../shipping-pdf";
import type { AdminOrder } from "../admin";
const fixture = {
  id: "aaaaaaaa-1111-4111-8111-111111111111",
  public_token: "bbbbbbbb-1111-4111-8111-111111111111",
  customer_name: "سارة · Élégance",
  phone: "0555123456",
  address: "Adresse réelle de la fixture · شارع الاختبار",
  commune: "Alger Centre",
  wilaya: "Alger",
  total: 10600,
  status: "confirmed",
  tracking_number: "FICTIVE-TRACK",
  delivery_method: "home",
  created_at: "2026-11-05T10:00:00Z",
} as AdminOrder;
it("produit des pages thermiques exactes 100 × 150 mm avec coordonnées arabes", async () => {
  const pdf = await PDFDocument.load(
    await renderShippingPdf([fixture, fixture], "Elegancia Home", "label"),
  );
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo((100 * 72) / 25.4, 1);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo((150 * 72) / 25.4, 1);
}, 30000);
it("place quatre étiquettes par A4 et pagine la cinquième", async () => {
  const pdf = await PDFDocument.load(
    await renderShippingPdf(
      Array.from({ length: 5 }, () => fixture),
      "Elegancia Home",
      "a4",
    ),
  );
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo((210 * 72) / 25.4, 1);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo((297 * 72) / 25.4, 1);
  const template = shippingTemplate([fixture], "Elegancia Home", "label");
  const contents = template.schemas[0].map((s) => s.content).join(" ");
  expect(contents).toContain("ÉTIQUETTE INTERNE");
  expect(contents).toContain(fixture.address);
  expect(contents).toContain(fixture.tracking_number);
  expect(contents).toContain("10 600");
}, 30000);
