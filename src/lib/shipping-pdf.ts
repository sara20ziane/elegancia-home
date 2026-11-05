import "@tanstack/react-start/server-only";
import { generate } from "@pdfme/generator";
import { text } from "@pdfme/schemas";
import documentFont from "./finance/assets/EleganciaDocument-Regular.ttf?inline";
import type { AdminOrder } from "./admin";

type Template = Parameters<typeof generate>[0]["template"];
type Schema = Template["schemas"][number][number];
export type LabelFormat = "label" | "a4";

export function shippingTemplate(
  orders: AdminOrder[],
  shop: string,
  format: LabelFormat,
): Template {
  const perPage = format === "a4" ? 4 : 1;
  const pages: Schema[][] = [];
  orders.forEach((order, index) => {
    const page = Math.floor(index / perPage);
    const slot = index % perPage;
    const x = format === "a4" ? 6 + (slot % 2) * 102 : 2;
    const y = format === "a4" ? 6 + Math.floor(slot / 2) * 145 : 5;
    const field = (
      name: string,
      content: string,
      top: number,
      height: number,
      size: number,
    ): Schema => ({
      ...text.propPanel.defaultSchema,
      name: `${index}-${name}`,
      type: "text",
      content,
      readOnly: true,
      position: { x: x + 4, y: y + top },
      width: 88,
      height,
      fontName: "Document",
      fontSize: size,
      fontColor: "#302B27",
      lineHeight: 1.1,
      overflow: "shrink",
    });
    const zone = [order.commune, order.wilaya].filter(Boolean).join(" — ");
    const delivery =
      order.delivery_method === "stopdesk"
        ? `Stop Desk${order.stopdesk_name ? ` · ${order.stopdesk_name}` : ""}`
        : "Domicile";
    const schemas = [
      field("shop", shop, 2, 9, 14),
      field("internal", "ÉTIQUETTE INTERNE · ne remplace pas le bordereau officiel", 13, 7, 7),
      field("reference", `Commande #${order.public_token.slice(0, 8).toUpperCase()}`, 22, 8, 11),
      field("customer", order.customer_name, 32, 14, 11),
      field("phone", order.phone, 46, 7, 11),
      field("address", order.address, 55, 32, 8),
      field("zone", zone, 89, 10, 9),
      field("delivery", delivery, 100, 10, 9),
      field(
        "tracking",
        order.tracking_number ? `Suivi : ${order.tracking_number}` : "Suivi non attribué",
        111,
        9,
        8,
      ),
      field("amount", `À encaisser : ${order.total.toLocaleString("fr-DZ")} DA`, 121, 10, 12),
      field("status", `Statut : ${order.status} · ${order.created_at.slice(0, 10)}`, 132, 5, 7),
    ];
    (pages[page] ??= []).push(...schemas);
  });
  return {
    basePdf: {
      width: format === "a4" ? 210 : 100,
      height: format === "a4" ? 297 : 150,
      padding: [0, 0, 0, 0],
    },
    schemas: pages,
  };
}

export async function renderShippingPdf(orders: AdminOrder[], shop: string, format: LabelFormat) {
  if (!orders.length || orders.length > 200) throw new Error("Choisissez de 1 à 200 commandes.");
  return new Uint8Array(
    await generate({
      template: shippingTemplate(orders, shop, format),
      inputs: [{}],
      plugins: { text },
      options: {
        font: {
          Document: {
            data: Uint8Array.from(Buffer.from(documentFont.split(",")[1], "base64")),
            fallback: true,
          },
        },
      },
    }),
  );
}
