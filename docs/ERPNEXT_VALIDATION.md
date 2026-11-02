# Validation ERPNext — 2 novembre 2026

Base de comparaison : `main` `865783840a7078481d05543edebf79d3d73c8a5f`, dans un
worktree intact séparé. Dépendances installées avec `npm ci`, sans modifier le lockfile.
Environnement local Node 24.19.0 ; la CI du dépôt utilise Node 22.

## Résultats exécutés

| Contrôle                         | Main intact                                | Branche ERPNext                                               |
| -------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| TypeScript                       | Réussi                                     | Réussi                                                        |
| ESLint global                    | 71 erreurs, 10 avertissements              | Mêmes 71 erreurs, 10 avertissements                           |
| Tests Vitest                     | 226/226 réussis                            | **280/280 réussis**, dont 54 nouveaux                         |
| Knip                             | 9 fichiers, 16 exports, 2 types inutilisés | 8 fichiers, 14 exports, 2 types inutilisés, tous préexistants |
| Build production Vercel          | Pas relancé sur main                       | Réussi                                                        |
| `npm run check`                  | Échec préexistant au lint                  | **Échec au lint** ; étapes restantes exécutées séparément     |
| ESLint fichiers ajoutés/modifiés | Sans objet                                 | Réussi, aucun contournement de règle                          |
| `git diff --check`               | Sans objet                                 | Réussi                                                        |

La gate officielle n'est donc **pas verte**. Aucun test ou règle désactivé ; les
échecs préexistants ne sont pas corrigés dans cette mission. La génération du
registre des routes a aussi enregistré le sitemap existant : son ancien
`@ts-expect-error` devenu inutile a été retiré. Les points d'entrée Knip incluent
les nouvelles routes serveur `.ts`, sans les ignorer.

## Tests financiers ajoutés

- `mapping.test.ts` : téléphone local/international, coordonnées absentes, mapping
  variante, montants serveur, livraison offerte, incohérences.
- `client.test.ts` : 401/403/500, retry GET seulement, délai réellement déclenché
  par AbortSignal, budget, authentification serveur, redirections refusées, parsing,
  messages sûrs, configuration et PDF invalide.
- `lifecycle.test.ts` : même cliente, double confirmation concurrente, perte de
  réponse après création/soumission, facture existante, double livraison, double
  paiement concurrent, absence de reversement, écarts, annulation et champs uniques.
- `sync.test.ts` : flag off sans accès privilégié, panne/réseau, reprise, livrée
  sans paiement, paiement et contrôle du solde, retour après facture.
- `print.test.ts` : token invalide/inconnu, droits admin, absence de facture,
  facture brouillon ou liée à une autre commande, panne, flag, PDF sans cache.

Les fixtures sont synthétiques. Aucun de ces tests n'a appelé un ERPNext réel.

## SQL exécuté sur base jetable

Toutes les migrations ont été appliquées dans PostgreSQL embarqué PGlite, puis :

- `supabase/tests/erpnext-finance.sql` : **réussi**. Montants imposés par la base,
  pending sans document financier, confirmations/livraisons/reçus répétés,
  réservation exclusive, rejet d'un token périmé, reçu intégral immuable,
  protection de l'historique, suppression inchangée avant toute tentative ERP,
  stock restauré une fois, GRANT et RLS non-admin.
- `supabase/tests/packers-stock-regression.sql` existant, avec catalogue jetable :
  **réussi**. Réservation, confirmed non expirée, refus et retours répétés.

Limites : Auth/Storage Supabase ont été représentés par des schémas minimaux ;
`pg_net` et `pg_cron` par des substituts sans réseau ni planification. Aucune
écriture en production. Ce contrôle exécute le vrai PL/pgSQL et les contraintes,
mais ne valide ni PostgREST, ni Supabase Auth réel, ni le déploiement d'une migration
sur Supabase. Docker était indisponible dans cet environnement.

## HTTP et artefacts

Serveur TanStack Start démarré localement avec ERPNext désactivé :

| Appel                                         | Réponse observée                    |
| --------------------------------------------- | ----------------------------------- |
| GET `/api/invoices/<token>`                   | 404, `private, no-store, max-age=0` |
| GET `/api/orders/<id>/invoice`                | 404, `private, no-store, max-age=0` |
| GET `/api/erpnext/sync` sans authentification | 401, `private, no-store`            |

Recherche dans `.vercel/output/static` : aucune référence à
`ERPNEXT_API_KEY`, `ERPNEXT_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` ou `CRON_SECRET`.
Le build sépare les modules serveur. Le service worker ne met pas `/api` en cache.

Syntaxe Python du script d'installation : valide. Template Jinja : parsing valide.
L'option `page-size: A4` est déclarée dans `.print-format`, conformément à l'extraction
des options PDF du framework Frappe v15, en plus de la règle CSS `@page`.

## Non vérifié et risques restant à lever

- Version/configuration de l'ERP cible, méthodes natives, droits du compte technique,
  contraintes uniques effectivement installées et comportement face aux personnalisations.
- Comptes/taxes/centre de coûts, prix TTC ou HT, écritures du grand livre et
  reversement COD réel. Les règlements partiels ou nets de frais restent manuels.
- Logo, identité légale et rendu PDF réel A4, accents et documents multipages.
- Écrans dans un navigateur connecté avec de vraies données, mobile 360 px,
  thèmes clair/sombre et RTL. Aucun test E2E sur une boutique de production.
- Mapping du catalogue réel : SKU nullable/non unique, aucune correspondance inventée.
- Scheduler continu lorsque l'admin est fermé, fréquence, quota et durée de fonction
  Vercel. Aucun cron déployé par cette PR.
- Annulation concurrente à une écriture distante : compensation éventuelle à traiter
  par le comptable ; aucune transaction distribuée n'est supposée.

La mise en production doit suivre les étapes de recette puis d'activation dans
[ERPNEXT_INTEGRATION.md](ERPNEXT_INTEGRATION.md). Aucun succès sur instance ERPNext
réelle n'est revendiqué par ce rapport.

## Fichiers

Le manifeste exact des fichiers créés et modifiés est joint ci-dessous.

### Créés

- `docs/ERPNEXT_INTEGRATION.md`
- `docs/ERPNEXT_VALIDATION.md`
- `scripts/erpnext/elegancia-home-invoice.html`
- `scripts/erpnext/setup.py`
- `scripts/testing/erpnext-fixtures.ts`
- `scripts/testing/erpnext-mock.ts`
- `src/components/admin/cod-receipt.tsx`
- `src/components/admin/finance-queue.tsx`
- `src/components/admin/order-finance.tsx`
- `src/components/orders/invoice-download.tsx`
- `src/lib/erpnext/actions.ts`
- `src/lib/erpnext/admin-server.ts`
- `src/lib/erpnext/client.test.ts`
- `src/lib/erpnext/client.ts`
- `src/lib/erpnext/config.ts`
- `src/lib/erpnext/cron.ts`
- `src/lib/erpnext/customers.ts`
- `src/lib/erpnext/database.ts`
- `src/lib/erpnext/documents.ts`
- `src/lib/erpnext/errors.ts`
- `src/lib/erpnext/lifecycle.test.ts`
- `src/lib/erpnext/mapping.test.ts`
- `src/lib/erpnext/mapping.ts`
- `src/lib/erpnext/payments.ts`
- `src/lib/erpnext/print.test.ts`
- `src/lib/erpnext/print.ts`
- `src/lib/erpnext/repository.ts`
- `src/lib/erpnext/sales-invoices.ts`
- `src/lib/erpnext/sales-orders.ts`
- `src/lib/erpnext/setup.ts`
- `src/lib/erpnext/sync.test.ts`
- `src/lib/erpnext/sync.ts`
- `src/lib/erpnext/types.ts`
- `src/lib/finance.ts`
- `src/routes/api.erpnext.sync.ts`
- `src/routes/api.invoices.$token.ts`
- `src/routes/api.orders.$orderId.invoice.ts`
- `supabase/migrations/20261102131348_erpnext_finance.sql`
- `supabase/tests/erpnext-finance.sql`

### Modifiés

- `.env.example`
- `knip.json`
- `public/sw.js`
- `src/components/admin/order-detail.tsx`
- `src/lib/admin.ts`
- `src/lib/manual-order.ts`
- `src/lib/supabase/types.ts`
- `src/routeTree.gen.ts`
- `src/routes/admin.tsx`
- `src/routes/order.$token.tsx`
- `src/routes/sitemap[.]xml.ts`
