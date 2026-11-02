// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { writeFile } from "node:fs/promises";
import { PDFDocument } from "@pdfme/pdf-lib";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { invoiceTemplate, renderInvoicePdf } from "./pdf-template";
import { invoiceFixture } from "../../../scripts/testing/native-invoice";

describe("PDF natif serveur pdfme", () => {
  it("produit un vrai PDF A4 avec accents et coordonnées arabes", async () => {
    const bytes = await renderInvoicePdf(invoiceFixture());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(595.28, 0);
    expect(pdf.getPage(0).getSize().height).toBeCloseTo(841.89, 0);
    await writeFile("/tmp/elegancia-native-invoice.pdf", bytes);
  }, 30000);
  it("pagine une facture longue et ne crée aucune mention légale absente", async () => {
    const payload = invoiceFixture(65);
    const pdf = await PDFDocument.load(await renderInvoicePdf(payload));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    const template = invoiceTemplate(payload);
    expect(template.schemas[0].find((schema) => schema.name === "legal")?.content).toBe("");
  }, 30000);
  it("préserve le total DZD et le type d’avoir sans modifier le snapshot", () => {
    const payload = invoiceFixture();
    const before = JSON.stringify(payload);
    expect(
      invoiceTemplate(payload).schemas[0].find((schema) => schema.name === "total")?.content,
    ).toContain("6600,00 DA");
    expect(JSON.stringify(payload)).toBe(before);
    expect(
      invoiceTemplate({ ...payload, kind: "credit" }).schemas[0].find(
        (schema) => schema.name === "title",
      )?.content,
    ).toBe("AVOIR");
  });
});
