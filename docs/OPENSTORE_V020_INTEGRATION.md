# Intégration ciblée OpenStore DZ v0.2.0

Base : `main` **64f72dc5eafd9def24a5514678aa118a612d6b77**. Branche :
`feat/selected-openstore-v020`. Audit avant implémentation :
[OPENSTORE_V020_AUDIT.md](OPENSTORE_V020_AUDIT.md). Source consultée :
[tag v0.2.0](https://github.com/Meykiio/openstore-dz/releases/tag/v0.2.0), commit `62b1a88`.

## Fonctionnalités ajoutées et adaptations

1. **Commande directe** sur la fiche produit, avec variante et quantité choisies.
   Réutilise AddressFields, DeliveryChoice, CheckoutSummary, useCheckoutOrder et le
   même RPC place_order. Le calcul d'aperçu est partagé avec le checkout classique.
   Prix, stock, commune, disponibilité Packers et promotion sont toujours validés
   en base. Une commande directe laisse le panier multi-produits intact ; une
   commande classique réussie le vide. Les protections inFlight, Telegram best
   effort et la sauvegarde locale uniquement sur consentement sont conservées.
2. **Galerie** : swipe natif avec scroll-snap, flèches, miniatures, clavier avec RTL,
   zoom existant, chargement différé des images suivantes. Ratio CSS Elegancia 4:5
   conservé, sans changement de thème ni de photos existantes.
3. **Référence publique copiable** dans la confirmation et le suivi existant.
   Feedback FR/AR/EN, réutilisation du fallback clipboard existant. Aucun accès
   public par ID interne et aucune ouverture de lecture de orders.
4. **Anti-abus** : 20 unités maximum par variante (lignes identiques agrégées),
   50 pièces par commande ; limites imposées en base et prévalidées en interface.
   10 commandes réussies par connexion par heure civile du serveur, compteur
   atomique privé à hash d'adresse IP, rétention courte nettoyée lors des appels.
   Owner/staff exemptés du compteur réseau, pas des limites de quantité. Les gros
   achats passent par l'administration. Les protections téléphone, prix/stock,
   disponibilité de livraison et expiration pending après 24 h restent en place.
   Ajout d'un plafond global de 20 avis en attente créés dans l'heure, avec verrou
   transactionnel, pour protéger la modération contre l'automatisation.
5. **Suppression admin** volontaire : saisie exacte de la référence publique,
   bouton désactivé pendant l'appel et verrou anti-double clic, erreurs lisibles,
   invalidation listes/compteurs/analyses/historique téléphone. Pas de flag test
   dans le modèle existant : confirmation forte pour toutes les commandes
   éligibles. Confirmed/shipped/delivered ou tracking présent : suppression
   interdite côté interface ET SQL. Une commande pending restitue sa réservation
   dans la même transaction ; les états négatifs déjà restockés ne la restituent
   pas une seconde fois. Aucune purge automatique ni modification des commandes
   existantes lors de la migration. DELETE direct authenticated retiré pour éviter
   de contourner la RPC owner/staff.
6. **Images admin** : aperçu avant envoi, image entière par défaut, crop 4:5
   facultatif avec position verticale, sans étirement. Compression WebP/JPEG
   jusqu'à 1600 px, maximum 20 Mo à l'entrée, garde-fou 50 mégapixels après décodage,
   maximum 8 Mo à l'envoi. JPEG/PNG/WebP/AVIF/GIF acceptés, SVG refusé. GIF décodé
   en photo fixe. Bucket et chemins existants conservés, nouvelles URLs aléatoires,
   aucune suppression/réécriture des anciennes images. Les échecs gardent l'aperçu
   et permettent de réessayer.
7. **Versions** : version dérivée explicite `0.1.0-elegancia-selected-v020`, dernière
   référence OpenStore examinée `0.2.0`, consultation des releases publiées via
   l'API GitHub avec délai maximal de 5 s/cache React Query de 6 h. Métadonnées
   invalides ignorées, lien construit vers le dépôt amont fixe. Aucun workflow
   d'update, exécution SQL ou mise à jour automatique.
8. **Schéma Elegancia** : marqueur attendu 1, lu via RPC admin. Fonction absente :
   version 0 et avertissement ; réseau/permissions indisponibles : état inconnu.
   Ce marqueur ne prétend pas appliquer l'intégralité du schéma OpenStore v0.2.0.
   Les futures migrations incompatibles devront incrémenter ce protocole.
9. **Sécurité** : CSP compatible (frame-ancestors/base-uri/object-src/form-action),
   X-Frame-Options DENY, COOP, noindex/no-store des routes privées, exclusion des
   navigations sensibles du service worker et renouvellement de son cache.
   Middleware CSRF TanStack pour les fonctions serveur. Exports CSV et payload
   Sheets neutralisent les chaînes commençant par une formule, y compris après
   espaces/BOM ; les valeurs numériques restent numériques. Les données stockées
   de la commande restent inchangées. Le script Sheets documenté applique aussi
   cette protection à réception, sans déploiement automatique du script.

## Base de données : migration explicite requise

Script séparé :
[`20261031175750_selected_openstore_safety.sql`](../supabase/migrations/20261031175750_selected_openstore_safety.sql).

Ajoute la table privée order_connection_limits, remplace place_order uniquement
pour les contrôles supplémentaires, ajoute delete_elegancia_order et le marqueur
admin elegancia_schema_version, renforce validate_review et les payloads Sheets.
Fonctions sensibles avec search_path vide et grants explicites. Aucune policy
publique nouvelle sur orders ; track_order, les règles owner/staff, triggers de
stock/expiration, tarifs et relations géographiques restent inchangés.

**Non exécutée en production.** Aucun DROP de données ou migration géographique.
À appliquer explicitement après revue, avant d'utiliser les nouvelles fonctions
admin et avant de considérer les limites serveur déployées. La copie de référence,
la galerie et le checkout restent compatibles avec la base actuelle.

Vérifiée sur PostgreSQL 17 UTF-8 jetable avec le schéma historique et la chaîne de
migrations pertinente. pg_net/pg_cron sont des stubs locaux : aucun appel transporteur,
Telegram ou export externe. Les fixtures SQL sont dans des transactions ROLLBACK.

## Contrôles et comparaison avec main

| Contrôle          | main 64f72dc                               | Cette branche                              |
| ----------------- | ------------------------------------------ | ------------------------------------------ |
| npm run typecheck | 25 erreurs                                 | Réussi, 0 erreur                           |
| npm run lint      | 66 erreurs, 10 avertissements              | 63 erreurs, 10 avertissements préexistants |
| npm test          | 196 réussis, 3 échecs / 199                | 227 réussis / 227                          |
| npm run knip      | 9 fichiers, 13 exports, 2 types inutilisés | Même inventaire préexistant                |
| npm run build     | Réussi                                     | Réussi                                     |

Aucune nouvelle combinaison fichier/règle/sévérité dans le lint global. Les erreurs
restantes concernent principalement le formatage et les limites de taille de
composants historiques non refactorisés. Les nouvelles fonctionnalités passent le
lint ciblé ; deux avertissements Fast Refresh historiques subsistent dans les
composants partagés modifiés. Aucune règle désactivée et aucune fonctionnalité
historique supprimée pour masquer un contrôle rouge.

Les erreurs TypeScript ont été résolues avec les types Supabase régénérés depuis
le schéma existant, les signatures des deux nouvelles RPC, les champs manquants de
fixtures, la route livraison générée et trois corrections de types/variables sans
changement de comportement. Les anciens tests de livraison attendaient un forfait
ou une promotion par montant devenus invalides ; ils vérifient maintenant Packers
et la promotion par parures, sans modifier l'implémentation de livraison. Le test
sur les titres utilise l'AST pour ne plus prendre du texte traduit pour du head.

Tests ajoutés : limites agrégées/nombres invalides ; crop/proportions/upload sans
écrasement ; formules CSV/JSON ; versions publiées et RPC manquante ; conservation
du receiver Supabase ; commande directe et panier intact ; galerie scroll/clavier/
miniatures ; suppression avec référence/inFlight/invalidation et états bloqués.
La suite existante couvre double soumission, Telegram best effort, stockage
volontaire et fallback de copie.

SQL : selected_openstore_safety.sql, packers-stock-regression.sql et
orders-realtime.sql réussis. Vérifient limites, contournement par lignes dupliquées,
11e commande réseau refusée, permissions anon/non-admin, suppression confirmée ou
avec tracking bloquée, restitution unique, refus/retour répétés, absence d'expiration
des commandes confirmées, RLS et publication Realtime conservées, plafond d'avis,
marqueur de schéma et données d'export neutralisées.

Navigateur Chromium, API Supabase **fictive et isolée**, viewports 390×844,
768×1024 et 1440×1000 : fiche et variantes Queen/King, quantité, swipe tactile,
flèches/miniatures/clavier/zoom, absence de débordement, ajout/retrait/modification
panier, commande directe et copie de référence, panier préservé, checkout classique
et panier vidé, login admin, confirmation/suppression/liste rafraîchie, preview,
crop 4:5 et envoi encodé puis rafraîchissement de la galerie admin.

Recette reproductible (Node 24 pour les fixtures TypeScript) :

```bash
node --experimental-strip-types scripts/testing/v020-api.mjs
VITE_SUPABASE_URL=http://127.0.0.1:59999 VITE_SUPABASE_PUBLISHABLE_KEY=test-public-key VITE_SUPABASE_PROJECT_ID=test VITE_DEMO_MODE= npm run dev
node scripts/testing/v020-browser.mjs
```

Les deux premières commandes tournent dans deux terminaux séparés ; Chromium
Playwright doit être installé. Ne jamais utiliser une URL Supabase réelle pour
cette recette.

## Non intégré et points à surveiller

**69 wilayas : non intégrées sur demande.** Wilayas/communes/listes/relations/tarifs,
héritage et migrations associées exclus. Les fichiers de données et l'implémentation
de livraison sont identiques à main. Dans admin.delivery.tsx, seule l'union de type
Locale accepte aussi EN, déjà supporté par l'application ; aucun tarif ou calcul
n'y change. Pas de mise à jour massive de dépendances : package/lock inchangés,
seroval verrouillé à 1.6.7. Aucun remplacement du thème, des modèles, variantes,
workflow Dupliquer, commandes, Packers, Telegram ou sauvegarde locale consentie.

À vérifier sur preview après application contrôlée de la migration : permissions
réelles Supabase/Storage, comportement des headers Vercel et du renouvellement de
service worker, Safari iOS, transporteur/notifications réelles et rendu de vraies
photos de literie. La recette navigateur et la base locale ne remplacent pas cette
vérification sur l'infrastructure déployée. Aucune commande réelle créée/supprimée.

Le compteur connexion dépend des headers fiables du gateway (cf-connecting-ip,
sinon dernier x-forwarded-for) ; sans header valide, les autres protections restent
actives et ce compteur est ignoré. À valider avec une vraie requête Supabase. Ce
n'est pas un CAPTCHA : NAT partagé et changements d'adresse restent des limites
connues. Le plafond utilise des heures civiles, pas une fenêtre glissante. Les
avis disposent d'un plafond global, pouvant demander une modération lors d'un pic.
La détection de release peut être indisponible/limitée par GitHub sans bloquer l'admin.
La CSP ne restreint pas encore script-src/connect-src : elle est volontairement
compatible avec SSR, Supabase et images existantes.

## Responsabilité des fichiers principaux

| Fichiers                                                               | Modification                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| product-detail.tsx, quick-order.tsx, product-order.ts                  | Formulaire direct et construction de la ligne sélectionnée |
| checkout.tsx, checkout-panels.tsx, use-checkout-quote.ts               | Champs et aperçu communs aux deux parcours                 |
| product-purchase.tsx, cart.tsx, order.ts, order-limits.ts              | Limites de quantité et panier résistant au stockage bloqué |
| product-gallery.tsx                                                    | Swipe, flèches, clavier et miniatures avec zoom existant   |
| order-placed.tsx, order-reference.tsx, order.$token.tsx                | Confirmation et suivi avec référence copiable              |
| order-detail.tsx, order-delete.tsx, admin-delete-order.ts              | Suppression protégée via RPC et rafraîchissement admin     |
| product-photos.tsx, image-upload-preview.tsx, image-frame.ts, image.ts | Preview, crop facultatif, validation et compression        |
| version.ts, update-notices.tsx, admin.tsx                              | Information de version et schéma, lecture seule            |
| spreadsheet.ts, orders-file.ts, GOOGLE_SHEETS.md                       | Neutralisation de formules dans les exports                |
| start.ts, vercel.json, sw.js, robots.txt                               | CSRF, headers privés, iframe et cache                      |
| locales/{ar,en,fr}.updates.ts et fichiers d'assemblage                 | Traductions des nouveaux comportements                     |
| supabase/types.ts, routeTree.gen.ts                                    | Contrats alignés sur le schéma et les routes existants     |
| home-hero.tsx, admin.products.tsx, admin.delivery.tsx                  | Corrections TypeScript sans changement métier              |
| *.test.ts(x), supabase/tests/selected_openstore_safety.sql             | Régressions et contrôles de permissions/stock/limites      |
| scripts/testing/v020-*                                                 | Recette navigateur isolée avec API et produits fictifs     |

## Fichiers modifiés (inventaire exact)

- `docs/GOOGLE_SHEETS.md`
- `docs/OPENSTORE_V020_AUDIT.md`
- `docs/OPENSTORE_V020_INTEGRATION.md`
- `public/robots.txt`
- `public/sw.js`
- `scripts/testing/v020-api.mjs`
- `scripts/testing/v020-browser.mjs`
- `scripts/testing/v020-fixtures.ts`
- `src/components/admin/image-upload-preview.tsx`
- `src/components/admin/order-delete.test.tsx`
- `src/components/admin/order-delete.tsx`
- `src/components/admin/order-detail.tsx`
- `src/components/admin/product-photos.tsx`
- `src/components/admin/update-notices.tsx`
- `src/components/orders/order-placed.test.tsx`
- `src/components/orders/order-placed.tsx`
- `src/components/orders/order-reference.tsx`
- `src/components/storefront/checkout-panels.tsx`
- `src/components/storefront/home-hero.tsx`
- `src/components/storefront/product-detail.tsx`
- `src/components/storefront/product-gallery.test.tsx`
- `src/components/storefront/product-gallery.tsx`
- `src/components/storefront/product-purchase.tsx`
- `src/components/storefront/quick-order.test.tsx`
- `src/components/storefront/quick-order.tsx`
- `src/lib/admin-delete-order.ts`
- `src/lib/admin-safety.test.ts`
- `src/lib/cart.tsx`
- `src/lib/delivery.test.ts`
- `src/lib/image-frame.ts`
- `src/lib/image.test.ts`
- `src/lib/image.ts`
- `src/lib/locales/ar.ts`
- `src/lib/locales/ar.updates.ts`
- `src/lib/locales/en.ts`
- `src/lib/locales/en.updates.ts`
- `src/lib/locales/fr.ts`
- `src/lib/locales/fr.updates.ts`
- `src/lib/order-limits.ts`
- `src/lib/order.ts`
- `src/lib/orders-file.ts`
- `src/lib/page-titles.test.ts`
- `src/lib/product-order.ts`
- `src/lib/spreadsheet.ts`
- `src/lib/supabase/types.ts`
- `src/lib/use-checkout-quote.ts`
- `src/lib/v020.test.ts`
- `src/lib/variant-options.test.ts`
- `src/lib/version.ts`
- `src/routeTree.gen.ts`
- `src/routes/admin.delivery.tsx`
- `src/routes/admin.products.tsx`
- `src/routes/admin.tsx`
- `src/routes/checkout.tsx`
- `src/routes/order.$token.tsx`
- `src/start.ts`
- `supabase/migrations/20261031175750_selected_openstore_safety.sql`
- `supabase/tests/selected_openstore_safety.sql`
- `vercel.json`
