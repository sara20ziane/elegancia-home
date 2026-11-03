# Catalogue Elegancia : création rapide, provenance et intégrité

## Parcours

`/admin/products` propose Mode rapide et Réglages avancés. Le mode rapide demande
les noms, catégories et descriptions facultatives, puis une saisie commune du
tissu, de l’origine, du type, des pièces, du prix et du stock. Queen/King sont
présélectionnés ; 90 × 190 et Autre sont disponibles. Les cartes d’aperçu restent
éditables individuellement. Prix/prix barrés et stocks par taille sont facultatifs.

« Créer les configurations » enregistre le modèle, ses catégories et ses variantes
en une transaction idempotente. Un nouveau modèle reste en brouillon. Un modèle
existant conserve son statut et les IDs de ses variantes. L’ajout de nouvelles
tailles ne supprime aucune variante. Réglages avancés conserve l’édition et la
copie d’une configuration ; aucune duplication de modèle n’est ajoutée.

Le gestionnaire de couleurs et de photos existant est conservé : upload une fois,
association aux tailles de la même couleur, clonage commercial pour une nouvelle
couleur. Une nouvelle taille peut récupérer les photos déjà présentes pour sa
couleur. L’ALT est généré uniquement s’il manque. Le stockage des fichiers et les
associations SQL conservent leur limite existante de transaction distribuée.

Les mises à jour communes ont un aperçu et une confirmation. La checklist avant
publication contrôle nom, catégorie, configuration active, prix, SKU, dimensions,
stock et photos. Les éléments facultatifs sont des avertissements ; aucune
configuration active avec prix valide bloque la publication côté serveur aussi.

## Presets initiaux confirmés Serena / Aveline

Les huit presets initiaux sont les combinaisons Queen/King × ces quatre règles :

| Type / pièces | Composition | Drap plat | Drap-housse | Housse de couette |
| --- | --- | --- | --- | --- |
| Parure de drap / 3 | 1 drap plat + 2 taies d’oreiller | 250 × 240 cm | Non applicable | Non applicable |
| Parure de drap / 6 | 1 drap plat + 1 drap-housse + 4 taies d’oreiller | 250 × 240 cm | Queen 160 × 190 ; King 180 × 200 cm | Non applicable |
| Parure housse de couette / 3 | 1 housse de couette + 2 taies d’oreiller | Non applicable | Non applicable | Queen 220 × 240 ; King 260 × 240 cm |
| Parure housse de couette / 6 | 1 housse de couette + 1 drap-housse + 4 taies d’oreiller | Non applicable | Queen 160 × 190 ; King 180 × 200 cm | Queen 220 × 240 ; King 260 × 240 cm |

`src/lib/bedding-presets.initial.json` et la migration contiennent ces mêmes données ;
un test PostgreSQL vérifie leur égalité exacte. Le texte « drap-housse » est
canonique dans les nouveaux presets ; aucun texte historique n’est normalisé.
Aucune dimension de taie n’est inventée. Pour 90 × 190, le drap-housse est connu
uniquement si la parure en comporte un ; une housse de couette inconnue reste
inconnue. Une taille Autre n’hérite pas des mesures Queen ou King.

La clé persistante d’un preset est `size + set_type + piece_count`, normalisée.
Les standards 3 et 6 pièces coexistent. Un preset enregistré prend priorité,
y compris lorsqu’il précise explicitement une valeur inconnue ou non applicable.

Prix, prix barré, stock, poids, tissu et origine restent des saisies manuelles.
Ces champs ne sont pas admis comme règles dans les presets. Le recalcul depuis
un preset ne propose que composition et dimensions.

## Provenance explicite et trois états

Chaque champ de composition/dimension d’un preset porte un objet distinct :

- `{ "state": "known", "value": "160 × 190 cm" }` : valeur connue ;
- `{ "state": "unknown" }` : règle inconnue, saisie possible ;
- `{ "state": "not_applicable" }` : pièce absente, aucun fallback.

Les champs de variante conservent leurs colonnes texte existantes. La nouvelle
colonne catalogue nullable `bedding_provenance` conserve la source et l’état de
chacun des quatre champs : `preset`, `manual` ou `legacy`. Les deux états sans
texte sont donc distingués par la métadonnée, pas confondus en chaîne vide.

Une saisie directe passe explicitement le champ en manuel, même si le texte
final égale l’ancien preset ou a été vidé. Une valeur non vide n’est jamais
utilisée pour inférer cette provenance. Les anciennes variantes sans métadonnée
sont identifiées comme provenance inconnue (`legacy`) et préservées.

Changer taille, type ou pièces actualise tous les champs encore automatiques :
une ancienne valeur connue est remplacée, une ancienne valeur devenue inconnue
ou non applicable est vidée. Les champs manuels restent inchangés. La règle est
appliquée dans les fonctions pures TypeScript, dans les formulaires et dans un
trigger catalogue pour les changements de contexte sauvegardés, y compris bulk.
Les actualisations React fusionnent valeurs et provenance champ par champ pour
préserver les éditions locales non enregistrées.

« Recalculer depuis le preset » reste une action explicite avec différences avant
application ; elle peut remettre un champ manuel ou historique sous contrôle du
preset. Modifier un preset ne lance aucune mise à jour massive des variantes.

## Identité commerciale et SKU

L’identité commerciale normalisée est : taille, type de parure, nombre de pièces,
couleur, tissu, origine du tissu. Le libellé de couleur est utilisé lorsqu’il
existe, sinon le code couleur ; le code décoratif d’une couleur nommée ne crée
pas une deuxième identité. Espaces répétés, casse, null et nombre de pièces sont
normalisés. SKU, prix, stock, poids, composition et dimensions dérivées sont exclus.

L’aperçu signale les doublons du lot ou déjà présents et désactive la création.
PostgreSQL vérifie aussi chaque ligne dans `catalog_generate`, sous verrou du
produit. Un doublon annule le lot entier avec un conflit commercial explicite,
avant l’allocation du SKU. Le même garde protège l’éditeur avancé et les clones
par couleur. Les doublons historiques ne sont ni supprimés ni recréés ; leurs
modifications sans changement d’identité restent possibles.

Le SKU conserve son format `ELG-MODELE-TYPE-TAILLE-COULEUR`, ASCII uppercase, au
plus 40 caractères. HC/DR et QN/KG sont les abréviations connues ; UNI remplace la
couleur absente. Les accents sont supprimés, les segments tronqués sans double
tiret. Une collision de SKU entre configurations réellement distinctes peut être
suffixée `-02`, `-03`, etc. Une collision commerciale ne peut jamais l’être.
Un SKU manuel reste prioritaire ; sa régénération est une action explicite.

## Migrations, Finance et vérification

Les migrations catalogue `20261103133330` et `20261103133444` sont additives :
RPC admin, presets sous RLS, registre privé de SKU/requêtes, provenance catalogue
et gardes SKU/ALT/publication/identité commerciale. Les fonctions sensibles
exigent owner/staff, fixent `search_path`, et ne sont pas exécutables par
PUBLIC/anon. Aucun backfill de variantes. Elles ont été appliquées à Production
avant la fusion du frontend correspondant, après validation complète de la CI.

Aucun schéma ou comportement Finance n’est modifié. Les variantes existantes
sont mises à jour par ID, les nouveaux coûts ne sont jamais créés automatiquement.
Le test `catalog-finance-preservation.sql` construit des coûts, commandes,
factures émises et mouvements réels dans une base jetable, puis compare leur
contenu intégral avant/après génération, bulk, changement SKU et conflit commercial.

Tests : les quatre règles initiales sur Queen et King, transitions auto/manuelles,
Autre, coexistence 3/6, trois états, parité TypeScript/SQL, absence de backfill,
priorité manuelle, préservation Finance, refus atomique des doublons et garde des
écritures avancées. PostgreSQL natif lance 16 requêtes identiques indépendantes :
une création et 15 conflits commerciaux attendus ; 16 couleurs distinctes sont
aussi créées avec des SKU uniques. Les régressions Finance préexistantes restent
exécutées. Playwright couvre desktop et 360 px RTL avec les vrais RPC PostgreSQL
et une session Auth synthétique. Auth/Storage/Realtime Supabase réels ne sont pas
émulés par cet adaptateur de test.
