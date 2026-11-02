import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { financeAccessToken } from "@/lib/finance";
import { receiveCodPayment } from "@/lib/erpnext/actions";
import { formatDzd } from "@/lib/format";

export function CodReceipt({
  orderId,
  total,
  onSaved,
}: {
  orderId: string;
  total: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(String(total));
  const [receivedAt, setReceivedAt] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await receiveCodPayment({
        data: {
          orderId,
          accessToken: await financeAccessToken(),
          amount: Number(amount),
          reference,
          receivedAt: new Date(receivedAt).toISOString(),
        },
      });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      setOpen(false);
      onSaved();
    },
    onError: onSaved,
  });
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Enregistrer un reversement reçu
      </Button>
    );
  return (
    <form
      className="flex max-w-md flex-col gap-3 rounded-xl border border-outline p-3"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <p className="text-xs text-on-surface-muted">
        À enregistrer après réception effective par Elegancia. Montant intégral attendu :{" "}
        {formatDzd(total, "fr")}. Un montant net de frais nécessite un rapprochement comptable.
      </p>
      <Field label="Montant effectivement reçu (DA)">
        <Input
          required
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </Field>
      <Field label="Date et heure de réception">
        <Input
          required
          type="datetime-local"
          value={receivedAt}
          onChange={(event) => setReceivedAt(event.target.value)}
        />
      </Field>
      <Field label="Référence du reversement">
        <Input
          required
          maxLength={200}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
      </Field>
      <label className="flex gap-2 text-xs">
        <input type="checkbox" required />
        J’atteste qu’Elegancia a effectivement reçu ce montant.
      </label>
      {mutation.isError && (
        <p role="alert" className="text-xs text-error">
          {mutation.error.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={mutation.isPending}>
          Enregistrer le reversement
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
    </form>
  );
}
