import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { StoreLayout } from "@/components/storefront/store-layout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";

export function OrderPlaced({
  token,
  phone,
  saved,
}: {
  token: string;
  phone: string;
  saved: boolean;
}) {
  const { t } = useI18n();
  return (
    <StoreLayout>
      <div className="container-page flex flex-col items-center gap-5 py-20 text-center">
        <CheckCircle2 size={40} className="text-positive" aria-hidden="true" />
        <h1 className="font-display text-2xl font-semibold">{t("checkout.orderPlaced")}</h1>
        <p className="max-w-md text-on-surface-muted">{t("checkout.orderPlacedBody", { phone })}</p>
        <p className="rounded-[10px] border border-outline bg-surface px-4 py-3 font-mono text-xs">
          {token}
        </p>
        <p role="status" className="max-w-md text-sm text-on-surface-muted">
          {t(saved ? "order.savedOnDevice" : "order.storageUnavailable")}
        </p>
        <Button asChild size="lg">
          <Link to="/order/$token" params={{ token }}>
            {t("checkout.trackNow")}
          </Link>
        </Button>
      </div>
    </StoreLayout>
  );
}
