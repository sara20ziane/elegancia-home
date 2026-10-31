import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Send, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AdminOrder } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";
import { getSupabase } from "@/lib/supabase/client";
import { createPackersParcel, validatePackersParcel } from "@/lib/server/packers-actions";

async function accessToken() {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Session administrateur introuvable.");
  return token;
}

/** Packers workflow: create first, then explicitly validate the shipment. */
export function CarrierAction({ order }: { order: AdminOrder }) {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [askCollection, setAskCollection] = useState(false);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin_orders"] });

  const create = useMutation({
    mutationFn: async () => {
      const token = await accessToken();
      const result = await createPackersParcel({ data: { orderId: order.id, accessToken: token } });
      if (!result.ok) throw new Error(result.error);
      return result.tracking;
    },
    onSuccess: (tracking) => {
      refresh();
      toast.success(`Colis créé chez Packers · ${tracking}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const validate = useMutation({
    mutationFn: async () => {
      const token = await accessToken();
      const result = await validatePackersParcel({
        data: { orderId: order.id, accessToken: token, askCollection },
      });
      if (!result.ok) throw new Error(result.error);
      return result.tracking;
    },
    onSuccess: (tracking) => {
      refresh();
      toast.success(`Expédition Packers validée · ${tracking}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (order.status === "confirmed" && !order.tracking_number) {
    return (
      <div className="flex flex-col gap-2 rounded-[12px] border border-outline bg-surface-mid/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-muted">Packers</p>
        <Button
          variant="berry"
          size="sm"
          className="self-start"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          <PackageCheck size={15} aria-hidden="true" />
          {create.isPending ? "Création…" : "Créer chez Packers"}
        </Button>
        <p className="text-xs text-on-surface-muted">
          Le colis est créé chez Packers sans valider encore son expédition.
        </p>
      </div>
    );
  }

  if (order.carrier !== "Packers" || !order.tracking_number) return null;

  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-primary/30 bg-primary/5 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Packers</p>
        <p className="font-mono text-sm" dir="ltr">
          {order.tracking_number}
        </p>
        {order.carrier_status && (
          <p className="mt-1 text-sm">
            Statut Packers : <span className="font-medium">{order.carrier_status}</span>
          </p>
        )}
        {order.carrier_status_updated_at && (
          <p className="mt-0.5 text-xs text-on-surface-muted">
            Dernière synchronisation : {formatDateTime(order.carrier_status_updated_at, locale)}
          </p>
        )}
      </div>

      {order.status === "confirmed" && (
        <>
          <label className="flex items-center gap-2 text-xs text-on-surface-muted">
            <input
              type="checkbox"
              checked={askCollection}
              onChange={(event) => setAskCollection(event.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Demander le ramassage à Packers
          </label>
          <Button
            size="sm"
            className="self-start"
            disabled={validate.isPending}
            onClick={() => validate.mutate()}
          >
            <Send size={15} aria-hidden="true" />
            {validate.isPending ? "Validation…" : "Valider l’expédition"}
          </Button>
          <p className="text-xs text-tertiary">
            Après validation chez Packers, le colis ne pourra plus être modifié ou supprimé via EcoTrack.
          </p>
        </>
      )}
    </div>
  );
}

/** EcoTrack uses the selected commune for Stop Desk instead of a separate office id. */
export function PickupOffice({ order }: { order: AdminOrder }) {
  if (order.delivery_method !== "stopdesk") return null;
  const commune = order.stopdesk_name || order.commune;

  return (
    <div className="flex items-center gap-2 rounded-[10px] bg-surface-mid px-3 py-2 text-sm">
      <Store size={15} className="text-primary" aria-hidden="true" />
      <span>Packers Stop Desk{commune ? ` · ${commune}` : " · commune à renseigner"}</span>
    </div>
  );
}
