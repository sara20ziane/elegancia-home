import type { StoreSettings } from "./store-settings";
import { setupGaps } from "./setup-status";

export type SetupAudit = {
  published: number;
  missingVariants: number;
  invalidPrices: number;
  missingPhotos: number;
  demoContent: number;
  deliveryReady: boolean;
  checkoutReady: boolean;
};

export function configurationChecks(settings: StoreSettings | null, audit: SetupAudit) {
  const gaps = new Set(setupGaps(settings, audit.deliveryReady ? 1 : 0));
  return [
    {
      label: "Nom de la boutique",
      ok: !!settings && !gaps.has("name"),
      to: "/admin/settings" as const,
    },
    { label: "Logo", ok: !!settings?.logo_url, to: "/admin/settings" as const },
    {
      label: "Coordonnées de contact",
      ok: !!settings && !gaps.has("phone") && !!(settings.address_fr || settings.address)?.trim(),
      to: "/admin/settings" as const,
    },
    { label: "WhatsApp", ok: !!settings && !gaps.has("whatsapp"), to: "/admin/settings" as const },
    {
      label: "Informations légales",
      ok: !!settings && !gaps.has("legal"),
      to: "/admin/settings" as const,
    },
    { label: "Livraison Packers", ok: audit.deliveryReady, to: "/admin/delivery" as const },
    { label: "Produits publiés", ok: audit.published > 0, to: "/admin/products" as const },
    {
      label: "Photos des produits publiés",
      ok: audit.published > 0 && audit.missingPhotos === 0,
      to: "/admin/products" as const,
    },
    {
      label: "Prix et configurations actives",
      ok: audit.published > 0 && audit.invalidPrices === 0 && audit.missingVariants === 0,
      to: "/admin/products" as const,
    },
    {
      label: "Checkout et paiement à la livraison",
      ok: audit.checkoutReady && audit.deliveryReady,
      to: "/admin/settings" as const,
    },
    {
      label: "Aucune donnée de démonstration détectée",
      ok: audit.demoContent === 0,
      to: "/admin/products" as const,
    },
  ];
}
