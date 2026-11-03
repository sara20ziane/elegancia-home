import { EMPTY_CHECKOUT_FORM, type CheckoutForm } from "@/lib/checkout-form";
import { pickupFee, resolveDelivery, useDeliveryZones } from "@/lib/delivery";
import { useI18n } from "@/lib/i18n-context";
import {
  useManualOrderCatalog,
  type ManualOrderSource,
  type ManualOrderVariant,
} from "@/lib/manual-order";
import { useStoreSettings } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
type ManualLine = { variantId: string; quantity: number };

export function variantLabel(variant: ManualOrderVariant) {
  return [variant.productName, variant.setType, variant.size, variant.colorName]
    .filter(Boolean)
    .join(" · ");
}

function isParure(variant: ManualOrderVariant) {
  return variant.setType === "Parure de drap" || variant.setType === "Parure housse de couette";
}

export function useManualOrderState(onClose: () => void) {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const catalog = useManualOrderCatalog();
  const { data: settings } = useStoreSettings();
  const { data: zones } = useDeliveryZones();

  const [form, setForm] = useState<CheckoutForm>(EMPTY_CHECKOUT_FORM);
  const [source, setSource] = useState<ManualOrderSource>("instagram");
  const [confirmed, setConfirmed] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [lines, setLines] = useState<ManualLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variants = useMemo(() => catalog.data ?? [], [catalog.data]);
  const variantById = useMemo(
    () => new Map(variants.map((variant) => [variant.id, variant])),
    [variants],
  );
  const selectedLines = lines
    .map((line) => ({ ...line, variant: variantById.get(line.variantId) }))
    .filter((line): line is ManualLine & { variant: ManualOrderVariant } => Boolean(line.variant));

  const subtotal = selectedLines.reduce((sum, line) => sum + line.variant.price * line.quantity, 0);
  const parureQuantity = selectedLines.reduce(
    (sum, line) => sum + (isParure(line.variant) ? line.quantity : 0),
    0,
  );
  const delivery = resolveDelivery(
    settings ?? null,
    zones ?? [],
    form.wilaya || null,
    subtotal,
    form.delivery_method,
    parureQuantity,
  );
  const homeDelivery = resolveDelivery(
    settings ?? null,
    zones ?? [],
    form.wilaya || null,
    subtotal,
    "home",
    parureQuantity,
  );
  const stopdeskFee = pickupFee(zones ?? [], form.wilaya || null, parureQuantity);
  const deliveryAvailable = Boolean(form.wilaya && delivery.available);
  const total = subtotal + (deliveryAvailable ? delivery.fee : 0);

  const reset = () => {
    setForm(EMPTY_CHECKOUT_FORM);
    setSource("instagram");
    setConfirmed(false);
    setSelectedVariantId("");
    setLines([]);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const addVariant = () => {
    const variant = variantById.get(selectedVariantId);
    if (!variant || variant.stock < 1) return;
    setLines((current) => {
      const existing = current.find((line) => line.variantId === variant.id);
      if (!existing) return [...current, { variantId: variant.id, quantity: 1 }];
      if (existing.quantity >= variant.stock) return current;
      return current.map((line) =>
        line.variantId === variant.id ? { ...line, quantity: line.quantity + 1 } : line,
      );
    });
    setSelectedVariantId("");
  };

  const changeQuantity = (variant: ManualOrderVariant, delta: number) => {
    setLines((current) =>
      current
        .map((line) =>
          line.variantId === variant.id
            ? { ...line, quantity: Math.max(0, Math.min(variant.stock, line.quantity + delta)) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  return {
    locale,
    queryClient,
    catalog,
    form,
    setForm,
    source,
    setSource,
    confirmed,
    setConfirmed,
    selectedVariantId,
    setSelectedVariantId,
    lines,
    setLines,
    submitting,
    setSubmitting,
    error,
    setError,
    variants,
    selectedLines,
    subtotal,
    delivery,
    homeDelivery,
    stopdeskFee,
    deliveryAvailable,
    total,
    reset,
    close,
    addVariant,
    changeQuantity,
  };
}
export type ManualOrderState = ReturnType<typeof useManualOrderState>;
