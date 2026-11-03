import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { saveGenerated } from "@/lib/catalog-automation";
import type { GeneratedVariant } from "@/lib/variant-generator";
import type { ProductDraft } from "./product-fields";

export function useGeneratedSave(input: {
  requestId: string;
  rows: GeneratedVariant[];
  model?: ProductDraft;
  productId?: string;
  onSaved: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => saveGenerated(input.requestId, input.rows, input.model, input.productId),
    onSuccess: (id) => {
      for (const key of [["admin_product", id], ["admin_products"], ["products"]])
        void queryClient.invalidateQueries({ queryKey: key });
      toast.success("Configurations créées. Le statut du modèle est conservé.");
      input.onSaved(id);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
