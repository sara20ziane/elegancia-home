import { useState } from "react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { useI18n } from "@/lib/i18n-context";

export function OrderReference({ token }: { token: string }) {
  const { t } = useI18n();
  const [result, setResult] = useState<boolean | null>(null);
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <p dir="ltr" className="select-all break-all font-mono text-xs">
        {token}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => setResult(await copyText(token))}
      >
        {t("copy.order")}
      </Button>
      {result !== null && (
        <p role="status" className="text-sm">
          {t(result ? "copy.done" : "copy.failed")}
        </p>
      )}
    </div>
  );
}
