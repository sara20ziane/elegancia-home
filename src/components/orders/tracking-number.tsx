import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";
import { copyText } from "@/lib/clipboard";

export function TrackingNumber({ tracking }: { tracking: string | null }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<boolean | null>(null);
  if (!tracking)
    return <p className="text-sm text-on-surface-muted">{t("order.trackingPending")}</p>;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-sm">{t("order.packersTracking")}</p>
      <p dir="ltr" className="select-all break-all font-mono text-sm">
        {tracking}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={async () => setCopied(await copyText(tracking))}
      >
        {t("order.copyTracking")}
      </Button>
      {copied !== null && (
        <p role="status" className="text-sm">
          {t(copied ? "order.trackingCopied" : "order.copyFailed")}
        </p>
      )}
    </div>
  );
}
