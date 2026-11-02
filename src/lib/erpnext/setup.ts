import "@tanstack/react-start/server-only";
import type { ErpClient } from "./client";
import { resource } from "./documents";
import { ErpError } from "./errors";
import type { ErpDocument } from "./types";

/** Refuse writes unless the remote uniqueness constraints really exist. */
export async function verifyErpSetup(client: ErpClient) {
  for (const doctype of ["Customer", "Sales Order", "Sales Invoice", "Payment Entry"]) {
    const field = await client.json<ErpDocument>(
      resource("Custom Field", `${doctype}-custom_elegancia_key`),
    );
    if (field.unique !== 1 || field.fieldtype !== "Data") {
      throw new ErpError(
        "configuration",
        "Les références uniques Elegancia doivent être installées dans ERPNext.",
      );
    }
  }
  const company = await client.json<ErpDocument>(resource("Company", client.config.company));
  const warehouse = await client.json<ErpDocument>(resource("Warehouse", client.config.warehouse));
  const priceList = await client.json<ErpDocument>(resource("Price List", client.config.priceList));
  if (
    company.default_currency !== "DZD" ||
    warehouse.company !== company.name ||
    warehouse.disabled ||
    priceList.currency !== "DZD" ||
    priceList.selling !== 1 ||
    !priceList.enabled
  ) {
    throw new ErpError(
      "configuration",
      "Société, entrepôt ou liste de prix ERPNext incompatibles avec les montants DZD.",
    );
  }
}
