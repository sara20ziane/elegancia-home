# Production hardening — Elegancia Home

Audit du 3 novembre 2026. Base : `main` à `2cccd9aa36b687e41488d6a0cdaa3cb1c56f509c`.
Branche : `chore/production-hardening`. Aucun travail repris de la branche ERPNext.

## 1. Constats avant modification

| Phase | Verdict et preuve initiale | Intervention |
| --- | --- | --- |
| CI | Confirmé : workflows présents et **actifs**, mais zéro run retourné par GitHub ; `main` non protégée, aucun check requis et aucun ruleset. YAML sans erreur de déclenchement évidente. | Jobs séparés et gate finale ; réglages externes ci-dessous. La cause administrative de l'absence de runs reste à vérifier dans GitHub. |
| Qualité | Confirmé : **71 erreurs ESLint, 10 warnings**, TypeScript et 250 tests verts. Knip : 8 fichiers, 14 exports et 2 types inutilisés. | Formatage, extractions par responsabilité, dépendances de hooks corrigées ; règles conservées, aucune nouvelle désactivation ESLint. |
| Sécurité | Headers existants présents. CSP limitée aux protections de base. Routes admin gardées côté React et données protégées côté SQL. CSRF des server functions présent. | Headers préservés ; API privées aussi `noindex/no-store` ; CSP candidate uniquement en Report-Only. |
| Supabase | Warnings confirmés par Advisors Production en lecture seule, détail ci-dessous. Aucune table `public` sans RLS. | Tests de droits effectifs et deux index additifs versionnés. Aucune migration distante exécutée. |
| Analytics | Confirmé : tableaux internes calculés à partir des commandes, aucun funnel client. | Abstraction de six événements + intégration Vercel optionnelle. |
| Images/SEO | L'API catalogue lit déjà `alt`, mais les galeries le perdaient en convertissant les images en URL ; cartes avec alt vide. Canonical/sitemap/OG/Twitter déjà présents. | Priorité au texte en base, fallback par photo ; offres Product et disponibilité réelle. |
| Finance | Module complet déjà présent : pas de réécriture. Protections et tests existants substantiels. | Régression SQL/PDF/rôles/idempotence conservée, tests de frontière ajoutés. |
| E2E | Playwright existant écrit des commandes sur le projet configuré ; manuel dans CI ; ancien scénario sans commune obligatoire. | Suite isolée automatisée + garde des tests connectés et commune ajoutée au scénario existant. |
| Performance | Bundle principal initial : **838,25 kB / 250,65 kB gzip**. Requêtes React Query partagées SSR/client, variantes/images chargées ensemble, fonts locales. Waterfall évident dans le loader accueil. | Trois lectures indépendantes démarrées ensemble ; aucun chantier de bundle ni de design. |
| Documentation | Activation Finance déjà décrite, mais pas de procédure globale de durcissement. | Ce document et mise à jour des consignes E2E. |

Les lectures Supabase n'ont porté que sur la configuration, les Advisors et les métadonnées.
Aucune donnée cliente n'a été copiée dans une base de test. Aucun tarif Packers, stock
commercial, règle COD ou promotion de livraison n'a été modifié.

## 2. Corrections et vérifications

Résultats exécutés localement sur la branche :

| Commande | Résultat |
| --- | --- |
| `npm ci` | OK, installation propre du lockfile (426 packages) |
| `npm run check` | OK : TypeScript, ESLint, 263 tests, Knip, build production |
| `npm run lint -- --max-warnings=0` | OK, zéro erreur et zéro warning |
| `npm run test:db` | OK, 11 tests incluant les scénarios SQL versionnés |
| `bash scripts/testing/native-postgres.sh` | OK, migrations + régression + concurrence 40/16/16 |
| `npm run test:e2e:ci` | OK, 6 scénarios desktop/360 px |
| `npm run check:client-secrets` | OK sur le build public |
| `npm audit --omit=dev --audit-level=high` | OK, zéro vulnérabilité |
| Gitleaks v8.24.3, historique complet, sorties masquées | OK après exception de la seule chaîne publique documentée |
| actionlint v1.7.7 sur les deux workflows | OK |

L'exécution hébergée GitHub/CodeQL et les Deployment Checks doivent être observés
sur la PR. Knip affiche une information de configuration concernant les imports
CSS exclus de son graphe ; aucun code inutilisé n'est masqué. Le warning de taille
de chunk préexistant est décrit dans la section performance.

`npm run check` contrôle TypeScript, ESLint, tests, Knip et build. La CI les exécute dans
des jobs distincts, sans arrêt des autres diagnostics après un premier échec.
`CI required` échoue si un job requis échoue, est annulé ou est sauté.

Autres contrôles :

- `npm run test:db` : toutes les migrations dans PostgreSQL WASM jetable, droits anon,
  non-admin, RLS, buckets, Finance OFF et régression checkout/anti-abus/stock.
- `bash scripts/testing/native-postgres.sh` : PostgreSQL 17 isolé, régression Finance,
  40 numéros concurrents et 16 émissions/16 reversements COD simultanés.
- `npm run test:e2e:ci` : navigateur → UI réelle → adaptateur HTTP local → vraies RPC
  SQL de commande/suivi dans une base jetable ; desktop et 360 px, arabe/RTL,
  formulaire, variante, panier, COD, accès anonyme, PDF non autorisé et SEO.
- `npm run check:client-secrets` : contrôle du build public, marqueur de variable
  privilégiée, format secret Supabase et JWT service-role, sans afficher de clé.
- `npm audit --omit=dev --audit-level=high` et Gitleaks sur l'historique complet.
  CodeQL reste indépendant. Aucun secret Production n'est nécessaire en CI.

La dépendance transitive `seroval` a été actualisée dans le lockfile pour corriger
l'avis modéré trouvé par npm. Audit de production final : zéro vulnérabilité.
Le nom public `elegancia-saved-orders-v1` était détecté deux fois dans l'historique :
l'allowlist Gitleaks porte uniquement sur cette chaîne exacte, pas sur un fichier.

Les anciens guides qui recommandaient de rejouer `schema.sql` portent désormais un
avertissement : ce snapshot historique ne doit pas écraser les migrations de sécurité.

Les huit fichiers inaccessibles depuis les routes/points d'entrée ont été supprimés :
anciens éditeurs size-guide, générateur de variantes, variante-images et client Guepex
inutilisé. Les helpers associés sans appel ont été retirés ; les fonctions utilisées
seulement en interne ne sont plus exportées. Les données size-guides, leur affichage
public, le webhook historique et tous les parcours Packers restent présents.

## 3. Audit sécurité et Supabase Advisors

Production observée à 08:42–08:44 UTC : `enabled=false`, `auto_issue=false` ;
les buckets `finance-invoices` et `finance-documents` ont `public=false`.
Le projet « Elegancia Home Test » est distinct et avait déjà `enabled=true`.
Aucun de ces réglages n'a été modifié.

| Warning / risque | Classe | Décision |
| --- | --- | --- |
| Déploiement sans vérifications requises | **CRITICAL** | Corriger CI dans cette PR ; activer protections GitHub ET Deployment Checks Vercel. |
| [Leaked Password Protection désactivé](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) | **IMPORTANT** | Action Auth manuelle ; pas de SQL ni modification de mots de passe existants. |
| [pg_net dans public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) | **IMPORTANT** | Pas de déplacement/suppression : export webhooks utilise `net.http_post`. Vérifier la relocalisabilité de la version avec Supabase avant tout changement. |
| [RLS sans policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) : `invoice_counters`, `order_connection_limits` (2) | **FALSE POSITIVE / BY DESIGN** | Tables internes, accès direct refusé. Ajouter une policy publique ouvrirait une brèche. |
| [SECURITY DEFINER anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) (5) | **FALSE POSITIVE / BY DESIGN** | Surface publique explicite, voir liste ci-dessous et tests de privilèges. |
| [SECURITY DEFINER authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) (32) | **FALSE POSITIVE / BY DESIGN** | Contrôle de rôle dans le corps pour les RPC sensibles ; `authenticated` seul ne suffit jamais. Tests owner/staff/non-admin. |
| [FK sans index](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) (24) | **IMPORTANT** pour les deux parcours ciblés | Index préparés pour `cod_withholding_receipts.settlement_id` (totaux/retenues) et `finance_purchase_items.variant_id` (historique/restriction de suppression de variante). |
| 22 autres FK signalées | **SAFE TO IGNORE** à ce volume | Références créateur, comptes, catégories et fournisseurs ; pas de scan critique démontré. Réévaluer avec statistiques et EXPLAIN avant ajout. |
| [Unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) (15) | **SAFE TO IGNORE** | Finance OFF et statistiques récentes : zéro utilisation ne justifie aucune suppression. |
| [Policies permissives multiples](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) (11) | **FALSE POSITIVE / BY DESIGN** | Lecture du catalogue publié et accès admin distincts ; ne pas fusionner mécaniquement les permissions. |

RPC SECURITY DEFINER accessibles à `anon`, et uniquement celles-ci :

- `catalogue_page`, `category_product_counts` : produits publiés et champs publics.
- `place_order` : entrée publique nécessaire au COD ; validation SQL, prix autoritaires,
  limites par commande/téléphone/connexion et réservation transactionnelle.
- `track_order` : token UUID imprévisible requis ; aucun listing ni recherche par téléphone.
  Ce token est une capacité de lecture privée : ne pas le journaliser ni l'envoyer aux analytics.
- `admin_exists` : booléen d'installation sans identité d'administrateur.

Ces fonctions ont `search_path=''`. `claim_store` n'est pas exécutable par anon,
exige une identité et un magasin sans admin, sous verrou. Avant d'ouvrir une
installation neuve au public, réclamer le magasin avec le compte owner prévu.
Les API Finance vérifient le JWT auprès d'Auth, puis `admin_users` ; les mutations
utilisent ce JWT et les permissions SQL. La clé service-role sert seulement aux
archives serveur. Les PDF exigent admin ou token valide, avec refus sans cache.
Les factures émises et avoirs sont immuables, les écritures idempotentes et la
numérotation atomique. Une créance COD n'est jamais présentée comme trésorerie encaissée.

Migration `20261103083814_production_hardening_indexes.sql` : deux index seulement,
avec timeout de verrou court ; aucune mise à jour de donnée, aucun changement de
GRANT/RLS, aucune activation Finance. Les contraintes uniques couvrent déjà
`invoice_items.invoice_id` et `finance_purchase_items.purchase_id` : pas d'index doublon.
Appliquer d'abord à Test ; une contention fait échouer proprement la migration.

## 4. CSP, analytics, SEO et performance : limites volontaires

La CSP appliquée reste `frame-ancestors`, `base-uri`, `object-src`, `form-action`,
`upgrade-insecure-requests`. La candidate complète utilise un header
`Content-Security-Policy-Report-Only` : aucune restriction nouvelle ne bloque le site.

| Directive candidate | Risque à tester avant application |
| --- | --- |
| `default-src 'self'` | Toute ressource externe non déclarée, dont outils Preview Vercel. |
| `script-src` self + inline + script Analytics Vercel | TanStack/React injectent des scripts inline de bootstrap/hydratation. Pas de suppression de `unsafe-inline` sans nonce vérifié. |
| `style-src` self + inline | Styles dynamiques et CSS local ; vérifier widgets et Preview. |
| `img-src` self + HTTPS + data/blob | Images Supabase, photos externes existantes, prévisualisations upload. |
| `font-src` self + data | Fontsource local ; vérifier PDFs et nouvelles polices avant extension. |
| `connect-src` self + Supabase HTTPS/WSS + Vercel Insights | Auth, REST, Storage, Realtime, server functions ; un domaine Supabase personnalisé doit être ajouté explicitement. |

Observer la console sur Test, avec login admin, upload, variantes, commande et PDF,
avant de promouvoir une directive. Aucun endpoint de collecte CSP ne reçoit les URL privées.

Analytics : événements `view_product`, `select_variant`, `add_to_cart`, `view_cart`,
`begin_checkout`, `order_completed`. Seuls IDs produit/variante, slug, quantité,
montant facultatif et devise DZD franchissent `analytics-events.ts`. Aucun objet
client/commande n'est transmis. Les montants de panier sont des aperçus marchandise ;
`order_completed` n'envoie pas de montant non confirmé, seulement la quantité.
Il signifie commande COD acceptée, pas paiement encaissé. Les appels sont différés,
sans attente dans checkout, et les exceptions synchrones/asynchrones sont absorbées.
Les pages admin/login/setup/order/track/API sont exclues ; query et fragment sont retirés.
Vercel Analytics est opt-in et les événements custom dépendent de l'offre Vercel.
Pour Meta/GA4, remplacer l'adapter et traiter le consentement sans changer les composants.

Alt : priorité au texte non vide en base pour l'URL affichée ; sinon nom localisé,
couleur de la variante propriétaire de cette photo, Elegancia Home. Pas de taille,
matière ou couleur sélectionnée si elle ne correspond pas à la photo.
Canonical, sitemap, OpenGraph et Twitter conservés. Product contient offres DZD et
disponibilité des variantes actives. Aucun avis/rating inventé ; aggregateRating
omis car la lecture actuelle est plafonnée à 50 avis et n'est pas un agrégat exhaustif.
JSON-LD échappe `<` pour empêcher la fermeture d'un élément script par un nom produit.

Performance : loader accueil passe de 2 vagues de lectures à 1 pour trois requêtes
indépendantes. C'est une réduction de dépendance, pas une mesure de latence Production.
Bundle principal après : **838,46 kB / 251,12 kB gzip**, soit +0,47 kB gzip avec
l'intégration analytics et le durcissement. L'avertissement initial >700 kB reste
documenté ; pas de changement artificiel du seuil. PDFme et sa police restent serveur.
Pas de N+1 manifeste sur le catalogue : variantes/images jointes ; React Query SSR
partage ses entrées avec le client, staleTime cinq minutes, pas de refetch au focus.
Images WebP, redimensionnement upload et lazy loading existants conservés.

## 5. Actions manuelles GitHub

Dans **Settings → Actions → General**, autoriser Actions et les actions utilisées
(`actions/*`, `github/codeql-action/*`). Permissions par défaut : **Read repository
contents** ; ne pas autoriser la création/approbation de PR par les workflows.
Les deux workflows étaient actifs à l'audit, mais sans run : ouvrir Actions,
déclencher CI puis vérifier tout message de quota, paiement, politique ou approbation
du premier contributeur. Le dépôt ne permet pas d'en déduire lequel s'applique.

Dans **Settings → Rules → Rulesets**, règle active sur `main` (ou protection classique) :

- **Require a pull request before merging** ; au moins une approbation indépendante si
  disponible, dismissal des approbations après modification et discussions résolues.
- **Require status checks to pass before merging** : noms exacts **`CI required`** et
  **`CodeQL (javascript-typescript)`**, source GitHub Actions.
- **Require branches to be up to date before merging**.
- **Block force pushes**, **Restrict deletions / Block deletion**.
- Aucun bypass administrateur courant ; pas de push direct ni de fusion automatique.

`CI required` agrège : `TypeScript`, `ESLint`, `Unit tests`, `Dead code`,
`Production build`, `Database security and transactions`, `Dependency security`,
`Secret history scan`, `Storefront and anonymous security`. Ils restent visibles
séparément pour identifier la cause d'un échec. Aucun job requis ne dépend de secrets.
Attendre la première exécution pour sélectionner les noms dans l'interface GitHub.

## 6. Actions manuelles Vercel

- Garder `main` comme branche Production et vérifier les variables par environnement.
- **Settings → Build and Deployment → Deployment Checks** : ajouter les sources
  GitHub **`CI required`** et **`CodeQL (javascript-typescript)`** comme checks requis
  pour Production ; conserver l'assignation automatique de domaines, contrôlée par
  ces checks. [Documentation](https://vercel.com/docs/deployment-checks).
  La protection de branche seule ne retarde pas un déploiement Git déjà lancé.
  Ne pas utiliser Force Promote pour contourner un échec.
- Preview : URL/clé publique et `SUPABASE_SERVICE_ROLE_KEY` du **Supabase Test**
  correspondant à la branche Preview. Jamais de clé Production en Preview.
- Production, pour la future recette d'archive uniquement :
  `SUPABASE_SERVICE_ROLE_KEY = secret Supabase Production` ; serveur seulement,
  aucun préfixe `VITE_`. Aucune valeur à copier dans GitHub, les logs ou cette PR.
- Activer Web Analytics dans le projet, puis `VITE_WEB_ANALYTICS_ENABLED=true` si
  souhaité. Vérifier les six événements et l'offre custom events en Preview Test.
- Tester les headers réels et les rapports CSP après déploiement Preview ; l'adaptateur
  E2E local ne prétend pas reproduire l'infrastructure de headers Vercel.

## 7. Actions manuelles Supabase

- Activer Leaked Password Protection dans Auth → protections des mots de passe,
  selon la disponibilité du plan ; vérifier le refus d'un mot de passe compromis sur Test.
- Sauvegarde vérifiée, puis migration additive sur Test uniquement d'abord.
  Aucun workflow de cette PR ne pousse les migrations vers un projet distant.
- Vérifier RLS/GRANT/RPC avec vrais JWT anon, utilisateur sans rôle, staff et owner,
  et refus Storage/PostgREST. Le bootstrap local remplace Auth/Storage/cron/net par
  des stubs ; il ne constitue pas une recette des services Supabase hébergés.
- Garder `pg_net` en place ; étudier avec Supabase sa relocalisation et les exports
  avant toute intervention. Ne pas ajouter de policies aux deux tables internes.
- Laisser **Finance Production OFF**, `auto_issue=false`, jusqu'à validation finale.
  Ne pas importer de commandes historiques ni générer de factures réelles pour tester.

## 8. Rollback

Avant fusion : sauvegarder base et Storage et conserver l'identifiant du déploiement
Production précédent. En cas de régression après mise en production, rétablir ce
déploiement via Vercel Rollback et créer un revert de cette PR via une nouvelle PR.
Contrôler ensuite les paramètres d'assignation automatique de domaine.

Garder Finance OFF. Ne supprimer ni facture, ni écriture, ni commande. Les deux
index additifs peuvent rester pendant le rollback applicatif ; leur suppression
éventuelle doit faire l'objet d'une migration séparée après revue. Ne jamais
exécuter un reset Supabase distant ni modifier l'historique des migrations.
Un rollback du code ne restaure pas une sauvegarde de base automatiquement.

## Finance production readiness

Statut : **READY FOR TESTING**. Ce statut autorise la recette sur Test ; il ne vaut
pas validation Production. Les tests SQL/PDF locaux passent, mais la recette intégrale
avec vrais Auth/Storage/PostgREST et configuration Production reste à signer.

- [x] Migrations Finance présentes dans le dépôt.
- [x] RLS et droits vérifiés sur base jetable ; Production sans table publique hors RLS.
- [x] Storage Finance privé dans les migrations et métadonnées Production.
- [x] Service role server-only ; contrôle du build public.
- [ ] Comptes Finance créés et validés dans l'environnement cible.
- [ ] PDF testé avec vrais JWT/Storage et identité légale validée sur Test.
- [ ] Settlement COD testé de bout en bout sur Test, net/frais/retenues et retry.
- [ ] Expense testé de bout en bout sur Test, justificatif et correction.
- [ ] Purchase testé de bout en bout sur Test, coûts et paiement.
- [ ] Refund testé de bout en bout sur Test, avoir et absence de doublon.
- [ ] Invoice tested de bout en bout sur Test : émission concurrente, immutabilité, PDF.
- [ ] Backup et restauration validés.
- [ ] Recette commerciale catalogue/checkout/admin sur Preview connectée à Test.
- [x] **Finance feature flag toujours OFF en Production jusqu'à validation finale**
  (lecture seule : `enabled=false`, `auto_issue=false`).

Aucune vraie facture ni écriture financière Production générée pendant cette intervention.

## Annexe : décision pour chaque FK signalée

Instantané Advisors avant cette PR ; les comptes et références d'audit ne sont pas
supprimés par l'application. Revoir les décisions différées si le volume ou les
plans de requête changent.

| Contrainte | Classe et traitement |
| --- | --- |
| `cod_settlements_account_id_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `cod_settlements_created_by_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `cod_withholding_receipts_account_id_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `cod_withholding_receipts_created_by_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `cod_withholding_receipts_settlement_id_fkey` | IMPORTANT — index préparé |
| `credit_notes_created_by_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `finance_accounts_created_by_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `finance_audit_log_created_by_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `finance_expenses_account_id_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `finance_expenses_category_id_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `finance_expenses_created_by_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `finance_expenses_supplier_id_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `finance_purchase_items_variant_id_fkey` | IMPORTANT — index préparé |
| `finance_purchases_account_id_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `finance_purchases_created_by_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `finance_refunds_account_id_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `finance_refunds_created_by_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `finance_settings_cod_account_id_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `finance_suppliers_created_by_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `financial_movements_created_by_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `invoices_created_by_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `order_finance_cod_account_id_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `order_finance_created_by_fkey` | SAFE TO IGNORE — différé sans suppression de données |
| `variant_costs_created_by_fkey` | SAFE TO IGNORE — différé sans suppression de données |
