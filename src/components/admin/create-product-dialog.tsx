import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { saveGenerated } from "@/lib/catalog-automation";
import { BeddingGeneration } from "./bedding-generation";
import { QuickModelFields } from "./quick-model-fields";
import type { ProductDraft } from "./product-fields";

export function CreateProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nouveau modèle Elegancia"
      className="!w-[min(95vw,60rem)]"
    >
      {open && <CreateModel onClose={onClose} />}
    </Dialog>
  );
}

function CreateModel({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<ProductDraft>({
    name: "",
    name_fr: "",
    description: "",
    description_fr: "",
    category_ids: [],
  });
  const [step, setStep] = useState(1);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const finish = (id: string) => {
    onClose();
    void navigate({ to: "/admin/product/$id", params: { id } });
  };
  const createAdvanced = async () => {
    setBusy(true);
    try {
      const id = await saveGenerated(crypto.randomUUID(), [], draft);
      finish(id);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <Button variant={!advanced ? "secondary" : "ghost"} onClick={() => setAdvanced(false)}>
          Mode rapide
        </Button>
        <Button
          variant={advanced ? "secondary" : "ghost"}
          onClick={() => {
            if (step === 1 || window.confirm("Quitter le mode rapide et son aperçu ?"))
              setAdvanced(true);
          }}
        >
          Réglages avancés
        </Button>
      </div>
      <h3 className="font-semibold">1 — Modèle · Brouillon</h3>
      {step === 1 || advanced ? (
        <>
          <QuickModelFields draft={draft} onChange={setDraft} />
          <Button
            disabled={busy || !draft.name.trim() || !draft.name_fr.trim()}
            onClick={() => (advanced ? void createAdvanced() : setStep(2))}
          >
            {advanced
              ? "Créer un brouillon vide et ouvrir l’éditeur"
              : "Continuer vers les configurations"}
          </Button>
        </>
      ) : (
        <>
          <p>
            {draft.name_fr} · {draft.name}
          </p>
          <details>
            <summary className="cursor-pointer text-sm">
              Modifier les informations du modèle
            </summary>
            <QuickModelFields draft={draft} onChange={setDraft} />
          </details>
          <BeddingGeneration
            modelName={draft.name_fr || draft.name}
            model={draft}
            onComplete={finish}
          />
        </>
      )}
    </div>
  );
}
