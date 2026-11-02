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
