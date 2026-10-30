import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Link2Off, Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { LoadingState } from "@/components/ui/feedback";
import { useI18n } from "@/lib/i18n-context";
import { WILAYAS } from "@/lib/wilayas";
import { useStoreSettings } from "@/lib/queries";
import { saveStoreSettings } from "@/lib/admin";
import { deleteZone, upsertZone, useDeliveryZones, type DeliveryZone } from "@/lib/delivery";
import { testPackersConnection } from "@/lib/server/packers-actions";

export const Route = createFileRoute("/admin/delivery")({
  component: DeliveryPage,
});

function useDeliveryInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["delivery_zones"] });
    void queryClient.invalidateQueries({ queryKey: ["store_settings"] });
  };
}

function DeliveryPage() {
  const { t } = useI18n();
  const { data: settings, isPending } = useStoreSettings();
  if (isPending) return <LoadingState />;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold">{t("admin.delivery.title")}</h1>
      <CarrierCard
        origin={settings?.guepex_from_wilaya ?? ""}
        flatFee={settings?.delivery_fee_flat ?? 0}
      />
      <ZonesCard />
    </div>
  );
}

function CarrierCard({ origin, flatFee }: { origin: string; flatFee: number }) {
  const { t, locale } = useI18n();
  const invalidate = useDeliveryInvalidation();
  const connection = useQuery({
    queryKey: ["packers_connection"] as const,
    queryFn: () => testPackersConnection(),
    staleTime: 60_000,
    retry: false,
  });

  const saveOrigin = useMutation({
    mutationFn: (value: string) => saveStoreSettings({ guepex_from_wilaya: value || null }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const connected = connection.data?.connected === true;
  const configured = connection.data?.configured === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck size={18} className="text-primary" aria-hidden="true" />
          Packers · EcoTrack
        </CardTitle>
        {connected ? (
          <Badge tone="positive">
            <CheckCircle2 size={12} aria-hidden="true" />
            Connecté
          </Badge>
        ) : (
          <Badge tone="neutral">
            <Link2Off size={12} aria-hidden="true" />
            {connection.isPending ? "Vérification…" : configured ? "Token invalide" : "Non connecté"}
          </Badge>
        )}
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {!connected && (
          <div className="rounded-[12px] border border-outline bg-surface-mid px-4 py-3 text-sm">
            <p className="font-medium">Connexion Packers requise</p>
            <p className="mt-1 text-xs text-on-surface-muted">
              Ajoute le token API de ton compte Packers dans Vercel sous le nom
              <span className="mx-1 font-mono">PACKERS_API_TOKEN</span>, puis redéploie le site.
            </p>
          </div>
        )}

        <Field
          label={t("admin.delivery.origin")}
          hint="Wilaya de départ de tes colis."
          className="max-w-md"
        >
          <Select value={origin} onChange={(event) => saveOrigin.mutate(event.target.value)}>
            <option value="">{t("checkout.selectWilaya")}</option>
            {WILAYAS.map((w) => (
              <option key={w.code} value={w.fr}>
                {String(w.code).padStart(2, "0")} — {locale === "ar" ? w.ar : w.fr}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-on-surface-muted">
          Les tarifs affichés au checkout restent ceux de tes zones de livraison Elegancia.
          Une synchronisation automatique avec les tarifs Packers pourra être activée après la connexion.
        </p>
        <p className="text-xs text-on-surface-muted">
          {t("admin.delivery.flatNote", { fee: flatFee })}
        </p>
      </CardBody>
    </Card>
  );
}

function ZonesCard() {
  const { t } = useI18n();
  const { data: zones } = useDeliveryZones();
  const configured = zones ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.delivery.zones")}</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        <ZoneForm />
        {configured.length === 0 ? (
          <p className="text-sm text-on-surface-muted">{t("admin.delivery.noZones")}</p>
        ) : (
          <ul className="divide-y divide-outline rounded-[16px] border border-outline">
            {configured.map((zone) => (
              <ZoneRow key={zone.wilaya} zone={zone} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function ZoneForm() {
  const { t, locale } = useI18n();
  const invalidate = useDeliveryInvalidation();
  const [wilaya, setWilaya] = useState("");
  const [fee, setFee] = useState("600");
  const [pickup, setPickup] = useState("");
  const [eta, setEta] = useState("3");

  const save = useMutation({
    mutationFn: () =>
      upsertZone({
        wilaya,
        fee: Number(fee) || 0,
        stopdesk_fee: pickup.trim() === "" ? null : Math.max(0, Number(pickup) || 0),
        eta_days: Number(eta) || 1,
      }),
    onSuccess: () => {
      invalidate();
      setWilaya("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
      <Field label={t("checkout.wilaya")}>
        <Select value={wilaya} onChange={(event) => setWilaya(event.target.value)}>
          <option value="">{t("checkout.selectWilaya")}</option>
          {WILAYAS.map((w) => (
            <option key={w.code} value={w.fr}>
              {String(w.code).padStart(2, "0")} — {locale === "ar" ? w.ar : w.fr}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("admin.settings.deliveryFee")}>
        <Input
          type="number"
          min={0}
          value={fee}
          onChange={(event) => setFee(event.target.value)}
          dir="ltr"
          className="font-mono"
        />
      </Field>
      <Field label={t("admin.delivery.pickupFee")} hint={t("admin.delivery.pickupHint")}>
        <Input
          type="number"
          min={0}
          value={pickup}
          onChange={(event) => setPickup(event.target.value)}
          dir="ltr"
          className="font-mono"
        />
      </Field>
      <Field label={t("admin.delivery.etaDays")}>
        <Input
          type="number"
          min={1}
          value={eta}
          onChange={(event) => setEta(event.target.value)}
          dir="ltr"
          className="font-mono"
        />
      </Field>
      <Button type="button" disabled={!wilaya || save.isPending} onClick={() => save.mutate()}>
        <Plus size={16} aria-hidden="true" />
        {t("common.add")}
      </Button>
    </div>
  );
}

function ZoneRow({ zone }: { zone: DeliveryZone }) {
  const { t, locale } = useI18n();
  const invalidate = useDeliveryInvalidation();
  const match = WILAYAS.find((w) => w.ar === zone.wilaya || w.fr === zone.wilaya);
  const label = match ? (locale === "ar" ? match.ar : match.fr) : zone.wilaya;

  const remove = useMutation({
    mutationFn: () => deleteZone(zone.wilaya),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-4 text-sm">
        <span className="font-mono" dir="ltr">
          {zone.fee}
        </span>
        <span
          className="font-mono text-xs text-on-surface-muted"
          dir="ltr"
          title={t("admin.delivery.pickupFee")}
        >
          {zone.stopdesk_fee === null ? "—" : `⌂ ${zone.stopdesk_fee}`}
        </span>
        <span className="font-mono text-xs text-on-surface-muted" dir="ltr">
          {zone.eta_days}d
        </span>
        <button
          type="button"
          onClick={() => remove.mutate()}
          aria-label={`${t("common.delete")} ${label}`}
          className="text-on-surface-muted hover:text-error"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </span>
    </li>
  );
}
