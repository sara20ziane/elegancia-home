import { useState } from "react";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

export function AnalyticsPeriod({
  onApply,
}: {
  onApply: (from?: string, to?: string, minimum?: number) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minimum, setMinimum] = useState(3);
  const valid =
    (!from && !to) ||
    (!!from && !!to && from <= to && (Date.parse(to) - Date.parse(from)) / 86400000 <= 365);
  return (
    <details className="rounded-[12px] border border-outline p-3 text-sm">
      <summary className="cursor-pointer">Période personnalisée et seuil de classement</summary>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label>
          Du
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Au
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Commandes minimum
          <Input
            type="number"
            min={1}
            max={1000}
            value={minimum}
            onChange={(e) => setMinimum(Number(e.target.value))}
          />
        </label>
        <Button
          type="button"
          size="sm"
          disabled={!valid || minimum < 1 || minimum > 1000 || !Number.isInteger(minimum)}
          onClick={() => onApply(from || undefined, to || undefined, minimum)}
        >
          Appliquer
        </Button>
      </div>
      {!valid && <p role="alert">Choisissez deux dates dans l’ordre, sur 366 jours maximum.</p>}
    </details>
  );
}
