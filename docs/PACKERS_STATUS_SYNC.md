# Synchronisation des statuts Packers

## État constaté et risque corrigé

Base analysée : `main` à `cf4838f`, après la PR #21 et le commit
`06e0f6a` qui ajoutait déjà une synchronisation admin. L'ancienne table de
correspondance n'avait ni référence officielle ni fixture réelle. Elle classait
notamment `retours_en_transit_stock` comme retour reçu. Le parseur acceptait aussi
une réponse unique avec un suivi différent. Ces comportements sont supprimés.

Le client appelle `GET api/v1/get/orders?tracking=…`, avec authentification serveur.
Son ancien type `Record<string, unknown>` ne décrit pas un contrat API vérifié.
Aucun échantillon réel n'est versionné. L'accès public à packers.ecotrack.dz a
renvoyé une page 403 depuis l'environnement de travail le 31 octobre 2026.
Aucun appel authentifié à une vraie commande n'a été effectué.

## Architecture et comportement

- Conserver l'actualisation automatique à l'ouverture de la section commandes et
  son bouton manuel. Pas de webhook supposé, cron Vercel ou service_role ajouté.
- Lot tournant de 10 commandes maximum, Packers uniquement, suivi non vide,
  statut `confirmed` ou `shipped`, les moins récemment observées en premier.
- Une requête par commande, intervalle 1,25 s et délai réseau maximal de 5 s.
  Une actualisation n'est pas une garantie de synchronisation de toute la file.
- Vérification admin existante par `getUser` puis `admin_users`, client utilisateur
  soumis aux RLS existantes. Les mutations restent réservées à owner/staff.
- Parsing isolé et testable : suivi exact obligatoire, une seule correspondance,
  statut texte non ambigu, refus des enveloppes d'échec. Les enveloppes candidates
  supportées ne constituent pas une documentation officielle de Packers.
- Correspondance exacte, sans normalisation ou traduction automatique. Par défaut,
  aucune valeur n'est autorisée à modifier un statut Elegancia.
- Une observation valide enregistre `carrier_status` et `carrier_status_updated_at`.
  Une erreur réseau, réponse ambiguë ou sans suivi ne modifie rien.
- Seule une commande `shipped` peut passer à delivered/refused/returned. Une commande
  confirmed conserve la validation explicite d'expédition existante.
- UPDATE conditionné par id, statut initial, carrier et tracking : une réponse lente
  ne remplace pas une modification concurrente. Seules les lignes réellement modifiées
  sont comptées. L'API n'écrit jamais directement dans le stock.
- L'admin affiche les observations et signale les échecs/statuts non validés sans
  empêcher l'affichage des commandes. Le toast distingue avertissement et succès.

Ce choix est compatible Hobby, sans infrastructure supplémentaire. Il dépend de
l'ouverture de l'admin ; il ne fonctionne pas en arrière-plan lorsque personne ne
l'utilise. Un job périodique nécessitera un contrat API validé, un budget d'appels
et une authentification dédiée avant activation.

## Validation indispensable avant activation des transitions

Sur le compte marchand Packers, obtenir une réponse anonymisée de getOrder pour
chaque état utile, sans publier token, téléphone, adresse ou nom client. Confirmer :

1. L'enveloppe, le champ de suivi exact, le champ de statut, son type et ses valeurs.
2. Quel statut signifie livraison réellement effectuée et non paiement ou archivage.
3. Quel statut signifie refus du client, et non simple tentative de livraison.
4. La distinction entre demande de retour, transport, entrepôt transporteur et retour
   physique reçu par la boutique. Ne configurer aucun retour si cette distinction
   ne peut être établie. `physicalReturnReceived` est une attestation de contrat
   validé par l'exploitant, pas une preuve déduite automatiquement du payload.
5. Les erreurs métier dans les réponses HTTP 200 et les éventuels champs de dates,
   pagination, limites et quotas. Le parseur actuel ignore volontairement les codes
   numériques et objets de statut tant que leur contrat n'est pas connu.

Ajouter ensuite des fixtures anonymisées et tests du vrai contrat. Configurer côté
serveur Vercel `PACKERS_VERIFIED_STATUS_RULES` comme tableau JSON de règles avec
`raw` (valeur exacte validée) et `target` (`delivered`, `refused`, `returned`).
Une règle returned exige `physicalReturnReceived: true`. Aucune valeur API réelle
n'est proposée ici. Une configuration invalide bloque toute la synchronisation.
La variable n'a jamais de préfixe VITE_. Redéployer après configuration.

Sans date transporteur validée, delivered_at/refused_at utilisent l'instant
local de première observation et préservent une date existante. Ne pas les
interpréter comme l'heure exacte d'un événement Packers.

## Stock, SQL et limites connues

Aucune migration créée : ni schéma, trigger, fonction SQL, privilège ou RLS modifié.
Les migrations existantes, dont l'expiration pending de 24 h, sont conservées.
Le trigger existant restitue le stock dès refused/cancelled/returned et ne le
restitue pas de nouveau lors de refused → returned ou d'un statut répété.
Cette politique de refus est préservée ; elle ne prouve pas un retour physique.
Un statut de retour ne peut être configuré que pour la réception physique vérifiée.
Les commandes refused ne sont ensuite plus interrogées, conformément au filtre actif.

Limite préexistante : réouvrir manuellement une commande négative puis la terminer
négativement peut restituer de nouveau le stock. La synchronisation ne réouvre
jamais une commande terminale. Un changement global de politique stock ou un suivi
physique des refus exigerait une migration métier distincte ; ne pas activer des
règles qui supposeraient ce comportement.

Tests : fixtures explicitement synthétiques, parsing, correspondance, erreurs réseau,
commandes inéligibles, concurrence et répétitions. Le script
`supabase/tests/packers-stock-regression.sql` vérifie le trigger réel et la protection
contre l'expiration confirmed sur base jetable avec catalogue existant. Il n'a pas
été exécuté ici : aucune base jetable accessible et socket Docker interdit.

## Contrôles locaux et comparaison avec main

Commandes exécutées sur la branche et dans un worktree séparé à `cf4838f` :

| Contrôle                | Branche                                            | Main de référence            |
| ----------------------- | -------------------------------------------------- | ---------------------------- |
| `npm run typecheck`     | Échec : 25 erreurs préexistantes                   | 25 erreurs                   |
| `npm run lint`          | Échec : 57 erreurs, 9 avertissements               | 77 erreurs, 9 avertissements |
| `npm test`              | 116 réussis, 3 échecs préexistants                 | 87 réussis, mêmes 3 échecs   |
| `npm run knip`          | Échec : 9 fichiers, 13 exports, 2 types inutilisés | Mêmes constats               |
| `npm run build`         | Réussi                                             | Non relancé sur main         |
| Lint fichiers concernés | Réussi                                             | Sans objet                   |
| Nouveaux tests Packers  | 29/29 réussis                                      | Absents                      |

Les erreurs TypeScript concernent notamment les types Supabase du catalogue, le
registre des routes, des variables inutilisées et le locale admin delivery. Les
échecs de tests existants sont deux attentes de l'ancien modèle tarifaire dans
`delivery.test.ts` et le contrôle des titres de pages dans `page-titles.test.ts`.
Ils ne sont ni masqués ni modifiés dans cette mission. Les fichiers de routes
régénérés par le build sont exclus du diff pour éviter un changement hors périmètre.
