/** Retail bedding: allow sets and pillow bundles; larger purchases go through an administrator. */
export const MAX_VARIANT_QUANTITY = 20;
const MAX_ORDER_QUANTITY = 50;
export function exceedsOrderLimits(lines: { variant_id: string; quantity: number }[]): boolean {
  const quantities = new Map<string, number>();
  let total = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) return true;
    const quantity = (quantities.get(line.variant_id) ?? 0) + line.quantity;
    quantities.set(line.variant_id, quantity);
    total += line.quantity;
    if (quantity > MAX_VARIANT_QUANTITY || total > MAX_ORDER_QUANTITY) return true;
  }
  return false;
}
