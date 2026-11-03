# Catalogue Elegancia : création rapide et édition manuelle

## Audit et réutilisation

Sur le `main` audité (`8099e42`), `/admin/products` créait seulement un nom et un
brouillon. `/admin/product/$id` sauvegardait les informations et catégories,
puis `ProductConfigurations` affichait `VariantEditor`. `DraftFields` et
`VariantSecondaryFields` étaient déjà les formulaires des configurations.
Ils restent utilisés dans l’éditeur et dans l’aperçu, avec les champs facultatifs
repliés. La duplication **d’une configuration** reste disponible ; aucune
duplication de modèle n’est ajoutée.

Les couleurs utilisent déjà `cloneVariantsForColour` : première couleur sur les
configurations existantes, suivantes par copie d’une matrice commerciale. Les
photos sont déjà téléversées une fois puis reliées à toutes les tailles de la
couleur par `variant_images`. Cette logique est conservée, y compris les uploads
multiples d’une couleur existante. Les SKU vides de ces nouvelles variantes sont
désormais générés par le même mécanisme SQL que les autres créations. L’ALT
existant était déjà prioritaire dans `productImageAlt` ; un trigger remplit
maintenant les nouveaux ALT absents sans remplacer les textes manuels.

`products.category_id` est le miroir historique de la première catégorie ;
`product_categories` reste la classification multiple. `product_variants` porte
le prix et le stock de chaque configuration. La colonne `sku` est du texte ;
l’interface existante limitait la saisie à 40 caractères, limite conservée.

Finance référence les variantes par ID (`variant_costs`, achats, commandes) et
conserve des instantanés de factures/coûts. Les variantes existantes sont
modifiées par `UPDATE ... WHERE id`, jamais supprimées puis recréées. Aucun code
Finance, paramètre d’activation, facture, commande ou coût historique n’est
modifié par cette fonctionnalité. Aucun coût n’est créé lors d’une génération.

## Parcours après changement

1. **Nouveau modèle → Mode rapide** : noms arabe et français, catégories,
   descriptions facultatives. Le slug vient du nom français, sinon du nom arabe.
2. **Valeurs communes et tailles** : tissu, origine, type, pièces, prix et stock
   saisis une fois. Queen et King présélectionnés ; 90 × 190 et taille personnalisée
   disponibles. Composition, dimensions, prix barré, poids et SKU sous accordéon.
3. **Afficher l’aperçu** : une carte par taille, prix, stock, SKU et dimensions.
   « Prix différents selon la taille » expose les prix et prix barrés individuels ;
   « Stock par configuration » expose les stocks individuels. L’accordéon de chaque
   carte permet de tout modifier, notamment un SKU. Changer les valeurs communes
   ne réécrit jamais un aperçu déjà modifié ; sa régénération demande confirmation.
4. **Créer les configurations** enregistre le brouillon, les catégories et les
   variantes dans une seule transaction. Une requête rejouée ne crée pas de doublon.
   Aucune publication automatique.
5. Dans un modèle existant : ajout de tailles via Mode rapide ; modification
   individuelle sous Réglages avancés ; valeurs communes avec aperçu et
   confirmation obligatoire avant remplacement. Le statut existant est conservé.
6. **Avant publication** affiche nom, catégorie, configuration active, prix, SKU,
   dimensions, stock, photos. Nom/configuration/prix/stock invalides bloquent les
   boutons de publication ; catégories, dimensions, SKU anciens et photos sont
   des avertissements. Le serveur refuse aussi la publication d’un modèle sans
   configuration active avec prix positif.

## Règles et valeurs volontairement manuelles

- Dimensions confirmées, centralisées dans `src/lib/bedding-presets.ts` : Queen
  drap-housse 160 × 190, housse 220 × 240 ; King 180 × 200 et 260 × 240 ;
  90 × 190 : drap-housse seulement. Les housses ne sont proposées que pour le type
  `Parure housse de couette`.
- Le dépôt ne fournit pas de règle métier fiable pour les compositions, taies,
  draps plats ou poids de Serena/Aveline. Les fixtures synthétiques ne sont pas
  considérées comme des standards commerciaux. Aucune donnée de production n’a
  été consultée ou normalisée. Ces champs restent manuels tant qu’un preset
  explicite n’a pas été renseigné.
- Les presets personnels sont persistants, éditables par les administrateurs,
  indexés par taille et type de parure. Une composition ne s’applique que si le
  nombre de pièces correspond exactement au preset. Les modifications de preset
  ne mettent jamais à jour le catalogue existant. « Recalculer depuis le preset »
  présente les différences et demande une application explicite.
- Un changement de taille ne remplace pas une dimension déjà renseignée. Pour
  une configuration dupliquée, utiliser le recalcul explicite afin de vérifier
  les dimensions de la nouvelle taille. Les champs manuels sont prioritaires.
- SKU : `ELG-MODELE-TYPE-TAILLE-COULEUR`, uppercase ASCII sans espaces ni accents,
  au plus 40 caractères. Modèle limité à 14, type HC/DR (sinon 5), taille QN/KG
  (sinon 8), couleur 6 (UNI si absente). Base limitée à 36 ; collisions : `-02`,
  `-03`, etc. Aperçu TypeScript pur ; réservation unique en base pour arbitrer
  aussi les créations simultanées. Un SKU manuel en double est refusé, pas réécrit.
  Les anciens SKU restent inchangés, même s’ils sont anciens ou dupliqués.

## Migration et déploiement

`20261103130000_catalog_automation.sql` est additive : schéma privé de réservation
SKU/requêtes, table RLS des presets, RPC admin de génération, presets et mise à
jour commune, triggers ciblés SKU/ALT/publication. Aucune colonne supprimée et
aucune réécriture des produits existants. Les anciennes valeurs de SKU sont
recensées dans le registre de réservation sans modification des variantes.

Les RPC contrôlent owner/staff, fixent `search_path`, retirent les droits PUBLIC
et anon ; le registre privé n’est pas accessible directement. Les opérations en
masse ont une liste fermée de champs et ne peuvent ni modifier les IDs, ni le
stock, ni les commandes/coûts.

Appliquer la migration sur une base de développement, puis lors d’un déploiement
revu **avant** le frontend correspondant. Aucune migration de production n’a été
exécutée par cette tâche. Les uploads restent ceux du projet : le stockage de
fichiers et leur association SQL ne forment pas une transaction distribuée.

## Vérification

- Tests purs : normalisation et collision SKU, dimensions confirmées, Queen/King,
  valeurs manuelles conservées, composition conditionnelle et validation numérique.
- PostgreSQL WASM : brouillon/idempotence, rollback d’une génération partielle,
  coûts Finance/IDs conservés avec Finance ON, ALT, SKU manuel, droits des RPC,
  presets et publication, anciens doublons de SKU.
- Playwright isolé, desktop et 360 px RTL : création, dimensions, SKU différents,
  modification manuelle d’un SKU/tissu, aperçu préservé, brouillon persistant et
  mise à jour commune avec annulation/confirmation et conservation des IDs.
- Les contrôles Finance, sécurité et boutique préexistants restent exécutés.
  L’adaptateur E2E exécute les vrais RPC PostgreSQL mais son Auth est synthétique :
  il ne valide pas les services Supabase Auth/Storage/Realtime en conditions réelles.
