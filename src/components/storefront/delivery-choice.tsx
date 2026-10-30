import { useQuery } from "@tanstack/react-query";
import { Home, Store } from "lucide-react";
import { Field, Select } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n-context";
import { formatDzd } from "@/lib/format";
import { listPackersStopDeskCommunes } from "@/lib/server/packers-actions";
import type { DeliveryMethod } from "@/lib/delivery";
import { cn } from "@/lib/utils";

/** Home delivery or Packers Stop Desk, using only Packers-defined communes. */
export function DeliveryChoice({
  wilaya,
  homeFee,
  pickupFee,
  method,
  stopdeskName,
  onChange,
}: {
  wilaya: string;
  homeFee: number;
  pickupFee: number | null;
  method: DeliveryMethod;
  stopdeskName: string;
  onChange: (next: { method: DeliveryMethod; stopdeskName: string }) => void;
}) {
  const { t, locale } = useI18n();
  const stopdesk = useQuery({
    queryKey: ["packers_stopdesk_communes", wilaya] as const,
    queryFn: () => listPackersStopDeskCommunes({ data: { wilaya } }),
    enabled: method === "stopdesk" && Boolean(wilaya),
    staleTime: 3_600_000,
    retry: false,
  });

  if (!wilaya || pickupFee === null) return null;

  const option = (value: DeliveryMethod, label: string, fee: number, Icon: typeof Home) => (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-[12px] border p-3.5 text-sm",
        method === value ? "border-primary bg-primary/5" : "border-outline",
      )}
    >
      <input
        type="radio"
        name="delivery_method"
        value={value}
        checked={method === value}
        onChange={() => onChange({ method: value, stopdeskName: "" })}
        className="accent-[var(--primary-solid)]"
      />
      <Icon size={17} className="shrink-0 text-primary" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <span className="font-mono font-semibold" dir="ltr">
        {formatDzd(fee, locale)}
      </span>
    </label>
  );

  const communes = stopdesk.data?.communes ?? [];
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 text-sm font-medium">{t("checkout.method.title")}</legend>
      {option("home", t("checkout.method.home"), homeFee, Home)}
      {option("stopdesk", t("checkout.method.stopdesk"), pickupFee, Store)}

      {method === "stopdesk" &&
        (communes.length > 0 ? (
          <Field label="Commune Stop Desk Packers" required>
            <Select
              value={stopdeskName}
              required
              onChange={(event) => onChange({ method, stopdeskName: event.target.value })}
            >
              <option value="">Choisir un Stop Desk</option>
              {communes.map((commune) => (
                <option key={commune} value={commune}>
                  {commune}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          !stopdesk.isPending && (
            <p className="rounded-[10px] bg-surface-mid px-3 py-2 text-xs text-on-surface-muted">
              {stopdesk.data?.configured === false
                ? "Packers n’est pas encore connecté."
                : "Aucun Stop Desk Packers disponible pour cette wilaya."}
            </p>
          )
        ))}
    </fieldset>
  );
}
