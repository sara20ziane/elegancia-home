import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Home, MapPin, Store } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { formatDzd } from "@/lib/format";
import { listPackersStopDeskCommunes } from "@/lib/server/packers-actions";
import type { DeliveryMethod } from "@/lib/delivery";
import { cn } from "@/lib/utils";

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[-\s]/g, "")
    .trim();
}

/** Home delivery or Packers Stop Desk, driven by the customer's selected commune. */
export function DeliveryChoice({
  wilaya,
  commune,
  homeFee,
  pickupFee,
  method,
  stopdeskName,
  onChange,
}: {
  wilaya: string;
  commune: string;
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
    enabled: Boolean(wilaya),
    staleTime: 3_600_000,
    retry: false,
  });

  const selectedStopDesk = (stopdesk.data?.stopDesks ?? []).find(
    (desk) => normalize(desk.commune) === normalize(commune),
  );
  const stopdeskAvailable = Boolean(commune && pickupFee !== null && selectedStopDesk);

  useEffect(() => {
    if (method !== "stopdesk") return;

    if (!stopdeskAvailable) {
      onChange({ method: "home", stopdeskName: "" });
      return;
    }

    if (selectedStopDesk && normalize(stopdeskName) !== normalize(selectedStopDesk.commune)) {
      onChange({ method: "stopdesk", stopdeskName: selectedStopDesk.commune });
    }
  }, [method, onChange, selectedStopDesk, stopdeskAvailable, stopdeskName]);

  if (!wilaya) return null;

  const option = (
    value: DeliveryMethod,
    label: string,
    fee: number | null,
    Icon: typeof Home,
    disabled = false,
  ) => (
    <label
      className={cn(
        "flex items-center gap-3 rounded-[12px] border p-3.5 text-sm transition",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        method === value && !disabled ? "border-primary bg-primary/5" : "border-outline",
      )}
      aria-disabled={disabled}
    >
      <input
        type="radio"
        name="delivery_method"
        value={value}
        checked={method === value}
        disabled={disabled}
        onChange={() =>
          onChange({
            method: value,
            stopdeskName: value === "stopdesk" ? selectedStopDesk?.commune ?? "" : "",
          })
        }
        className="accent-[var(--primary-solid)]"
      />
      <Icon size={17} className="shrink-0 text-primary" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <span className="font-mono font-semibold" dir="ltr">
        {fee !== null && !disabled ? formatDzd(fee, locale) : "Indisponible"}
      </span>
    </label>
  );

  let availabilityMessage: string | null = null;
  if (!commune) {
    availabilityMessage = "Sélectionne ta commune pour vérifier la disponibilité du Stop Desk Packers.";
  } else if (stopdesk.isPending) {
    availabilityMessage = "Vérification du Stop Desk Packers…";
  } else if (stopdesk.data?.configured === false) {
    availabilityMessage = "Packers n’est pas encore connecté.";
  } else if (!selectedStopDesk) {
    availabilityMessage = "Aucun Stop Desk Packers dans cette commune. Livraison à domicile uniquement.";
  }

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 text-sm font-medium">{t("checkout.method.title")}</legend>
      {option("home", t("checkout.method.home"), homeFee, Home)}
      {option(
        "stopdesk",
        t("checkout.method.stopdesk"),
        pickupFee,
        Store,
        !stopdeskAvailable,
      )}

      {availabilityMessage && (
        <p className="rounded-[10px] bg-surface-mid px-3 py-2 text-xs text-on-surface-muted">
          {availabilityMessage}
        </p>
      )}

      {selectedStopDesk && (
        <div className="rounded-[12px] border border-primary/20 bg-primary/5 p-3.5 text-sm">
          <div className="flex items-start gap-2.5">
            <MapPin size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold text-on-surface">{selectedStopDesk.label}</p>
              <p className="mt-1 text-sm text-on-surface-muted">
                Commune : <span className="font-medium text-on-surface">{selectedStopDesk.commune}</span>
              </p>
              {selectedStopDesk.zipCode && (
                <p className="text-sm text-on-surface-muted">
                  Code postal : <span className="font-mono text-on-surface">{selectedStopDesk.zipCode}</span>
                </p>
              )}
              <p className="mt-1.5 text-xs text-on-surface-muted">
                Point de retrait disponible dans cette commune. Packers/EcoTrack ne publie pas d’adresse de bureau distincte dans son API.
              </p>
            </div>
          </div>
        </div>
      )}
    </fieldset>
  );
}
