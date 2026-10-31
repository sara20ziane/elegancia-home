/** No status is trusted until its exact value and meaning have been verified with Packers. */
export type VerifiedPackersRule = {
  raw: string;
  target: "delivered" | "refused" | "returned";
  physicalReturnReceived?: boolean;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Supported envelopes are candidates, not a claim about the undocumented API contract. */
export function parsePackersOrder(payload: unknown, tracking: string): string | null {
  const root = record(payload);
  if (root?.success === false || !tracking.trim()) return null;
  const data = record(root?.data);
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.data)
      ? root.data
      : Array.isArray(root?.orders)
        ? root.orders
        : Array.isArray(data?.orders)
          ? data.orders
          : [data ?? root];
  const matches = rows.map(record).filter((row) => {
    if (!row || row.success === false) return false;
    const identities = [row.tracking, row.tracking_number, row.numero_suivi].filter(
      (value) => value !== undefined && value !== null,
    );
    return identities.length > 0 && identities.every((value) => value === tracking);
  });
  if (matches.length !== 1) return null;
  const row = matches[0]!;
  const statuses = [row.status, row.statut, row.status_name, row.etat, row.current_status].filter(
    (value) => value !== undefined && value !== null,
  );
  if (!statuses.length || statuses.some((value) => typeof value !== "string" || !value.trim())) {
    return null;
  }
  const status = statuses[0] as string;
  return status.length <= 200 && statuses.every((value) => value === status) ? status : null;
}

/** Exact match only: no guessed codes, translations, fuzzy matching or payment statuses. */
export function mapPackersStatus(raw: string, rules: readonly VerifiedPackersRule[]) {
  const matches = rules.filter((rule) => rule.raw === raw);
  if (matches.length !== 1) return null;
  const rule = matches[0];
  if (rule.target === "returned" && rule.physicalReturnReceived !== true) return null;
  return rule.target;
}

export function readVerifiedPackersRules(value: string | undefined): VerifiedPackersRule[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("Invalid Packers status contract.");
  const rules: VerifiedPackersRule[] = [];
  for (const item of parsed) {
    const row = record(item);
    if (
      !row ||
      typeof row.raw !== "string" ||
      !row.raw.trim() ||
      row.raw.length > 200 ||
      !["delivered", "refused", "returned"].includes(String(row.target)) ||
      rules.some((rule) => rule.raw === row.raw) ||
      (row.target === "returned" && row.physicalReturnReceived !== true)
    ) {
      throw new Error("Invalid Packers status contract.");
    }
    rules.push({
      raw: row.raw,
      target: row.target as VerifiedPackersRule["target"],
      physicalReturnReceived: row.physicalReturnReceived === true,
    });
  }
  return rules;
}

export type SyncOrder = {
  id: string;
  carrier: string | null;
  tracking_number: string | null;
  status: string;
  delivered_at: string | null;
  refused_at: string | null;
  refused_reason: string | null;
};

export function eligiblePackersOrder(order: SyncOrder): boolean {
  return (
    order.carrier === "Packers" &&
    Boolean(order.tracking_number?.trim()) &&
    ["confirmed", "shipped"].includes(order.status)
  );
}

export function packersStatusPatch(
  order: SyncOrder,
  raw: string,
  rules: readonly VerifiedPackersRule[],
  now: string,
): Record<string, string> {
  const patch: Record<string, string> = { carrier_status: raw, carrier_status_updated_at: now };
  const target = mapPackersStatus(raw, rules);
  // confirmed is still awaiting explicit shipment validation: never skip that workflow.
  if (order.status !== "shipped" || !target) return patch;
  patch.status = target;
  if (target === "delivered") patch.delivered_at = order.delivered_at ?? now;
  if (target === "refused") {
    patch.refused_at = order.refused_at ?? now;
    patch.refused_reason = order.refused_reason ?? `Packers · ${raw}`;
  }
  return patch;
}
