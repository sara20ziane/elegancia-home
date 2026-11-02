import "@tanstack/react-start/server-only";
import { generate } from "@pdfme/generator";
import { text, table, image } from "@pdfme/schemas";
import documentFont from "./assets/EleganciaDocument-Regular.ttf?inline";
import type { InvoicePayload } from "./types";

type Template = Parameters<typeof generate>[0]["template"];
type Schema = Template["schemas"][number][number];
const fontBytes = (data: string) => Uint8Array.from(Buffer.from(data.split(",")[1], "base64"));
const invoiceColor = (value?: string | null) =>
  value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#9B8065";
const money = (value: number) => `${Number(value).toFixed(2).replace(".", ",")} DA`;

function label(
  name: string,
  content: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize = 10,
): Schema {
  return {
    ...text.propPanel.defaultSchema,
    name,
    type: "text",
    content,
    readOnly: true,
    position: { x, y },
    width,
    height,
    fontSize,
    fontName: "Document",
    fontColor: "#302B27",
    alignment: "left",
    lineHeight: 1.2,
    overflow: "expand",
  };
}

export function invoiceTemplate(doc: InvoicePayload, logo?: string): Template {
  if (doc.renderer_version !== "elegancia-a4-v1" || !doc.items.length)
    throw new Error("Version de document invalide.");
  const issuer = doc.issuer;
  const rows = doc.items.map((item) => [
    item.name,
    item.sku || "—",
    item.variant || "—",
    String(item.quantity),
    money(item.unit_price),
    item.discount ? money(item.discount) : "—",
    money(item.total),
  ]);
  const corporate = [issuer.name, issuer.address, issuer.phone, issuer.email]
    .filter(Boolean)
    .join("\n");
  const customer = [
    doc.customer_name,
    doc.phone,
    doc.address,
    [doc.commune, doc.wilaya].filter(Boolean).join(" — "),
  ]
    .filter(Boolean)
    .join("\n");
  const legal = [
    ["RC", issuer.rc],
    ["NIF", issuer.nif],
    ["NIS", issuer.nis],
    ["AI", issuer.ai],
  ]
    .filter(([, value]) => value)
    .map(([key, value]) => `${key} : ${value}`)
    .join("   ·   ");
  const schemas: Schema[] = [
    label("brand", issuer.name, 15, 14, 88, 13, 18),
    label("title", doc.kind === "credit" ? "AVOIR" : "FACTURE", 126, 15, 70, 13, 23),
    label("number", doc.number, 126, 30, 70, 7, 12),
    label("date", `Date : ${doc.date.split("-").reverse().join("/")}`, 126, 39, 70, 7),
    label("issuer", corporate, 15, 34, 94, 35, 9),
    label("customer", `CLIENT\n${customer}`, 112, 56, 83, 34, 9),
    label(
      "reference",
      `Commande : ${doc.reference}\n${doc.original_number ? `Facture d’origine : ${doc.original_number}` : ""}`,
      15,
      76,
      95,
      15,
      8,
    ),
    {
      ...table.propPanel.defaultSchema,
      name: "items",
      type: "table",
      readOnly: true,
      content: JSON.stringify(rows),
      position: { x: 15, y: 99 },
      width: 180,
      height: 20,
      showHead: true,
      repeatHead: true,
      head: ["Article", "Référence", "Variante", "Qté", "Prix unitaire", "Remise", "Total"],
      headWidthPercentages: [24, 13, 17, 8, 15, 10, 13],
      bodyStyles: {
        ...table.propPanel.defaultSchema.bodyStyles,
        fontName: "Document",
        fontSize: 8,
        padding: { top: 2, right: 2, bottom: 2, left: 2 },
        borderColor: "#E5DDD4",
        fontColor: "#302B27",
        alternateBackgroundColor: "#F8F5F1",
      },
      headStyles: {
        ...table.propPanel.defaultSchema.headStyles,
        fontName: "Document",
        fontSize: 8,
        padding: { top: 2, right: 2, bottom: 2, left: 2 },
        borderColor: invoiceColor(issuer.brand_color),
        backgroundColor: invoiceColor(issuer.brand_color),
        fontColor: "#FFFFFF",
      },
    },
    label(
      "subtotal",
      `Sous-total : ${money(doc.subtotal)}\nLivraison : ${doc.delivery_fee ? money(doc.delivery_fee) : "Offerte"}\nRemise distincte : — (prix nets enregistrés)`,
      105,
      130,
      90,
      23,
      9,
    ),
    label(
      "tax",
      doc.tax_rate === null
        ? ""
        : `${doc.tax_label || "Taxes incluses"} (${doc.tax_rate} %) : ${money(doc.tax)}`,
      95,
      155,
      100,
      10,
      9,
    ),
    label("total", `TOTAL : ${money(doc.total)}`, 100, 169, 95, 15, 17),
    label("reason", doc.reason || "", 15, 188, 180, 15, 9),
    label("legal", legal, 15, 211, 180, 20, 8),
    label("footer", "Elegancia Home · DZD / DA", 15, 235, 180, 8, 8),
  ];
  if (logo) {
    schemas[0] = {
      ...image.propPanel.defaultSchema,
      name: "logo",
      type: "image",
      readOnly: true,
      content: logo,
      position: { x: 15, y: 12 },
      width: 48,
      height: 19,
    };
  }
  return { basePdf: { width: 210, height: 297, padding: [12, 15, 15, 15] }, schemas: [schemas] };
}

export async function renderInvoicePdf(doc: InvoicePayload, logo?: string): Promise<Uint8Array> {
  const bytes = await generate({
    template: invoiceTemplate(doc, logo),
    inputs: [{}],
    plugins: { text, table, image },
    options: {
      font: {
        Document: { data: fontBytes(documentFont), fallback: true },
      },
    },
  });
  return new Uint8Array(bytes);
}
