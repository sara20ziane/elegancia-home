# Finance native Elegancia Home

## Phase A — audit et décisions

Base : `sara20ziane/elegancia-home`, main `865783840a7078481d05543edebf79d3d73c8a5f`.
La branche native part de ce commit, sans reprendre la branche de la PR #37.
Cette dernière reste ouverte, brouillon, non fusionnée.

Stack vérifiée : React installé 19.3.0, TanStack Start 1.168.61, Router 1.170.42,
Vite/Nitro preset Vercel, TypeScript strict, Tailwind 4, Supabase JS 2.117.3.
Auth Supabase email/mot de passe et table `admin_users` owner/staff ; contrôle
serveur par `getUser`, CSRF TanStack pour les server functions. Back-office
mobile existant, dictionnaires AR/FR/EN et sidebar directionnelle conservés.

`supabase/schema.sql` est historique : les 21 migrations de main ont aussi été
auditées. `orders` conserve coordonnées, source, mode livraison, montants entiers
DZD et suivi. `order_items` fige nom, variante, quantité et prix catalogue au
checkout. SKU nullable et non unique sur `product_variants`, absent du snapshot
historique. Aucun coût, fournisseur, achat, reversement ou facture officielle.

`place_order` et les triggers SQL restent canoniques : stock réservé atomiquement,
prix serveur, tarifs Packers obligatoires et offre 2+/3+ parures. Les commandes
Instagram/Facebook/WhatsApp/téléphone/autre passent par `place_admin_order`, qui
réutilise exactement ce calcul et peut confirmer explicitement. Sources website,
instagram, facebook, whatsapp, phone, other conservées.

États : pending → confirmed → shipped → delivered ; refused/cancelled/returned
terminent le flux. Packers crée puis valide le colis ; correspondance de statuts
vérifiée, aucune valeur supposée. Expiration pending 24 h, restitution unique sur
premier état négatif. Limite préexistante : réouvrir un état négatif peut produire
une nouvelle restitution ; Finance ne réouvre aucun état et ne tient aucun stock
parallèle. Un refus n'est pas une réception physique de retour.

Suivi public par UUID-capacité, pas par ID interne. Exports Google Sheets via
pg_net ; secrets owner seulement. Bucket média produits public ; aucun bucket
financier existant. Les étiquettes `/admin/slips` ne sont pas des factures.
La fonction Edge Guepex héritée reste inchangée. Aucune production n'a été modifiée.

### PR #37

Retenus conceptuellement : livraison distincte de l'encaissement, état financier
lié à une commande, idempotence, montants canoniques, droits serveur/RLS, historique
protégé, PDF accessible seulement via droits admin ou token de la commande.
Rejetés : API externe, clés externes, documents externes, synchronisation, file,
scheduler et mapping produits externe. Aucun de ces concepts n'existe dans le code natif.

### Références et licences

Références consultées (README, licences et organisation documentaire/écrans) :

| Projet | Licence constatée | Idée retenue, sans copie de code |
| --- | --- | --- |
| [Bigcapital](https://github.com/bigcapitalhq/bigcapital) | AGPL-3.0 | Document commercial distinct des mouvements, lecture revenus/créances/trésorerie |
| [Akaunting](https://github.com/akaunting/akaunting) | BSL, LICENSE.txt | Écrans PME comptes/dépenses/fournisseurs, historique d'un document |
| [IDURAR](https://github.com/idurar/idurar-erp-crm) | AGPL-3.0 | Listes paginées, filtres de statut et actions contextuelles |
| [Invoice Ninja](https://github.com/invoiceninja/invoiceninja) | Elastic License 2.0, source disponible | Historique, avoirs et paiements lisibles |
| [pdfme](https://github.com/pdfme/pdfme) | MIT | Génération serveur depuis un modèle A4 versionné |

Aucun logiciel de référence n'est installé, aucun code AGPL/BSL/ELv2 importé.
Seuls `@pdfme/generator` et `@pdfme/schemas` sont ajoutés comme dépendances MIT,
versions exactes verrouillées. L'application conserve sa licence AGPL-3.0-only.

### Architecture proposée

- PostgreSQL : opérations transactionnelles, numérotation atomique, snapshots,
  mouvements append-only, permissions et agrégations. Aucun total navigateur accepté.
- Backend TanStack existant : authentification, PDF, archivage privé et téléchargement.
- Interface Elegancia : Finance owner uniquement ; Facturation et commandes pour
  owner/staff, sans exposition des coûts ou résultats au staff.
- Activation explicite via réglages, aucun backfill. Les erreurs de capture financière
  ne bloquent pas la commande ; elles sont visibles et réessayables.
- Coût à la confirmation : historique append-only, valeur inconnue explicitement
  signalée. Les mises à jour ultérieures ne modifient pas les snapshots.
- Livraison : créance COD. Reversement en lot : brut canonique, frais validés,
  retenues encore dues et net réellement versé sur un compte configurable.
- Émission : snapshot et numéro atomiques. PDF archivé, hashé, sans écrasement.
  Les échecs de génération sont réessayables sans réémettre la facture.
- Ce module fournit une gestion opérationnelle/analytique ; ce n'est pas une
  certification de comptabilité légale algérienne ni une partie double complète.

Phases : A audit ; B fondations/COD ; C factures/PDF ; D dépenses/comptes ;
E fournisseurs/achats/coûts ; F dashboard/rapports ; G tests/sécurité/recette.

## Modèle livré

Les quatre migrations `20261102135333` à `20261102135852` sont additives,
désactivées par défaut. Aucun import ni traitement financier de l'historique
n'est exécuté à leur application. Elles ne modifient pas `place_order`,
`place_admin_order`, les tarifs Packers ou les fonctions de réservation/restock.

| Tables | Responsabilité |
| --- | --- |
| `finance_accounts`, `finance_categories`, `finance_suppliers`, `finance_settings` | Référentiels configurables, entreprise, activation et règle d'émission |
| `variant_costs` | Historique append-only du coût unitaire ; une nouvelle valeur vise les ventes futures |
| `order_finance` | Snapshot canonique à la confirmation : cliente, provenance, produits, variantes, SKU disponible, prix et coûts connus |
| `financial_movements` | Mouvements immuables par domaine trésorerie, créance ou analytique |
| `cod_settlements`, `cod_settlement_items` | Reversements en lot, brut/frais/retenues/net, une affectation définitive par commande |
| `cod_withholding_receipts` | Encaissements partiels ou complets des retenues d'un lot |
| `invoices`, `invoice_items`, `invoice_counters`, `credit_notes` | Documents et numérotation transactionnelle ; voir INVOICING.md |
| `finance_expenses` | Dépenses et corrections par contrepassation, justificatif privé |
| `finance_purchases`, `finance_purchase_items` | Achats fournisseur, coût figé et paiement complet |
| `finance_refunds` | Remboursement effectif d'un avoir après reversement reçu |
| `finance_audit_log`, `finance_failures` | Historique protégé et erreurs de capture à réessayer |

Les FK financières utilisent RESTRICT et les événements critiques sont non
supprimables. Les références produit/variante des factures sont des snapshots,
pas un second catalogue. Le SKU est informatif : le catalogue actuel n'en garantit
ni la présence ni l'unicité. La clé d'intégrité reste l'UUID canonique.

## Backend et points d'entrée

`src/lib/finance/actions.ts` expose les server functions TanStack existantes.
`server.ts` authentifie par `assertAdmin/getUser`, garde une liste d'opérations
et de tables autorisées et utilise le JWT de l'administrateur. Les calculs et
droits sont répétés dans PostgreSQL. Aucun privilège propriétaire n'est déduit
de données navigateur ni de `user_metadata`.

RPC publiques, avec EXECUTE restreint et contrôle de rôle :

- Référentiels : `finance_configure`, `finance_save_entity`, `finance_set_cost`.
- Commande : `finance_prepare_order`, `finance_order_status`.
- Documents : `finance_issue_invoice`, `finance_create_credit`.
- COD : `finance_record_settlement`, `finance_receive_withholding`.
- Dépenses/achats : `finance_record_expense`, `finance_record_purchase`,
  `finance_pay_purchase`, `finance_refund_credit`, `finance_adjust`.
- Lecture agrégée : `finance_dashboard`, `finance_report`, `finance_receivables`.
- PDF : `finance_document` ; `finance_public_documents` et `finance_archive_pdf`
  sont réservées au rôle serveur pour le suivi et l'archive.
- `finance_is_owner` et `finance_is_admin` servent aux policies.

Le schéma privé `finance_private` contient capture, émission, compteur,
validation de compte/date/justificatif, audit et protections d'immuabilité.
Son USAGE et l'exécution de ses fonctions ne sont pas publics.
Chaque SECURITY DEFINER utilise `search_path=''` et des noms qualifiés.

## Cycle commande et COD

1. Soumission : flux actuel uniquement, aucun mouvement ni facture.
2. Confirmation future après activation : snapshot de prix/coûts. Préparation
   d'un brouillon possible ; aucune trésorerie.
3. Livraison : CA opérationnel TTC livré et créance COD ; aucune entrée de cash.
4. Reversement : sélectionner 1 à 200 commandes livrées du même transporteur,
   saisir référence, date, frais, retenues et net reçu, choisir le compte réel.
5. PostgreSQL verrouille les snapshots dans l'ordre des UUID, recalcule le brut,
   vérifie la livraison et le transporteur, les montants et l'absence d'affectation.
   En cas d'erreur, le lot entier est annulé.
6. Le brut sort de la créance initiale ; le net entre en trésorerie. Les frais
   sont une charge transport ; les retenues restent une créance du compte COD.
7. Les frais/retenues sont répartis au prorata avec arrondi cumulatif : les
   sommes des affectations sont exactement égales au lot, sans arrondi perdu.
8. Une retenue peut être reçue en plusieurs opérations. L'allocation suit un
   ordre déterministe ; aucune facture du lot n'est déclarée payée tant que
   la retenue complète n'a pas été encaissée.

Exemple : 45 000 DA brut, 2 000 DA de frais, 1 000 DA retenus donnent 42 000 DA
de trésorerie et 1 000 DA encore dus, jamais 45 000 DA encaissés.
Un lot requiert un net strictement positif. Le fractionnement du brut d'une même
commande entre plusieurs reversements n'est pas pris en charge dans cette version.
Une correction d'un lot validé n'est pas proposée en UI : ne pas contourner
l'historique par un DELETE ou un ajustement non documenté.

L'unicité transporteur/référence, la PK de commande affectée et la clé UUID
d'opération empêchent les doublons, y compris entre administrateurs.
Un retry avec le même UUID et un contenu différent est rejeté.

## Dépenses, comptes et achats

Les comptes de type caisse, banque ou créance portent des noms configurés ;
aucun nom métier n'est codé dans les calculs. Un compte utilisé ne peut pas
changer de type. Les comptes inactifs sont exclus des nouvelles opérations.
Un ajustement de trésorerie exige un motif et conserve un mouvement/audit.

Une dépense est calculée et enregistrée avec ses mouvements cash/analytique
dans une transaction. Sa correction crée une contrepassation des anciens
mouvements et une nouvelle dépense ; l'ancienne reste visible comme contrepassée.
La suppression n'est pas permise. Le justificatif original reste conservé.
Catégories et fournisseurs ne sont pas préremplis arbitrairement.

Un achat contient des lignes de variantes, quantités et coûts. Le total est
calculé en SQL, les noms/SKU/coûts sont figés. Sans compte payé, il reste à payer ;
un paiement fournisseur complet est idempotent. L'achat ne touche aucun stock.
Son paiement est une sortie de trésorerie, pas une deuxième charge produit dans
la marge. Le coût produit est reconnu via le snapshot des produits vendus.

## Coûts, marges et rapports

Le coût connu au moment de la confirmation est figé. Une saisie future n'écrase
ni une ancienne marge ni un coût historique inconnu. Les achats ajoutent un coût
pour les prochaines confirmations ; ce n'est ni du FIFO ni du coût moyen pondéré.
Le tarif de zone au moment de la capture sert d'estimation de coût transport,
remplacée pour l'analyse par les frais réels affectés au reversement.
Les coûts manquants donnent une marge inconnue, jamais un coût zéro inventé.

- CA : ventes livrées TTC moins avoirs sur ventes déjà reconnues, distinct du cash.
- Marge brute : CA moins coût des produits et frais de transport.
- Résultat opérationnel : marge brute moins dépenses saisies, distinct du bénéfice légal.
- Avoir avant livraison : ne réduit pas un CA qui n'a pas encore été reconnu.
- Avoir après retour physique canonique `returned` : reprend le coût historique
  connu des produits, sans modifier le stock ; le flux commande reste son seul auteur.
- Un avoir sans retour physique ne reprend pas automatiquement le coût produit.

Dashboard et rapports utilisent des agrégations SQL, bornes calendaires
`Africa/Algiers`, DZD à deux décimales, pagination et index par date/compte/commande.
Le CA peut être ventilé par provenance, produit, catégorie principale snapshot,
wilaya et transporteur. La livraison est ventilée au prorata entre produits.
Le rapport commande expose le délai de reversement ; l'RPC fournit aussi sa moyenne.
CSV échappe les cellules et neutralise les formules ; export limité à 5 000 groupes.
Les référentiels du sélecteur sont limités à 200 entrées : prévoir une recherche
serveur avant de dépasser ce volume de variantes ou fournisseurs actifs.

## Permissions et sécurité

| Accès | Owner | Staff | Anonyme |
| --- | --- | --- | --- |
| Finance, coûts, marges, dépenses, trésorerie, rapports, paramètres | Oui | Non | Non |
| Brouillon/émission/PDF de commande | Oui | Oui | Non |
| Avoir, remboursement et reversement | Oui | Non | Non |
| PDF lié à un token de suivi valide | Oui | Oui | Capacité limitée à cette commande |

Les 20 tables ont RLS, grants minimaux et policies de lecture explicites.
Aucune mutation directe n'est accordée à authenticated/anon. Le staff ne reçoit
aucun coût dans les payloads facture ni dans la réponse de fiche commande.
L'archive PDF et les justificatifs sont privés. Les justificatifs owner sont
PNG/JPEG/WebP/PDF, 8 Mo maximum, sans écrasement ni suppression ; consultation
par URL signée 60 secondes. Le logo est une image PNG/JPEG privée versionnée.
Les secrets ne sont jamais journalisés ni transmis au navigateur.

Le module ne réutilise pas un service_role pour les opérations financières.
La seule clé serveur supplémentaire est `SUPABASE_SERVICE_ROLE_KEY`, nécessaire
au PDF privé côté backend ; jamais de préfixe VITE. Voir INVOICING.md.

## Mode dégradé, historique et rollback

Le trigger financier isole ses erreurs dans un sous-bloc transactionnel et
enregistre seulement le SQLSTATE dans `finance_failures`. La commande et son stock
continuent leur flux. La fiche commande et le dashboard signalent les échecs.
Réessayer la préparation recharge uniquement les données canoniques.

Les commandes antérieures à l'activation ne sont jamais importées implicitement.
La fiche présente les montants existants et demande une confirmation owner pour
un import individuel. Aucun import massif ni date/coût rétroactif n'est créé.

Pour arrêter les nouvelles captures, désactiver Finance et l'émission automatique
dans les paramètres. Les documents émis et historiques restent lisibles.
En incident applicatif, revenir au déploiement antérieur et désactiver d'abord
la capture en base avec un owner ; une simple restauration du code ne désactive
pas un trigger SQL. Ne supprimer aucune table, archive ou écriture.
Restaurer une sauvegarde seulement dans une procédure distincte explicitement
approuvée ; la migration inverse destructive n'est volontairement pas fournie.

## Dépendances et validation

Production : `@pdfme/generator@6.2.8`, `@pdfme/schemas@6.2.8` (MIT).
Développement : `@pdfme/pdf-lib@6.2.8` (MIT, inspection des PDF),
`@electric-sql/pglite@0.5.14` (Apache-2.0, PostgreSQL isolé).
Police documentaire locale dérivée de Noto Sans/Noto Naskh Arabic : SIL OFL 1.1,
source, renommage et licence dans `src/lib/finance/assets/`.
Aucune police ni donnée de facture n'est téléchargée d'un service externe à l'exécution.

Recette, commandes de test, limites vérifiées et checklist :
[FINANCE_VALIDATION.md](FINANCE_VALIDATION.md).
