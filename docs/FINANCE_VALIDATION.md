# Validation et activation Finance

## Procédure locale

Depuis la racine avec les dépendances verrouillées :

```bash
npm ci
npm run typecheck
npx eslint src/components/finance src/components/orders/invoice-download.tsx src/lib/finance src/lib/locales/*.finance.ts scripts/testing/native-*.ts
npx vitest run src/lib/finance
npm test
npm run lint
npm run knip
npm run build
```

La quality gate officielle est `npm run check`. Elle s'arrête au premier échec ;
les cinq contrôles sont aussi lancés séparément pour ne pas cacher les suivants.
Ne supprimer aucun test existant et ne désactiver aucune règle pour cette branche.

`database.test.ts` applique toutes les migrations dans PostgreSQL WASM jetable,
avec stubs auth/storage/cron/net explicitement locaux. `native-finance.sql` couvre
calculs canoniques, retry/double émission/livraison/paiement, snapshots, coûts,
lots et retenues, dépenses corrigées, achats, avoirs, remboursements, rôles,
suppression interdite, token et timezone. Les fixtures sont toujours annulées.
Le scénario existant `packers-stock-regression.sql` est aussi exécuté.

Pour les vrais verrous entre sessions PostgreSQL distinctes (Docker local) :

```bash
bash scripts/testing/native-postgres.sh
```

Ce script crée un conteneur PostgreSQL 17 isolé, sans port publié et sans réseau,
applique les migrations avec services Supabase simulés, exécute la régression SQL,
puis 40 allocations concurrentes et 16 émissions/16 reversements simultanés.
Le conteneur et les données de test sont supprimés automatiquement.
`supabase/tests/native-bootstrap.sql` n'est PAS une migration : ne jamais
l'appliquer à un projet Supabase existant.

Les tests PDF génèrent réellement un A4 avec accents/arabe et un document de
65 lignes. Les tests de téléchargement utilisent des mocks pour vérifier droits,
token incorrect, octets identiques, SHA-256, panne Storage et absence de clé.
Les tests serveur refusent les montants/statuts/numéros navigateur et vérifient
l'authentification, le rôle et l'absence de retry automatique des écritures.

Ces tests ne simulent pas complètement PostgREST, Auth, Storage et les extensions
Supabase. Une recette sur un projet Supabase de staging reste obligatoire.

## Résultats de branche

Voir la description de PR pour les résultats exacts du dernier commit et le lien
Preview. La base de comparaison est main `8657838` : typecheck et 226 tests passent ;
lint échoue déjà avec 71 erreurs/10 avertissements, Knip avec 9 fichiers,
16 exports et 2 types inutilisés. La branche doit corriger toute nouvelle erreur
sans attribuer la dette préexistante au module Finance.

Contrôles exécutés sur la branche :

| Contrôle | main audité | Branche native |
| --- | --- | --- |
| Typecheck | Passe | Passe |
| Tests Vitest | 226 passent | 250 passent, dont 24 nouveaux |
| Lint global | 71 erreurs, 10 avertissements | Même dette, aucun nouveau diagnostic |
| Lint des fichiers Finance | Sans objet | Passe |
| Knip | 9 fichiers, 16 exports, 2 types | 8 fichiers, 14 exports, 2 types, tous préexistants |
| Build Vercel local | Passe | Passe, PDF et police uniquement serveur |
| PostgreSQL multi-session | Sans objet | Régression SQL, 40 numéros et 16/16 actions concurrentes passent |

`npm run check` reste en échec au lint préexistant. Les tests, Knip et le build
ont été exécutés séparément. Aucun résultat de recette Production n'est revendiqué.

La vérification visuelle locale utilise les vrais composants et styles avec des
données synthétiques isolées : 360 px FR clair, 768 px FR sombre, 1280 px AR sombre,
aucun débordement horizontal ni erreur JS, saisie de dépense et garde owner/staff.
Ce contrôle ne valide pas un encaissement réel ni un compte Supabase distant.

## Checklist avant fusion et avant activation

- [ ] Revue du diff avec main, aucune reprise de branche #37, aucun système externe.
- [ ] Résoudre ou accepter explicitement la dette lint/Knip de main ; ne pas présenter
  `npm run check` comme vert tant qu'il échoue.
- [ ] Créer/configurer un environnement de staging Supabase distinct de Production.
- [ ] Sauvegarder la base cible et Storage ; appliquer d'abord les 21 migrations
  main, puis les quatre migrations natives dans l'ordre.
- [ ] Ne jamais appliquer le bootstrap de tests à staging/Production.
- [ ] Régénérer/contrôler les types depuis le schéma de staging si nécessaire ;
  les RPC Finance utilisent des payloads JSON validés en SQL.
- [ ] Vérifier owner/staff/anon avec de vrais JWT, grants, RLS, PostgREST et Storage.
- [ ] Déclarer la clé serveur d'archive dans Vercel Preview uniquement avec les
  identifiants du staging ; aucun secret client ni changement Production.
- [ ] Vérifier une commande web et une commande manuelle/sociale, confirmation,
  Packers, annulation, retour physique et restitution unique du stock.
- [ ] Sur fixtures de staging, vérifier doubles clics/deux admins et erreurs réseau,
  montant/transporteur incohérent, lot, frais, retenues partielles et rapprochement.
- [ ] Tester PDF réel, logo, français/arabe, document long, bon/mauvais token,
  téléchargement identique après redéploiement et restauration d'une archive.
- [ ] Configurer comptes réels, catégories nécessaires, identité légale et coûts.
  Ne pas compléter les anciennes marges par des coûts actuels.
- [ ] Faire valider par le comptable les mentions, TVA incluse et règle d'émission.
- [ ] Vérifier DZD, bornes Africa/Algiers, filtres, export et performances sur volumes.
- [ ] Refaire la recette mobile/tablette/desktop sur la Preview reliée au staging.
- [ ] Relire l'import historique individuel ; aucun backfill automatique.
- [ ] Obtenir une instruction explicite avant migration Production et activation.
- [ ] Après autorisation seulement : migrations, clé serveur, comptes/paramètres,
  activation owner, émission automatique conservée désactivée tant que non validée.
- [ ] Contrôler la première commande et la première facture réelles avec le dirigeant.

## Limites à connaître

Gestion opérationnelle TTC, pas comptabilité légale en partie double ni bilan.
Avoir/remboursement intégral seulement ; paiement fournisseur complet seulement.
Pas de correction d'un reversement confirmé, transfert entre comptes ou commande
payée hors COD automatisé ; ne pas improviser une correction destructive.
Coût de dernière saisie à la confirmation, pas valorisation FIFO/CUMP.
Facturation PDF automatique archivée au premier téléchargement ; pas de tâche
asynchrone ni email ajouté. UI AR/EN reprend le français pour certaines notices
spécialisées ; le modèle PDF est français en priorité.

Rollback : désactiver capture/auto-émission avec un owner, conserver les tables,
mouvements et archives, puis restaurer le déploiement applicatif précédent.
Un retour arrière de code seul n'arrête pas les triggers en base.
