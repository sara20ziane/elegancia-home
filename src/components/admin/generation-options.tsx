import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/form";

export function GenerationOptions({
  differentPrices,
  setDifferentPrices,
  differentStock,
  setDifferentStock,
  unavailable,
  retrying,
  onRetry,
}: {
  differentPrices: boolean;
  setDifferentPrices: (value: boolean) => void;
  differentStock: boolean;
  setDifferentStock: (value: boolean) => void;
  unavailable: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      <Switch
        label="Prix différents selon la taille"
        checked={differentPrices}
        onChange={(e) => setDifferentPrices(e.target.checked)}
      />
      <Switch
        label="Stock par configuration"
        checked={differentStock}
        onChange={(e) => setDifferentStock(e.target.checked)}
      />
      {unavailable && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>Standards en ligne indisponibles. Les standards Elegancia intégrés sont utilisés.</p>
          <Button variant="ghost" size="sm" disabled={retrying} onClick={onRetry}>
            {retrying ? "Rechargement…" : "Recharger les standards"}
          </Button>
        </div>
      )}
    </>
  );
}
