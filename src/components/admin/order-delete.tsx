import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n-context";
import { deleteOrder } from "@/lib/admin-delete-order";
import { invalidateAdminOrders } from "@/lib/admin-order-events";
import type { AdminOrder } from "@/lib/admin";

export function DeleteOrderButton({ order }: { order: AdminOrder }) {
  const { t } = useI18n();
  const client = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const remove = async () => {
    if (inFlight.current || reference !== order.public_token) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    try {
      await deleteOrder(order.id, reference);
      invalidateAdminOrders(client);
      void client.invalidateQueries({ queryKey: ["phone_history"] });
      setAsking(false);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  if (order.tracking_number || ["confirmed", "shipped", "delivered"].includes(order.status))
    return <p className="text-xs text-on-surface-muted">{t("admin.delete.blocked")}</p>;
  if (!asking)
    return (
      <Button size="sm" variant="danger" onClick={() => setAsking(true)}>
        {t("admin.delete.title")}
      </Button>
    );
  return (
    <section className="flex flex-col gap-3 rounded-[12px] border border-error p-3">
      <p role="alert" className="text-sm">
        {t("admin.delete.warning")}
      </p>
      <p dir="ltr" className="break-all font-mono text-xs">
        {order.public_token}
      </p>
      <Input
        aria-label={t("order.tokenLabel")}
        value={reference}
        onChange={(event) => setReference(event.target.value)}
        disabled={busy}
        autoComplete="off"
      />
      <div className="flex gap-2">
        <Button
          variant="danger"
          disabled={busy || reference !== order.public_token}
          onClick={() => void remove()}
        >
          {t("admin.delete.title")}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => setAsking(false)}>
          {t("common.cancel")}
        </Button>
      </div>
      {error && <p role="status">{t("admin.delete.error")}</p>}
    </section>
  );
}
