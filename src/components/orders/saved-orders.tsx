import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n-context";
import { formatDateTime } from "@/lib/format";
import { trackOrder } from "@/lib/order";
import { removeSavedOrder, type SavedOrder } from "@/lib/saved-orders";
import { useSavedOrders } from "@/lib/use-saved-orders";
import { TrackingNumber } from "./tracking-number";

export function SavedOrders() {
  const { t } = useI18n();
  const orders = useSavedOrders();
  return (
    <section
      className="flex flex-col gap-4 border-t border-outline pt-6"
      aria-labelledby="saved-orders-title"
    >
      <h2 id="saved-orders-title" className="font-display text-xl font-semibold">
        {t("order.savedTitle")}
      </h2>
      <p className="text-sm text-on-surface-muted">{t("order.savedDeviceNote")}</p>
      {orders.length === 0 ? (
        <p>{t("order.savedEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {orders.map((order) => (
            <li key={order.publicToken}>
              <SavedOrderCard order={order} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SavedOrderCard({ order }: { order: SavedOrder }) {
  const { t, locale } = useI18n();
  const [removeFailed, setRemoveFailed] = useState(false);
  const query = useQuery({
    queryKey: ["track", order.publicToken],
    queryFn: () => trackOrder(order.publicToken),
    retry: false,
    staleTime: 30_000,
  });
  const data = query.data;
  const date = data?.created_at ?? order.createdAt;
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-[16px] border border-outline bg-surface p-4 sm:p-5">
      <p className="text-xs text-on-surface-muted">{t("order.tokenLabel")}</p>
      <p className="break-all font-mono text-xs" dir="ltr">
        {order.publicToken}
      </p>
      {date && <p className="text-xs text-on-surface-muted">{formatDateTime(date, locale)}</p>}
      {query.isPending ? (
        <p role="status">{t("common.loading")}</p>
      ) : query.isError ? (
        <div>
          <p role="status">{t("order.savedLoadFailed")}</p>
          <Button variant="ghost" onClick={() => void query.refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : !data ? (
        <p>{t("order.notFound")}</p>
      ) : (
        <>
          <div>
            <StatusBadge status={data.status} />
          </div>
          <p className="text-sm">
            {t(
              data.delivery_method === "stopdesk"
                ? "checkout.method.stopdesk"
                : "checkout.method.home",
            )}
          </p>
          <TrackingNumber key={data.tracking_number} tracking={data.tracking_number} />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link to="/order/$token" params={{ token: order.publicToken }}>
            {t("checkout.trackNow")}
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setRemoveFailed(!removeSavedOrder(order.publicToken))}
        >
          {t("order.removeSaved")}
        </Button>
      </div>
      {removeFailed && <p role="status">{t("order.storageUnavailable")}</p>}
    </article>
  );
}
