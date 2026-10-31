# Audit ciblé OpenStore DZ v0.2.0 → Elegancia Home

Référence Elegancia : main 64f72dc (package 0.1.0). Référence amont : tag v0.2.0,
commit 62b1a88. Le code amont est consulté séparément, sans merge ni remplacement.

## Déjà présent

React 19 / TanStack Start / Tailwind 4, Supabase Auth/RLS/Storage ; checkout par RPC
place_order, prix canoniques et réservation atomique de stock. Téléphones algériens,
blocklist et limite de pending par téléphone, expiration 24 h, commandes manuelles
owner/staff et order_source. Packers et ses tarifs autoritaires, offre 2/3 parures,
variantes Queen/King et duplication admin, galerie commune au modèle de literie.
Zoom et miniatures, compression WebP/JPEG 1600 px. Realtime et Telegram best effort.
Suivi public par token, sauvegarde locale volontaire ; clipboard avec fallback pour
tracking. Noindex admin, headers nosniff/referrer/permissions et SAMEORIGIN.

## À intégrer

- Commande directe : même AddressFields, DeliveryChoice, calcul tarifaire et
  useCheckoutOrder ; ne pas vider le panier pour un achat direct indépendant.
- Swipe natif et navigation flèches/clavier de la galerie ; conserver son ratio 4:5.
- Copier la référence publique dans confirmation et suivi, sans stockage automatique.
- Limites base : 20 unités par variante et 50 au total, 10 commandes/h/connexion
  selon headers du gateway ; garder les limites téléphone et stock existantes.
- Suppression volontaire avec saisie de référence et confirmation forte ;
  ne jamais supprimer une commande confirmée, expédiée ou avec colis. Restitution transactionnelle avant
  suppression si réservation encore active. Aucune purge automatique.
- Cadrage 4:5 optionnel avec aperçu et focus ; mode image entière par défaut pour
  préserver les photos de literie. Stockage et anciennes images inchangés.
- Avis admin de version amont publiée, version dérivée et schéma Elegancia ; aucun
  bouton d'application automatique et aucun collage du schema.sql amont.
- CSV/Sheets protégés contre formules ; DENY, CSP compatible, no-store admin et
  exclusion du cache service-worker des pages sensibles.

## À adapter

L'amont QuickOrder a une logique et des tarifs Guepex incompatibles : seuls les
principes sont repris. Le ratio CSS réel de la galerie Elegancia est déjà 4:5, malgré un ancien commentaire 4:3 dans son composant ; le cadrage suit ce ratio réel et garde l'image entière par défaut. La version de schéma doit être propre à Elegancia et accessible
aux seuls admins. Le contrôle de nouveautés lit les releases publiées plutôt que
le package.json de main, pour ne pas annoncer une version de développement.

Les limites réseau dépendent de headers d'infrastructure fiables : cf-connecting-ip
et dernier x-forwarded-for, conformément au mécanisme amont. Elles ne sont pas une
preuve d'identité et ne remplacent pas les limites de quantité, de téléphone et de
stock. Les gros achats de literie passent par l'admin ; les limites retail restent
20 unités d'une variante / 50 pièces, sans restriction à 2 ou 3 parures.

Dépendances : versions majeures déclarées identiques à la release ciblée. Vérifier
le verrou seroval (correctifs XSS) sans changer de majeur Vite/TanStack/Lucide.

## À ignorer

**69 wilayas : non intégrées sur demande.** Aucun changement des listes de wilayas,
communes, relations, transporteurs, tarifs, héritage ou données géographiques.
Ni workflow Update OpenStore, ni remplacement complet du schéma ou du branding.
Les ajouts amont hors demande sans effet sur cette mission ne sont pas importés.

## Risques déjà constatés

La suppression directe en base ne restitue pas le stock ; l'UI doit utiliser une
RPC transactionnelle réservée admin. Le service worker met actuellement des pages
admin en cache. Les exports échappent les guillemets CSV mais pas les formules.
Les fonctions serveur TanStack ne configurent pas le middleware CSRF. Le type Supabase généré est en retard sur les migrations. Les contrôles de main
échouent déjà (types, lint, Knip et trois tests) ; ne pas rétablir d'anciens tarifs
pour faire passer les tests. Aucun jeu de données ou catalogue ne doit être modifié.
