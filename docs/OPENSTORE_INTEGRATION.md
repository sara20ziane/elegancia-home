# Intégration OpenStore dans Elegancia Home

## Audit comparatif (5 novembre 2026)

Références figées : Elegancia `cb9b7df0c0b69a63b5b4114f018fea9bc5b5c125`,
OpenStore main `64baddefbe3421431f78a9ef24bc9316d6f613e2`.
Documentation consultée dans les deux dépôts : FEATURES, GOOGLE_SHEETS, PROJECT,
ROADMAP, ARCHITECTURE, DATABASE ; le code prime sur leurs affirmations parfois anciennes.
Les deux dépôts sont sous AGPL-3.0-only ; conserver LICENSE, les attributions et
l'accès au code source du service modifié lors de sa mise à disposition.

| Fonction        | Code OpenStore et Elegancia déjà présent                                                      | Écart réel à intégrer / risque                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 Sheets       | `schema.sql` : targets, payload, enqueue ; `lib/order-export.ts`, `admin/export-settings.tsx` | Export limité aux statuts, sans reprise ni accusé ; création activée par défaut. Ajouter une file durable, traitement différé, suivi et reprises bornées, protocole Apps Script idempotent. |
| 02 Refus wilaya | `admin_analytics`, `lib/analytics.ts`, `admin/dashboard-widgets.tsx`                          | Retours comptés comme refus ; montants absents. Séparer les états, afficher le seuil de trois, conserver les faibles échantillons hors classement.                                          |
| 03 Téléphone    | `canonical_dz_phone`, `admin_phone_history`, `blocked_phones`, `admin/phone-guard.tsx`        | Historique incomplet et refus/retours confondus. Garder le blocage exclusivement manuel et la limite existante de trois pending/24 h.                                                       |
| 04 Packs        | `pack_items`, `admin/pack-builder.tsx`, fiche produit                                         | Composition informative uniquement : aucun débit des composants dans les deux dépôts. Réservation transactionnelle avec snapshot, restitution idempotente et disponibilité dérivée.         |
| 05 Dashboard    | `admin_analytics`, `admin.index.tsx`, widgets                                                 | Panier moyen calculé avec le mauvais dénominateur ; pas de distinction livré/encaissé, peu vendus absents. Garder Finance OFF et lire les reversements existants sans les modifier.         |
| 06 PWA          | manifest, icônes Elegancia, `public/sw.js`, registrar                                         | HTML catalogue mis en cache : disponibilités périmées possibles hors ligne. Remplacer par page hors connexion sans catalogue ; installation et mise à jour discrètes.                       |
| 07 Arabe        | `normalize_arabic`, `catalogue_page`, `lib/catalogue.ts`                                      | Translation SQL incorrecte de ة. Corriger sans toucher aux noms, SKU, filtres ou catégories multiples.                                                                                      |
| 08 Avis         | `reviews`, `validate_review`, `admin.reviews.tsx`, formulaire public                          | Modération présente ; pas de filtre produit ni détection de doublon. Garder validation/RLS et ajouter contrôles serveur.                                                                    |
| 09 Photos       | `lib/image.ts`, `image-frame.ts`, `admin/image-upload-preview.tsx`                            | Compression/WebP et recadrage optionnel déjà portés ; focus horizontal absent et libération bitmap à renforcer. Ne traiter que les nouveaux uploads.                                        |
| 10 Étiquettes   | `admin.slips.tsx`, `admin/shipping-label.tsx`, `orders-file.ts`                               | Impression présente, PDF téléchargeable absent et origine interne peu claire. Réutiliser pdfme et la police existante ; ne remplacer aucun bordereau Packers.                               |
| 11 Checklist    | `setup-status.ts`, `admin/setup-checklist.tsx`, checklist par produit                         | Ne montre que les manques de contact, pas les succès/catalogue/checkout/démos. Ajouter un diagnostic administratif agrégé et des liens précis.                                              |

## Contraintes de conservation

Aucun fichier de géographie, tarif Packers, secret ou configuration de production
ne doit être modifié. Aucun script de données, ancien schéma ou migration ne sera
exécuté sur un service réel. Les migrations nouvelles sont à relire et valider
avant application. Les tests emploient exclusivement des données synthétiques.

Les commandes de packs antérieures à cette intégration ne permettent pas de
prouver leur composition réservée : aucun composant ne sera débité rétroactivement.
Leur stock historique conserve son comportement ; les nouvelles lignes enregistrent
les composants exacts à restituer, même si le pack est ensuite modifié.

Le chiffre livré COD représente ce que la cliente a payé au transporteur. Il ne
prouve pas un reversement à la boutique. L'encaissé boutique n'est affichable que
depuis les opérations financières déjà enregistrées ; aucune activation Finance
ni estimation de bénéfice ne fait partie de cette intégration.

## Réalisation et fichiers principaux

Les onze fonctions sont intégrées ou complétées dans le code ; aucune n'est déclarée
active en production par ce document.

| Fonction | Réalisation                                                                                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01       | File durable `order_export_jobs`, worker `commerce_private.dispatch_exports`, activation owner explicite, erreurs expurgées, reprise manuelle, récepteur signé avec verrou et révision. Voir GOOGLE_SHEETS.md.                                                                |
| 02       | `admin_commerce_analytics` et `wilaya-insights.tsx` : effectifs, montants refusés, taux, livrés, retours/annulations séparés, seuil configurable, périodes et classement des échantillons admissibles.                                                                        |
| 03       | `admin_commerce_phone_history`, `phone-guard.tsx`, `phone-blocklist.tsx` : formes locales, +213, 213 et 00213 ; historique détaillé, alerte informative à deux refus, gestion manuelle de la liste. La limite pending existante est sérialisée par téléphone.                 |
| 04       | `commerce_pack_reservations.sql`, `pack-builder.tsx`, `queries.ts` : composants simples, quantités éditables, prix global/réduction sur les configurations existantes, disponibilité calculée dans la fiche et le catalogue. Stock du pack conservé comme plafond commercial. |
| 05       | `analytics.ts`, `admin.index.tsx`, widgets : panier confirmé corrigé, CA livré, encaissements distincts, meilleures/faibles ventes et stocks bas. Les périodes personnalisées couvrent au plus 366 jours.                                                                     |
| 06       | Manifest et icônes Elegancia existants conservés ; `sw.js`, `offline.html`, registrar et `install-app.tsx` : installation, indication iPhone, mise à jour explicite, cache statique exclusivement et catalogue masqué hors connexion.                                         |
| 07       | Normalisation SQL corrigée et diacritiques étendus ; tests du vrai `catalogue_page` sur arabe, français et SKU. Les catégories multiples Elegancia sont conservées.                                                                                                           |
| 08       | Modération existante conservée ; filtre produit, rejet de répétition identique sur 24 h, limite globale de 20 avis en attente/heure, validation produit/note, publication exclusivement après approbation.                                                                    |
| 09       | Compression existante et aperçu conservés ; cadrage horizontal et vertical, défaut sans découpe, libération des ressources en cas d'erreur, fichier illisible signalé. Aucun traitement d'anciennes images.                                                                   |
| 10       | `shipping-pdf.ts`, `shipping-response.ts`, `admin.slips.tsx` : PDF serveur avec police FR/AR existante, 100 × 150 mm exact ou quatre étiquettes réduites par A4 ; accès admin, réponses no-store, individuel ou commandes confirmées. Mention interne explicite.              |
| 11       | `admin_setup_audit`, `setup-audit.ts`, `setup-checklist.tsx` : succès et manques, produits/photos/prix, checkout, livraison et marqueurs de démonstration ; liens et actualisation automatique.                                                                               |

### Définitions vérifiables

- Valeur confirmée : `sum(total)` des commandes actuellement confirmed/shipped/delivered.
- Panier confirmé : valeur confirmée divisée par le nombre de ces mêmes commandes.
- CA livré COD : `sum(total)` des delivered, produits et livraison compris ; il ne
  prouve pas le reversement à Elegancia.
- Taux de refus : nombre des refused / toutes les commandes créées dans la période.
  Les returned et cancelled sont comptés dans des colonnes distinctes.
- Montant refusé : `sum(total)` des refused. Un échantillon sous le seuil reste
  visible avec une mention d'insuffisance, sans rang ni alerte de wilaya à surveiller.
- Encaissements boutique : mouvements cash cod_settlement/withholding_receipt entrants,
  moins remboursements sortants, à leur date d'encaissement. Valeur indisponible si
  Finance est OFF ou pour staff. Ce montant est net de frais, jamais un bénéfice.
- Les statistiques commerciales et séries quotidiennes suivent la date de création
  en `Africa/Algiers`, indépendamment de la date du reversement.

## Migrations à valider, non appliquées

1. `20261105083853_commerce_pack_reservations.sql` : snapshots des composants,
   réservation/restitution, protection des lignes et composants réservés.
2. `20261105083854_commerce_insights.sql` : RPC administratives de statistiques et téléphone.
3. `20261105083855_commerce_exports.sql` : file protégée, déclencheurs et reprise owner.
4. `20261105083856_commerce_export_dispatch.sql` : worker asynchrone et job cron.
5. `20261105083857_commerce_review_setup_search.sql` : recherche, normalisation téléphone,
   anti-doublon avis, verrou pending, checklist. Reconstruit l'index téléphonique existant.
6. `20261105083858_commerce_catalogue_stock.sql` : disponibilités des packs dans le
   catalogue, en conservant toutes les extensions literie et catégories multiples.

Les fichiers ont été créés avec Supabase CLI 2.79.0 ; les timestamps simultanés ont
été rendus distincts avant versionnement. Aucun bootstrap ni ancien fichier n'est
rejoué sur la base existante. Pas de suppression ou transformation de données.

## Limites et opérations avant déploiement

- Valider les migrations et leur ordre sur une copie isolée récente, disposer d'une
  sauvegarde restaurable et examiner le verrou bref de reconstruction de l'index.
  Les tests de concurrence emploient PostgreSQL natif ; pg_net et Auth ont des
  adaptateurs explicites, et aucune infrastructure de production n'est contactée.
- Les transactions de stock partagent un verrou court pour éviter les courses entre
  lignes et packs. Mesurer la contention avant un volume très supérieur à celui d'une
  boutique. Le plafond pack et chaque composant doivent disposer de stock.
- Les lignes réservées ne se réécrivent pas directement : annuler et recréer pour
  changer les articles. Les coordonnées, statuts et suivi restent modifiables selon
  les droits existants. Une réactivation d'un état négatif exige de réserver à nouveau.
- Les packs historiques ne font l'objet d'aucun débit rétroactif. Vérifier manuellement
  le contenu des commandes antérieures encore ouvertes avant leur préparation.
- Garder Finance Production OFF. Les coûts des packs et les reversements suivent les
  modules financiers existants ; aucune marge n'est estimée depuis les seuls statuts.
- Configurer et tester Google Apps Script sur une feuille privée de recette ; mettre
  à jour les anciens récepteurs avant activation de la nouvelle file. Quotas et réelle
  livraison Google ne sont pas vérifiés par les tests locaux.
- PDF : lots de 200 maximum pour borner la charge serveur. Les lots imprimables HTML
  restent disponibles. Quatre étiquettes 100 × 150 mm ne tiennent pas sur un A4 : le
  mode A4 emploie des étiquettes adaptées. Garder le bordereau officiel du transporteur.
- HEIC non décodable : convertir vers JPEG/PNG/WebP/AVIF avant upload. GIF est aplati.
  Le recadrage est facultatif ; l'image entière est le défaut pour la literie.
- PWA : HTTPS et navigateur compatible requis ; instruction manuelle sur iPhone.
  Aucun catalogue hors connexion ; les mises à jour attendent l'action de la personne.
- La checklist détecte les marqueurs de démonstration connus, pas la véracité de chaque
  donnée légale ni de chaque photographie. Relire le contenu commercial avant lancement.
- Préserver LICENSE, l'attribution OpenStore et le lien de code source ajouté au footer
  pour l'offre du code correspondant sous AGPL. Aucun secret ni donnée cliente dans ce dépôt.

Le déploiement, la fusion et l'application des migrations restent soumis à validation
de la propriétaire. La PR ne lance aucune de ces opérations manuellement.

## Vérification finale du 5 novembre 2026

| Contrôle                                                        | Résultat                                                                                                                                                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript, ESLint, Knip, build de production (`npm run check`) | Réussis                                                                                                                                                                                                   |
| Vitest, ensemble du dépôt                                       | 328 tests réussis, 58 fichiers ; aucun échec restant                                                                                                                                                      |
| `npm run test:db`                                               | 45 tests réussis, huit fichiers ; inclus dans les 328                                                                                                                                                     |
| PostgreSQL 17 natif, conteneur jetable sans réseau              | Toutes les migrations et régressions passées ; courses stock/téléphone, numérotation, factures, reversements et configurations commerciales vérifiées                                                     |
| HMAC                                                            | Vecteur connu pgcrypto natif et vrai HMAC Node pour le récepteur Apps Script ; pg_net remplacé par un transport de test, aucun envoi externe                                                              |
| Playwright sur le build compilé (`E2E_BUILT=true`)              | 16 tests réussis, desktop et mobile 360 px                                                                                                                                                                |
| Responsive étiquettes/admin                                     | 320, 360, 390, 414, 768, 1024, 1280 px après stabilisation des transitions de navigation                                                                                                                  |
| PDF                                                             | Vrais PDF 100 × 150 mm et A4, pagination 4/page, accents et arabe ; téléchargement administratif et refus anonyme testés ; aperçu thermique inspecté                                                      |
| Frontière publique                                              | RLS/GRANT/RPC administratives, avis non auto-publiés, refus des lectures privées, no-store PDF, cache PWA et absence de marqueurs service_role dans le build vérifiés                                     |
| Conservation                                                    | Comparaison avant/après migrations d'une commande et d'un pack historiques, stocks, prix, lignes, paramètres, tarifs et Finance OFF ; fichiers wilayas/communes/Packers/Finance/schema/lockfile inchangés |

Les premiers essais ont permis de corriger les fixtures de détection de doublons
et la synchronisation des tests navigateur avec l'hydratation et les transitions
CSS. Aucun test n'a été désactivé. Les avertissements de taille de bundle et de
directives tiers émis par Vite ne bloquent pas le build ; l'optimisation générale
du bundle n'est pas incluse. La notification Telegram échoue volontairement dans
le banc isolé sans token ; la commande est bien enregistrée.

Non exécutés : application des migrations hébergées, livraison réelle Google,
tests avec compte/commande réels, impression sur une imprimante physique et
installation sur un iPhone physique. Ces étapes relèvent de la recette autorisée
avant activation, pas d'un succès de production annoncé par cette PR.
