# Intégration ERPNext — Elegancia Home

## État et périmètre

Audit du dépôt réel `sara20ziane/elegancia-home`, `main` au commit
`865783840a7078481d05543edebf79d3d73c8a5f`, le 2 novembre 2026.
Code livré désactivé par défaut. Aucune migration distante, configuration Vercel,
installation ERPNext ou opération comptable de production n'a été exécutée.
Les tests du protocole utilisent un ERPNext simulé ; ils ne certifient pas une
instance réelle. La version et les personnalisations de l'ERP cible restent à valider.

Périmètre : Customer, Sales Order, Sales Invoice, Payment Entry et PDF.
Le storefront, les tarifs Packers, le stock local, les fournisseurs, les achats,
les dépenses et le dashboard existant restent dans leur système actuel.

## Audit avant modification

### Architecture constatée

- React **19.3.0** dans le lockfile (`package.json` : `^19.2.0`), React DOM identique.
- TanStack Start **1.168.61**, Router **1.170.42**, TypeScript strict, Tailwind v4,
  Vite 7 et Nitro `3.0.260522-beta`, preset Vercel.
- Routes fichiers `src/routes/`, génération `src/routeTree.gen.ts`, fonctions
  `createServerFn` dans `src/lib/server/*-actions.ts`, modules serveur protégés
  par `@tanstack/react-start/server-only`. `src/start.ts` applique le contrôle CSRF
  aux server functions. Une route serveur sitemap existe également.
- Supabase JS **2.117.3**, PostgreSQL/PostgREST, RLS et GRANT explicites. Le client
  navigateur utilise une clé publishable ; le serveur des transporteurs réutilise
  le JWT de l'admin après `getUser` et vérification d'`admin_users`.
- Auth admin email/mot de passe Supabase, rôles `owner` et `staff` dans une table
  séparée, pas dans des métadonnées modifiables par l'utilisateur.
- Back-office `/admin` : commandes, catalogue, catégories, avis, livraison,
  réglages et étiquettes `/admin/slips`. Aucun moteur de facture officielle.
- Edge Function Deno héritée `supabase/functions/guepex-webhook/index.ts` : signature
  HMAC, événements dédupliqués, client service_role. Sa présence dans le dépôt ne
  prouve pas qu'elle est déployée ou utilisée par Elegancia.
- Packers est le transporteur actif. Les fonctions Guepex/Yalidine héritées et
  l'exemple de clé Chargily ne constituent pas une intégration de paiement active.
- Secrets de transporteur et Telegram en variables serveur ; exports SQL par
  `pg_net` avec secrets de destination dans une table réservée à l'owner.

### Données et montants

| Objet            | Schéma réellement utilisé                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commande         | `orders.id` UUID interne, `public_token` UUID de suivi, coordonnées, source, mode livraison, montants entiers DZD, statut, dates, transporteur/suivi      |
| Cliente          | Pas de table dédiée : `customer_name`, `phone`, `address`, `commune`, `wilaya` sur chaque commande ; pas d'email client                                   |
| Lignes           | `order_items` : variante liée nullable, nom/label/prix en snapshot, quantité ; pas de SKU en snapshot ni de remise séparée                                |
| Produits         | `products` : single/pack, draft/published/archived, catégories multiples via `product_categories`                                                         |
| Variantes        | `product_variants` : prix, compare_at_price, stock, SKU nullable **sans contrainte unique**, taille/couleur et configuration de literie                   |
| Livraison        | `delivery_zones` alimentée par Packers, domicile/Stop Desk ; commune obligatoire ; aucun tarif de secours                                                 |
| Identité société | `store_settings` : logo_url, brand_color, legal_name, rc_number, nif, adresse/contact optionnels ; branding initial `#9B8065`, informations légales vides |

`place_order` écrit en une transaction ; le navigateur envoie des IDs variantes et
des quantités, jamais une autorité sur les prix. `validate_order_item` prélève le
stock et fixe le prix catalogue. `recalculate_for_order` calcule le total en base.
Les 2+ parures offrent le Stop Desk, les 3+ offrent aussi le domicile. Le tarif
Packers reste nécessaire. La remise produit est déjà comprise dans le prix payé ;
le prix barré ne permet pas d'inventer une remise comptable historique.

`supabase/schema.sql` est un bootstrap historique incomplet. L'audit a aussi lu les
migrations : literie, multi-catégories, offre livraison, sécurité de lancement,
recalcul après suppression, suivi transporteur, Realtime, commandes manuelles et
sécurité sélectionnée OpenStore. Ne pas réinstaller le seul schema.sql en production.

### Cycle existant

| Événement         | Comportement avant intégration                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Création web      | `pending`, réservation atomique du stock, suivi par token                                      |
| Commande manuelle | `place_admin_order` réutilise le checkout ; peut confirmer avec date et admin                  |
| Confirmation      | Admin après appel, `confirmed_at` ; `pending → confirmed`                                      |
| Expédition        | Création du colis Packers, puis validation explicite ; `confirmed → shipped`                   |
| Livraison         | Bouton admin ou correspondance Packers vérifiée ; `shipped → delivered`                        |
| Statut inconnu    | Observation conservée ; aucune transition supposée ; règles Packers vides par défaut           |
| Annulation        | Expiration pending après 24 h, ou changement administratif ; aucun ERP                         |
| Refus/retour      | `refused`, `cancelled`, `returned` restituent le stock lors de la première transition négative |
| Paiement COD      | Aucune notion persistée distincte de la livraison                                              |
| Reversement       | Aucun événement, montant ou rapprochement existant                                             |

Le refus n'est pas une preuve de réception physique en boutique. Le parseur Packers
exige une règle physique vérifiée pour `returned`. Limite préexistante documentée :
réouvrir un état négatif puis le terminer de nouveau peut restituer à nouveau le
stock. L'intégration ERP ne réouvre aucun état et ne change pas ces règles.

### Points d'intégration et plan exécuté

1. Migration additive et file durable sur les événements en base, couvrant les
   commandes manuelles et les autres chemins d'écriture.
2. Services centralisés serveur, contrôle des montants et de l'installation ERP,
   rapprochement client et mapping explicite des variantes.
3. Synchronisation après confirmation/livraison, et reprise de la file dans l'admin.
4. Reversement COD séparé ; pas de paiement induit par une livraison.
5. Routes PDF protégées, composants finance et suivi client.
6. Tests simulés, tests SQL jetables, build et quality gate réelle.

## Architecture retenue et fichiers

```text
Cliente / admin → Elegancia (TanStack Start)
                       ↓
            PostgreSQL : commande + événement durable
                       ↓
          backend lib/erpnext → API REST ERPNext
```

`src/lib/erpnext/` sépare client HTTP, config, customers, sales-orders,
sales-invoices, payments, print, mapping, types, errors, documents, setup,
repository, database, sync, admin-server, actions et cron.

Interfaces : `components/admin/order-finance.tsx`, `cod-receipt.tsx`,
`finance-queue.tsx`, `components/orders/invoice-download.tsx`.
Les points existants modifiés sont `lib/admin.ts`, `lib/manual-order.ts`,
`components/admin/order-detail.tsx`, les routes admin et suivi, les types Supabase,
le registre des routes, `.env.example` et Knip pour les nouvelles routes `.ts`.
Le service worker exclut désormais `/api` du cache, y compris les navigations PDF.
Le vieux `@ts-expect-error` sitemap devenu inutile après génération est retiré.

Assets ERP : `scripts/erpnext/setup.py`, `elegancia-home-invoice.html`.
Tests TypeScript : `src/lib/erpnext/*.test.ts` et fixtures synthétiques dans
`scripts/testing/erpnext-*.ts`. Tests SQL : `supabase/tests/erpnext-finance.sql`.

## Migration locale

Migration générée avec Supabase CLI :
`supabase/migrations/20261102131348_erpnext_finance.sql`.

- `order_finance` : références ERP, statut/erreur/date de synchronisation et reçu COD
  (`cod_received_at`, `cod_received_by`, montant, référence).
- `erp_customers` : téléphone canonique → Customer, unique dans les deux sens.
- `erp_item_mappings` : UUID variante → Item Code, SKU vérifié optionnel.
- `erp_sync_queue` : révisions, réservation durable, tentatives, prochaine reprise.
- RPC de réservation/enregistrement réservées à `service_role`. Lecture financière
  owner/staff ; aucune écriture directe des références par le navigateur.
- RPC du reçu COD : owner/staff, montant intégral égal au total canonique, date
  passée après la création, référence obligatoire ; répétition identique sans effet.
- Un trigger verrouille la file et empêche la suppression après la première tentative
  ou un reçu COD, y compris lorsque la réponse ERP est incertaine. Les métadonnées
  jamais traitées sont nettoyées si une commande négative est supprimée par le flux
  existant : le flag désactivé ne bloque pas ces suppressions.

Aucun backfill automatique des commandes antérieures à la migration. Leur
synchronisation se fait après revue, par le bouton de leur fiche. Les événements
survenus après installation sont enregistrés même si le flag est désactivé :
examiner cette file avant activation. Ne pas effacer des liens après comptabilisation.

## Variables serveur Vercel

Toutes sans préfixe `VITE_`, distinctes entre Preview et Production.

| Variable                                | Usage                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `ERPNEXT_ENABLED`                       | `false` par défaut ; seule la valeur exacte `true` active les appels            |
| `ERPNEXT_URL`                           | Origine HTTPS sans chemin, query ni identifiants                                |
| `ERPNEXT_API_KEY`, `ERPNEXT_API_SECRET` | Utilisateur technique ERP dédié                                                 |
| `ERPNEXT_COMPANY`                       | Société exacte, devise DZD                                                      |
| `ERPNEXT_WAREHOUSE`                     | Entrepôt existant de cette société ; aucun mouvement de stock synchronisé       |
| `ERPNEXT_PRICE_LIST`                    | Liste de vente active en DZD ; les prix viennent toujours des commandes locales |
| `ERPNEXT_SHIPPING_ITEM`                 | Item service existant pour les frais facturés à la cliente                      |
| `ERPNEXT_SALES_TAX_TEMPLATE`            | Optionnel : template de taxes configuré par le comptable                        |
| `ERPNEXT_CASH_ACCOUNT`                  | Compte banque/caisse DZD recevant les fonds ; requis pour Payment Entry         |
| `ERPNEXT_MODE_OF_PAYMENT`               | Mode de paiement ERP exact ; requis pour Payment Entry                          |
| `SUPABASE_SERVICE_ROLE_KEY`             | Clé privilégiée uniquement backend finance, jamais fournie au navigateur        |
| `CRON_SECRET`                           | Optionnel pour le scheduler ; secret aléatoire indépendant                      |

Les variables Supabase publishable existantes restent utilisées pour vérifier
l'authentification admin. Aucune clé ERP dans la base, les logs ou les réponses. Stocker les clés/token Vercel
comme variables Secret et les paramètres non sensibles comme Config.
Le client HTTP bloque les redirections et borne les requêtes à 8 s, avec budget
ERP de 40 s par traitement. Les erreurs persistées sont des messages locaux sûrs.

## Idempotence, retries et disponibilité

Deux barrières complémentaires : réservation PostgreSQL avec token/révision, puis
`custom_elegancia_key` **unique en base ERPNext** sur chacun des quatre DocTypes.
Le backend vérifie ces Custom Fields avant une synchronisation de vente.

- Customer : clé SHA-256 du téléphone normalisé ; recherche du lien local, de la clé
  ERP et du téléphone. En cas d'ambiguïté, arrêt pour rapprochement manuel.
- Sales Order : `eh-order-<orders.id>`.
- Sales Invoice : `eh-invoice-<orders.id>`.
- Payment Entry : `eh-payment-<orders.id>`.

Une création est précédée d'une recherche. Après échec, une recherche récupère un
éventuel document déjà créé. Aucun POST n'est rejoué automatiquement par le client.
La tentative suivante retrouve le brouillon ou document soumis avant de continuer.
Un GET temporairement indisponible peut être réessayé une fois. Les indisponibilités
réessayables restent en file avec backoff plafonné à une heure ; les erreurs
de configuration/mapping/métier sont bloquées jusqu'à correction et clic Réessayer.
La réservation expire après deux minutes si le processus disparaît.

Le navigateur lance une tentative après mutation réussie, sans faire dépendre
la commande de son résultat. L'admin traite aussi une commande de la file chaque
minute lorsqu'il est visible. Pour un traitement continu admin fermé, configurer
un scheduler authentifié sur `GET /api/erpnext/sync`, une commande par appel.
**Aucun cron Vercel n'est activé dans ce changement.** Dimensionner sa fréquence et
les durées de fonctions selon le plan Vercel et le volume avant mise en production.

Les événements nouveaux pendant un traitement restent en file ; les sauvegardes
intermédiaires refusent une révision dépassée. Il n'existe pas de transaction
atomique entre PostgreSQL et ERPNext : une annulation concurrente à une écriture
ERP peut nécessiter une compensation comptable. La clé unique empêche les doublons,
mais ne remplace pas ce rapprochement intersystèmes.

## Lifecycle financier

Confirmation datée → Customer réutilisé → Sales Order soumise.
Le mapping variante/Item doit être renseigné avant synchronisation ; aucun Item
n'est créé. Les montants et lignes ERP calculés doivent correspondre exactement
aux snapshots locaux avant et après soumission. Une différence fiscale ou de prix
laisse un brouillon à examiner et bloque la comptabilisation automatique.

Le champ ERP obligatoire `delivery_date` de la Sales Order reçoit la date de
synchronisation ; ce n'est pas une promesse de date de livraison à la cliente.
Une date prévisionnelle métier pourra remplacer cette convention après validation.

Livraison → `shouldInvoice()` centralise la règle → facture issue de la Sales Order
par la méthode native ERPNext. `update_stock=0`, `is_pos=0`. La facture reste une
créance. L'émission n'exige jamais de modifier le stock ERP pour cette phase.

Reversement effectivement reçu → reçu COD immuable en base → Payment Entry native
liée à cette facture, contrôle des comptes/devises/montants → soumission → relecture
du solde ERP avant badge Payé. Les frais déduits, paiements partiels et règlements
déjà modifiés manuellement dans ERP demandent un rapprochement comptable ; aucun
montant de transporteur ou statut livré n'est interprété comme un reversement.

Annulation/refus avant confirmation sans synchronisation : aucun document ERP.
Après confirmation sans facture : annulation de la Sales Order soumise, une seule fois.
Un brouillon ou une facture existante provoque une alerte d'intervention comptable.
La facture soumise n'est jamais supprimée ; le comptable choisit annulation légale
ou facture de retour/avoir et éventuel remboursement dans ERPNext. L'automatisation
de ce dernier flux est volontairement hors phase 1, compte tenu du retour local.

## Configuration ERPNext nécessaire

1. Valider version/contrat des API v1 et des méthodes natives avec une instance
   de recette. Le code a été écrit avec référence aux sources ERPNext v15 ;
   les installations plus récentes ou personnalisées doivent être testées.
2. Créer société, exercice, plan comptable, comptes clients, comptes produits,
   taxes et centre de coûts selon les règles validées par le comptable. Devise DZD.
3. Créer/valider les Items et variantes, entrepôt, liste de prix et Item service
   de livraison. Ne pas importer les stocks ni auto-créer les Items depuis Elegancia.
4. Installer les Custom Fields et le Print Format avec le script versionné sur
   le bench ERP : dans `bench --site SITE console`, exécuter
   `import runpy; runpy.run_path('/CHEMIN/scripts/erpnext/setup.py', run_name='__main__')`.
   Le script crée les champs/index uniques et met à jour le format portant ce nom ;
   relire une personnalisation existante avant de l'écraser.
5. Renseigner Company `company_logo` avec le logo réel de `store_settings.logo_url`
   lorsqu'il est configuré ; utiliser les vrais champs légaux pour
   `custom_elegancia_rc/nif/nis/ai/legal_address`. Aucune valeur fiscale par défaut.
   Le format français utilise la couleur réelle Elegancia et une mise en page A4.
6. Les taux de TVA restent dans ERPNext. Si les prix du site sont TTC, configurer
   correctement les taxes incluses dans le prix. Ne jamais ajouter une taxe qui
   change silencieusement le total déjà accepté par la cliente.
7. Utilisateur technique avec droits Read/Create/Write sur Customer, Create/Read/
   Write/Submit sur Sales Order/Invoice/Payment Entry et Cancel sur Sales Order.
   Read sur Item, Account, Company, Warehouse, Price List, Custom Field et Print Format.
   Pas de Delete de facture. Autoriser les méthodes natives et l'impression PDF.
   Tester que les restrictions Company n'autorisent que la société Elegancia.
8. Renseigner le mapping dans Supabase via un accès admin authentifié ou le SQL
   Editor, après vérification des SKU réels. Exemple paramétré :
   `insert into public.erp_item_mappings(variant_id,erp_item_code,sku) values
('UUID_VARIANTE_VERIFIE','ITEM_ERP_VERIFIE','SKU_VERIFIE');`
   Ne pas déduire de référence durable d'un SKU vide ou dupliqué.

## Sécurité des PDF

Cliente : `/api/invoices/<public_token>` ; le token de suivi existant est une
capacité donnant déjà accès aux coordonnées de cette commande. Toute personne qui
possède ce lien peut télécharger sa facture : ne pas le publier ni l'envoyer dans
les outils analytics. Aucun accès par UUID interne sans authentification.

Admin : `/api/orders/<id>/invoice`, JWT en header Authorization, vérification
`getUser` puis owner/staff et accès commande. Les deux chemins retrouvent la
référence locale, vérifient société/clé/docstatus de la facture et proxifient le PDF.
Réponse sans cache, sans redirection, sans URL ERP ni secret. Une facture annulée
ou brouillon n'est pas fournie. Le format demandé est `Elegancia Home Invoice`.

## Procédure de test

1. `npm ci`, `npm run check` (gate officielle). Le rapport de validation distingue
   les échecs préexistants du main et ceux du changement.
2. `npx vitest run src/lib/erpnext` : mapping client et vente, montants, livraison
   offerte, doublons, concurrence, perte de réponse après création/soumission,
   documents existants, 401/403/500, timeout, réseau indisponible, flag et PDF protégé.
3. Sur Supabase jetable avec toutes les migrations :
   `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/erpnext-finance.sql`.
   Vérifie queue, tokens, doubles événements, reçu, montants serveur, FK, grants,
   RLS et restitution unique. Exécuter aussi `packers-stock-regression.sql`.
4. Recette réelle : commande pending → aucun document ; confirmer deux fois → un
   Customer/SO ; livrer deux fois → une facture impayée ; saisir deux fois le même
   reversement → un Payment Entry et solde nul. Vérifier le grand livre avec le comptable.
5. Couper ERP, confirmer une commande : elle persiste ; erreur lisible, reprise sans
   doublon. Tester mauvais credentials, délai, redémarrage et réponses perdues.
6. Tester annulation avant/après SO, retour après facture et absence de suppression.
7. Vérifier le vrai PDF A4, logo, données légales, taxes, pages multiples, variantes,
   accents et accès refusé sans rôle/token. Le moteur PDF doit être opérationnel ERP.

## Activation exacte en production

1. Faire relire la PR et traiter les échecs de gate rapportés avant fusion par
   l'équipe ; aucune fusion ou mise en production effectuée par cette intervention.
2. Sur recette isolée, appliquer toutes les migrations et installer/configurer ERP
   comme ci-dessus. Utiliser des clés différentes de production et réussir les tests réels.
3. Sauvegarder la base et relever le dernier déploiement Vercel stable.
4. Appliquer la migration additive en production via la procédure Supabase habituelle
   (`supabase db push` après revue de la liste des migrations, jamais sur un projet supposé).
5. Déployer le code avec `ERPNEXT_ENABLED=false`. Créer les variables serveur de la
   table ci-dessus, installer les champs uniques/format dans l'ERP de production,
   renseigner et vérifier les mappings. Aucun secret dans le chat ou Git.
6. Examiner commandes actives/file depuis l'installation. Configurer le scheduler
   protégé si le traitement doit fonctionner admin fermé. Ne pas exposer le secret
   dans une query string ; utiliser `Authorization: Bearer <CRON_SECRET>`.
7. Passer `ERPNEXT_ENABLED=true` sur Vercel Production puis redéployer.
8. Sur une commande autorisée de recette métier réelle, contrôler Customer/SO,
   puis facture seulement à livraison réelle, et paiement seulement au reversement
   effectivement reçu. Comparer lignes, total, taxes et comptes avec le comptable.
   Vérifier le PDF depuis Elegancia et surveiller erreurs/file.
9. Ne généraliser qu'après validation. Toute écriture comptable de contrôle doit
   être traitée selon la procédure de l'entreprise, jamais supprimée silencieusement.

## Désactivation et rollback

Passer `ERPNEXT_ENABLED=false`, redéployer et arrêter le scheduler. Aucun nouvel
appel ERP n'est lancé ; un appel déjà en vol peut terminer. Les commandes locales,
le stock et Packers continuent. Les références et événements restent conservés.

Pour rollback du code, revenir au déploiement Vercel stable en gardant le flag faux.
**Ne pas supprimer les nouvelles tables ni la migration** : elles conservent les
liens comptables et le trigger de suppression protège cet historique. Contrôler les documents ERP
déjà créés ; annulations/avoirs restent une opération comptable explicite.
Une réactivation reprend les documents par leurs clés uniques.
