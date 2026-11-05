import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase/client";

export function DownloadLabels({
  id,
  format,
  count,
}: {
  id?: string;
  format: "a4" | "label";
  count: number;
}) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const { data } = await getSupabase().auth.getSession();
      if (!data.session) throw new Error("Session administrateur requise.");
      const params = new URLSearchParams({ format, ...(id ? { id } : {}) });
      const response = await fetch(`/api/shipping-labels?${params}`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("PDF indisponible. Vérifiez la session et réessayez.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "etiquettes-internes-elegancia.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF indisponible.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={busy || count < 1 || count > 200}
      onClick={() => void download()}
    >
      {busy ? "Préparation…" : "Télécharger PDF"}
      {count > 200 && " (200 maximum)"}
    </Button>
  );
}
