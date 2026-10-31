import { OrderReference } from "./order-reference";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { StoreLayout } from "@/components/storefront/store-layout";
import { Button } from "@/components/ui/button";
import { saveOrderLocally } from "@/lib/saved-orders";
import { useSavedOrders } from "@/lib/use-saved-orders";
import { useI18n } from "@/lib/i18n-context";

export function OrderPlaced({
  token,
  phone,
  createdAt,
  embedded = false,
}: {
  token: string;
  phone: string;
  createdAt: string;
  embedded?: boolean;
}) {
  const { t } = useI18n();
  const savedOrders = useSavedOrders();
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">("idle");
  const saved =
    saveState === "saved" ||
    savedOrders.some((order) => order.publicToken === token.trim().toLowerCase());
  const save = () => {
    if (saved) return;
    setSaveState(saveOrderLocally({ publicToken: token, createdAt }) ? "saved" : "failed");
  };
  const confirmation = (
    <>
      <div className="container-page flex flex-col items-center gap-5 py-20 text-center">
        <CheckCircle2 size={40} className="text-positive" aria-hidden="true" />
        <h1 className="font-display text-2xl font-semibold">{t("checkout.orderPlaced")}</h1>
        <p className="max-w-md text-on-surface-muted">{t("checkout.orderPlacedBody", { phone })}</p>
        <OrderReference token={token} />
        <div className="flex max-w-md flex-col items-center gap-2">
          {saved ? (
            <p role="status" className="text-sm">
              {t("order.savedOnDevice")}
            </p>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={save}
              aria-describedby="save-order-device-warning"
            >
              {t("order.saveOnDevice")}
            </Button>
          )}
          <p id="save-order-device-warning" className="text-sm text-on-surface-muted">
            {t("order.sharedDeviceWarning")}
          </p>
          {!saved && saveState === "failed" && (
            <p role="status" className="text-sm text-on-surface-muted">
              {t("order.storageUnavailable")}
            </p>
          )}
        </div>
        <Button asChild size="lg">
          <Link to="/order/$token" params={{ token }}>
            {t("checkout.trackNow")}
          </Link>
        </Button>
      </div>
    </>
  );
  return embedded ? confirmation : <StoreLayout>{confirmation}</StoreLayout>;
}
