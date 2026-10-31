import { useQueryClient } from "@tanstack/react-query";
import { invalidateAdminOrders } from "@/lib/admin-order-events";
import { useI18n } from "@/lib/i18n-context";
import { useAdminOrderAlerts } from "@/lib/use-admin-order-alerts";
import { useOrderSound } from "@/lib/use-order-sound";
import { Button } from "@/components/ui/button";

/** Mounted only inside the authenticated admin guard, across all admin routes. */
export function OrderNotifications() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const sound = useOrderSound();
  const connection = useAdminOrderAlerts(sound.play);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-muted">
      <span role="status">{t(`admin.orders.live.${connection}`)}</span>
      {connection === "unavailable" && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => invalidateAdminOrders(queryClient)}
        >
          {t("common.retry")}
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-pressed={sound.enabled}
        onClick={() => void sound.toggle()}
      >
        {t(sound.enabled ? "admin.orders.soundOn" : "admin.orders.soundOff")}
      </Button>
      {sound.unavailable && <span role="status">{t("admin.orders.soundUnavailable")}</span>}
    </div>
  );
}
