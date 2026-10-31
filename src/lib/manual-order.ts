import { useQuery } from "@tanstack/react-query";
import type { OrderCustomer, OrderLine } from "./order";
import { getSupabase } from "./supabase/client";
import type { Json } from "./supabase/types";

export const MANUAL_ORDER_SOURCES = [
  "instagram",
  "facebook",
  "whatsapp",
  "phone",
  "other",
] as const;

export type ManualOrderSource = (typeof MANUAL_ORDER_SOURCES)[number];

export function orderSourceLabel(source: string): string {
  switch (source) {
    case "website":
      return "Site web";
    case "instagram":
      return "Instagram";
    case "facebook":
      return "Facebook";
    case "whatsapp":
      return "WhatsApp";
    case "phone":
      return "Téléphone";
    default:
      return "Autre";
  }
}

export type ManualOrderVariant = {
  id: string;
  productId: string;
  productName: string;
  size: string | null;
  colorName: string | null;
  sku: string | null;
  price: number;
  stock: number;
  setType: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  name_fr: string | null;
  status: string;
  product_variants: Array<{
    id: string;
    size: string | null;
    color_name: string | null;
    sku: string | null;
    price: number;
    stock: number;
    is_active: boolean;
    set_type: string | null;
  }>;
};

async function fetchManualOrderCatalog(): Promise<ManualOrderVariant[]> {
  const { data, error } = await getSupabase()
    .from("products")
    .select(
      "id, name, name_fr, status, product_variants ( id, size, color_name, sku, price, stock, is_active, set_type )",
    )
    .neq("status", "archived")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as ProductRow[])
    .flatMap((product) =>
      product.product_variants
        .filter((variant) => variant.is_active)
        .map((variant) => ({
          id: variant.id,
          productId: product.id,
          productName: product.name_fr || product.name,
          size: variant.size,
          colorName: variant.color_name,
          sku: variant.sku,
          price: variant.price,
          stock: variant.stock,
          setType: variant.set_type,
        })),
    )
    .sort((a, b) =>
      `${a.productName} ${a.setType ?? ""} ${a.size ?? ""} ${a.colorName ?? ""}`.localeCompare(
        `${b.productName} ${b.setType ?? ""} ${b.size ?? ""} ${b.colorName ?? ""}`,
        "fr",
      ),
    );
}

export function useManualOrderCatalog() {
  return useQuery({
    queryKey: ["manual_order_catalog"] as const,
    queryFn: fetchManualOrderCatalog,
  });
}

export async function placeManualOrder(
  customer: OrderCustomer,
  lines: OrderLine[],
  source: ManualOrderSource,
  confirmed: boolean,
): Promise<string> {
  if (lines.length === 0) throw new Error("Ajoute au moins un article.");

  // The generated local types intentionally lag migrations in this repository.
  // Keep the cast isolated here; the live RPC is admin-only and fully validates
  // the caller, stock, prices and delivery server-side.
  const rpc = getSupabase().rpc as unknown as (
    fn: string,
    args: Record<string, Json>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  const { data, error } = await rpc("place_admin_order", {
    p_customer: customer as unknown as Json,
    p_items: lines as unknown as Json,
    p_source: source,
    p_confirmed: confirmed,
  });

  if (error) throw new Error(error.message);
  if (typeof data !== "string" || data.length === 0) {
    throw new Error("La commande a été créée sans référence exploitable.");
  }
  return data;
}
