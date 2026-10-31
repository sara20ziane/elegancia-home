import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Link2Off, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n-context";
import { formatDzd } from "@/lib/format";
import { WILAYAS } from "@/lib/wilayas";
import { useDeliveryZones, type DeliveryZone } from "@/lib/delivery";
import { getSupabase } from "@/lib/supabase/client";
import { syncPackersRates, testPackersConnection } from "@/lib/server/packers-actions";

export const Route = createFileRoute("/admin/delivery")({
  component: DeliveryPage,
});

function DeliveryPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold">{t("admin.delivery.title")}</h1>
      <CarrierCard />
      <ZonesCard />
    </div>
  );
}

function CarrierCard() {
  const queryClient = useQueryClient();
  const autoSynced = useRef(false);
  const connection = useQuery({
    queryKey: ["packers_connection"] as const,
    queryFn: () => testPackersConnection(),
    staleTime: 60_000,
    retry: false,
  });

  const sync = useMutation({
    mutationFn: async () => {
      const { data } = await getSupabase().auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Session administrateur introuvable.");
      const result = await syncPackersRates({ data: { accessToken } });
      if (!result.ok) throw new Error(result.error);
      return result.count;
    },
    onSuccess: (count) => {
      void queryClient.invalidateQueries({ queryKey: ["delivery_zones"] });
      void queryClient.invalidateQueries({ queryKey: ["store_settings"] });
      toast.success(`${count} tarifs Packers synchronisés.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const connected = connection.data?.connected === true;
  const configured = connection.data?.configured === true;

  useEffect(() => {
    if (connected && !autoSynced.current) {
      autoSynced.current = true;
      sync.mutate();
    }
  }, [connected]);

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
        <div className="rounded-[12px] border border-outline bg-surface-mid px-4 py-3 text-sm">
          <p className="font-medium">Départ fixe : Alger (16)</p>
          <p className="mt-1 text-xs text-on-surface-muted">
            Les tarifs domicile et Stop Desk affichés par Elegancia proviennent exclusivement de Packers.
          </p>
        </div>

        {!connected && (
          <div className="rounded-[12px] border border-outline bg-surface-mid px-4 py-3 text-sm">
            <p className="font-medium">Connexion Packers requise</p>
            <p className="mt-1 text-xs text-on-surface-muted">
              Ajoute le token API Packers dans Vercel sous le nom
              <span className="mx-1 font-mono">PACKERS_API_TOKEN</span>, puis redéploie le site.
            </p>
          </div>
        )}

        <Button
          type="button"
          variant="secondary"
          className="self-start"
          disabled={!connected || sync.isPending}
          onClick={() => sync.mutate()}
        >
          <RefreshCw size={15} className={sync.isPending ? "animate-spin" : ""} aria-hidden="true" />
          {sync.isPending ? "Synchronisation…" : "Actualiser les tarifs Packers"}
        </Button>
        <p className="text-xs text-on-surface-muted">
          Une synchronisation est lancée automatiquement à l’ouverture de cette page quand Packers est connecté.
        </p>
      </CardBody>
    </Card>
  );
}

function ZonesCard() {
  const { locale } = useI18n();
  const { data: zones, isPending } = useDeliveryZones();
  const configured = [...(zones ?? [])].sort((a, b) => wilayaCode(a.wilaya) - wilayaCode(b.wilaya));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarifs Packers synchronisés</CardTitle>
      </CardHeader>
      <CardBody>
        {isPending ? (
          <p className="text-sm text-on-surface-muted">Chargement…</p>
        ) : configured.length === 0 ? (
          <p className="text-sm text-on-surface-muted">
            Aucun tarif n’est encore synchronisé. Les commandes resteront bloquées jusqu’à la connexion Packers.
          </p>
        ) : (
          <ul className="divide-y divide-outline rounded-[16px] border border-outline">
            {configured.map((zone) => (
              <ZoneRow key={zone.wilaya} zone={zone} locale={locale} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function ZoneRow({ zone, locale }: { zone: DeliveryZone; locale: "ar" | "fr" | "en" }) {
  const match = WILAYAS.find((w) => w.ar === zone.wilaya || w.fr === zone.wilaya);
  const label = match ? (locale === "ar" ? match.ar : match.fr) : zone.wilaya;

  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-muted">
        <span>
          Domicile <strong className="font-mono text-on-surface">{formatDzd(zone.fee, locale)}</strong>
        </span>
        <span>
          Stop Desk{" "}
          <strong className="font-mono text-on-surface">
            {zone.stopdesk_fee === null ? "Non disponible" : formatDzd(zone.stopdesk_fee, locale)}
          </strong>
        </span>
      </span>
    </li>
  );
}

function wilayaCode(name: string) {
  return WILAYAS.find((w) => w.fr === name || w.ar === name)?.code ?? 999;
}
