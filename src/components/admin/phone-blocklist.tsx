import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { blockPhone, canonicalPhone, PHONE_HISTORY_KEY, unblockPhone } from "@/lib/admin-phones";
import { isValidDzPhone } from "@/lib/setup-status";
import { getSupabase } from "@/lib/supabase/client";

export function PhoneBlocklist() {
  const [phone, setPhone] = useState("");
  const [page, setPage] = useState(0);
  const client = useQueryClient();
  const rows = useQuery({
    queryKey: ["blocked_phones", page],
    queryFn: async () => {
      const result = await getSupabase()
        .from("blocked_phones")
        .select("phone", { count: "exact" })
        .order("phone")
        .range(page * 20, page * 20 + 19);
      if (result.error) throw new Error(result.error.message);
      return { rows: result.data, total: result.count ?? 0 };
    },
  });
  const mutation = useMutation({
    mutationFn: ({ value, block }: { value: string; block: boolean }) =>
      block ? blockPhone(value) : unblockPhone(value),
    onSuccess: () => {
      setPhone("");
      void client.invalidateQueries({ queryKey: ["blocked_phones"] });
      void client.invalidateQueries({ queryKey: [PHONE_HISTORY_KEY] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="rounded-[16px] border border-outline p-5">
      <h2 className="font-semibold">Liste de blocage téléphonique</h2>
      <p className="my-2 text-xs text-on-surface-muted">
        Décisions manuelles uniquement. Un historique de refus ne bloque jamais automatiquement une
        cliente. La limite existante reste de trois commandes à confirmer par numéro sur 24 heures.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Numéro
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <Button
          type="button"
          size="sm"
          disabled={!isValidDzPhone(phone) || mutation.isPending}
          onClick={() => {
            if (
              window.confirm(
                `Bloquer manuellement le ${canonicalPhone(phone)} ? Les nouvelles commandes de ce numéro seront refusées.`,
              )
            )
              mutation.mutate({ value: phone, block: true });
          }}
        >
          Bloquer ce numéro
        </Button>
      </div>
      {rows.isError && <p role="alert">Liste indisponible. Réessayez après actualisation.</p>}
      <ul className="my-3 space-y-2 text-sm">
        {rows.data?.rows.map((row) => (
          <li key={row.phone} className="flex items-center justify-between">
            <span dir="ltr">{row.phone}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ value: row.phone, block: false })}
            >
              Débloquer
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          Précédent
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={(page + 1) * 20 >= (rows.data?.total ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          Suivant
        </Button>
      </div>
    </section>
  );
}
