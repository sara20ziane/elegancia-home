# Elegancia Home — règles de développement

Elegancia Home est une boutique algérienne indépendante. Ne travailler que dans
`sara20ziane/elegancia-home`. Les anciennes références OpenStore dans la documentation
ne remplacent pas les règles de ce fichier ni les instructions de la propriétaire.

## Stack et workflow

- React 19, TanStack Start, TypeScript strict, Tailwind CSS v4, Supabase/PostgreSQL, Vercel.
- Jamais Firebase. Ne pas utiliser `any` comme raccourci.
- Inspecter le code, les migrations, les types, les triggers et les RLS avant modification.
- Partir du dernier `main`, créer une branche dédiée, vérifier, committer et ouvrir une PR.
- Ne jamais modifier directement `main`, fusionner une PR ou activer sa fusion automatique.
- PR : problème, solution, fichiers, migrations, impact métier, risques et tests.
- Préserver les comportements existants. Pas de fonctionnalité ou dépendance hors mission.
- ESLint : 250 lignes par fichier source, 120 par fonction ; séparer les responsabilités.

## Supabase et sécurité

- Toute modification SQL doit avoir une migration dans `supabase/migrations/`.
- Lire `supabase/schema.sql` ET les migrations : le schéma historique seul est incomplet.
- Ne jamais modifier seulement la production. Préférer les tests sur une base jetable.
- Préserver les contrôles admin owner/staff et les RLS. Vérifier les GRANT en plus des policies.
- Examiner `SECURITY DEFINER`, fixer `search_path`, révoquer les exécutions sensibles de PUBLIC/anon.
- Aucun secret, token transporteur ou service_role dans le frontend, les logs ou ce fichier.
- Ne jamais committer de fichier `.env`.

## Packers et livraison

- Packers / EcoTrack est l'unique source tarifaire ; origine Alger (16).
- Aucun tarif inventé, forfait de secours ou `delivery_fee_flat`. Tarif absent : checkout bloqué.
- Commune obligatoire. Stop Desk désactivé si absent pour la commune choisie.
- Afficher uniquement les informations réellement retournées, sans inventer nom ou adresse.
- Ne jamais supposer le sens d'un statut EcoTrack. Parser `unknown`, vérifier le suivi exact,
  isoler la correspondance dans une fonction testable, préserver l'état si inconnu ou ambigu.
- `PACKERS_VERIFIED_STATUS_RULES` reste vide sans validation sur réponse réelle/documentation
  officielle. Voir `docs/PACKERS_STATUS_SYNC.md`. Les fixtures de tests ne sont pas des codes API.
- Synchroniser seulement les commandes Packers avec suivi et statut actif ; erreurs API isolées.
- Un retour en transit n'est pas un retour physique reçu et ne doit pas déclencher de restock.

## Offre commerciale

- 2+ parures : Stop Desk offert ; 3+ : domicile et Stop Desk offerts.
- Seuls `set_type = 'Parure de drap'` ou `'Parure housse de couette'` comptent.
- Packers reste le tarif de référence ; Elegancia prend les frais à sa charge.
- Toujours recalculer côté serveur/base, jamais seulement dans l'interface.

## Produits, variantes et stock

- Aveline, Velina, Sunny sont des produits ; Queen/King sont des variantes.
- Même configuration : même prix Queen/King ; stocks distincts possibles.
- Queen : drap-housse 160 × 190, housse de couette 220 × 240 cm.
- King : drap-housse 180 × 200, housse de couette 260 × 240 cm.
- Préserver le workflow : configuration existante → Dupliquer → taille/stock → Enregistrer la copie.
- Stock réservé à la création. Préserver l'expiration pending après 24 h et la restitution unique
  de `20261030235258_launch_safety.sql`. Ne jamais expirer une commande confirmée.
- Vérifier annulation, refus, retour et répétitions : aucune double restitution.

## Vérification obligatoire

Exécuter et rapporter honnêtement :

```bash
npm run typecheck
npm run lint
npm test
npm run knip
npm run build
```

`npm run check` regroupe ces contrôles. Corriger les erreurs liées au changement ; ne pas
masquer les échecs préexistants. Ajouter des tests pertinents pour les transitions, réponses
inconnues, absence de suivi, autre transporteur, erreurs réseau et idempotence. Tester les
triggers SQL sur une base jetable quand disponible ; signaler toute vérification non exécutée.
