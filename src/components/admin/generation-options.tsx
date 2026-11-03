import { Switch } from "@/components/ui/form";

export function GenerationOptions({
  differentPrices,
  setDifferentPrices,
  differentStock,
  setDifferentStock,
  unavailable,
}: {
  differentPrices: boolean;
  setDifferentPrices: (value: boolean) => void;
  differentStock: boolean;
  setDifferentStock: (value: boolean) => void;
  unavailable: boolean;
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
        <p role="alert" className="text-sm">
          Presets indisponibles. Recharge les standards avant de générer un aperçu.
        </p>
      )}
    </>
  );
}
