# Commandes manuelles Elegancia Home

Le dashboard permet d'enregistrer les commandes reçues hors du site (Instagram, Facebook, WhatsApp, téléphone ou autre) sans dupliquer la logique métier du checkout.

## Fonctionnement

- L'admin ouvre **Commandes → Nouvelle commande**.
- Il choisit la source, les coordonnées cliente, la livraison et les configurations catalogue.
- Les prix, le stock disponible et les frais de livraison restent calculés depuis les données canoniques Elegancia Home.
- La création passe par `place_admin_order()`, réservé aux admins, qui réutilise `place_order()` : mêmes validations, même réservation de stock, mêmes offres de livraison et mêmes tarifs Packers.
- La case **Cliente déjà confirmée** permet de créer directement la commande au statut `confirmed`; sinon elle reste `pending` et suit la file d'appels habituelle.
- La source est conservée dans `orders.order_source`, affichée dans le dashboard et exportée en CSV.

## Sources

`website` est la valeur par défaut de toutes les commandes du storefront. Les commandes manuelles peuvent utiliser `instagram`, `facebook`, `whatsapp`, `phone` ou `other`.

## Sécurité

`place_admin_order()` n'est pas exécutable par `anon`. Il exige une session authentifiée puis vérifie le rôle `owner` ou `staff` avant de déléguer à `place_order()`.
