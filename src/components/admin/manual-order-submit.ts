import { invalidateAdminOrders } from "@/lib/admin-order-events";
import { placeManualOrder } from "@/lib/manual-order";
import type { FormEvent } from "react";
import { toast } from "sonner";
import type { ManualOrderState } from "./manual-order-state";
export function manualOrderSubmit(state: ManualOrderState, onClose: () => void) {
  const {
    submitting,
    setError,
    selectedLines,
    form,
    deliveryAvailable,
    setSubmitting,
    source,
    confirmed,
    queryClient,
    reset,
  } = state;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (selectedLines.length === 0) {
      setError("Ajoute au moins un article à la commande.");
      return;
    }
    if (!form.wilaya || !form.commune.trim() || !deliveryAvailable) {
      setError("Vérifie la wilaya, la commune et le tarif Packers.");
      return;
    }
    if (form.delivery_method === "stopdesk" && !form.stopdesk_name) {
      setError("Le Stop Desk n’est pas disponible pour cette commune.");
      return;
    }

    setSubmitting(true);
    try {
      await placeManualOrder(
        {
          customer_name: form.customer_name,
          phone: form.phone,
          wilaya: form.wilaya,
          commune: form.commune.trim(),
          address: form.address,
          note: form.note || null,
          delivery_method: form.delivery_method,
          stopdesk_id: null,
          stopdesk_name: form.stopdesk_name || null,
        },
        selectedLines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
        source,
        confirmed,
      );

      invalidateAdminOrders(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["manual_order_catalog"] });
      void queryClient.invalidateQueries({ queryKey: ["admin_low_stock"] });
      toast.success(
        confirmed ? "Commande manuelle créée et confirmée." : "Commande manuelle créée.",
      );
      reset();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de créer la commande.");
    } finally {
      setSubmitting(false);
    }
  };

  return submit;
}
