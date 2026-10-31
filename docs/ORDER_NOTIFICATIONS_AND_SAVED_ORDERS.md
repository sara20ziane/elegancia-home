# Notifications admin et commandes sauvegardées

## Architecture

Base : `main` à `720a08d`. Aucune dépendance ajoutée.

L'admin authentifié monte un seul composant `OrderNotifications` dans le shell,
commun à toutes les routes admin. `subscribeToAdminOrders` isole le transport
Supabase de la notification : son événement ne contient que l'id et la référence,
jamais le nom, le téléphone ou l'adresse. Un futur service externe devra écouter
les créations côté serveur ; aucun service externe n'est intégré ici.

Le checkout continue d'appeler `place_order`. `useCheckoutOrder` conserve uniquement
en mémoire le public_token et sa date après création et vide le panier. Il n'appelle
pas le stockage local. Sur la confirmation, la cliente peut choisir « Enregistrer
cette commande sur cet appareil », avec l'avertissement « Évite cette option sur un
appareil partagé. » Ces textes sont traduits en FR/AR/EN. Le token donne accès aux
informations retournées par `track_order` : sa persistance exige donc ce clic explicite.

Après le clic, seuls le public_token et sa date sont enregistrés. La confirmation
reconnaît aussi une référence déjà sauvegardée sans l'écrire de nouveau. En cas
d'échec, elle affiche le message de stockage indisponible et permet de réessayer.
Le lien `/order/$token` reste accessible avant toute sauvegarde, après succès et en
cas d'échec. Une panne de localStorage ne peut pas affecter la création de commande.

`/track` conserve son formulaire existant et ajoute « Mes commandes sauvegardées ».
Chaque carte recharge son état par le RPC existant `track_order(public_token)` et
la clé React Query `["track", token]` utilisée par la page de suivi. Aucun SELECT
public sur `orders`, aucune recherche par id interne, aucune donnée personnelle
supplémentaire affichée.

## Notifications

- Écoute `INSERT` sur `public.orders` avec le client de la session admin, soumis aux
  permissions SELECT et aux RLS owner/staff existantes.
- Toast traduit FR/AR/EN « Nouvelle commande reçue », avec référence publique si présente.
- Invalidation des familles `admin_orders`, `admin_orders_count`, `admin_analytics` :
  listes, compteur et statistiques se rafraîchissent sans rechargement de page.
- Badge de navigation basé sur le compteur `pending` existant. Les actions manuelles
  de confirmation/refus invalident également ce compteur.
- Initialisation différée d'une microtask : le cycle de vérification StrictMode ne
  crée qu'une souscription active. Un Set de 1 000 ids maximum évite les doublons
  sur reconnexion dans le shell courant. Nettoyage par `removeChannel`, y compris
  après erreur ; les événements tardifs sont ignorés.
- Reconnexion gérée par le SDK. À chaque connexion réussie, les queries sont
  réconciliées ; les événements manqués ne sont pas rejoués comme des notifications.
- En cas d'indisponibilité : état traduit visible et bouton de rafraîchissement des
  queries. Les erreurs de connexion et de nettoyage n'interrompent pas l'admin.
- Son facultatif, désactivé initialement et non mémorisé. Création/reprise de
  l'AudioContext uniquement après clic ; lecture seulement si son état est running.
  Signal de 0,2 s à faible volume ; contexte fermé au démontage. Échec audio isolé.
- Fonctionne seulement lorsque l'admin est ouvert. Chaque onglet admin possède sa
  notification ; aucune coordination entre appareils ou notification externe.

## Mes commandes

Clé exclusive : `elegancia-saved-orders-v1`. Aucun usage d'une ancienne clé OpenStore.
Seuls `publicToken` et `createdAt` sont écrits. Lecture et écriture filtrent les champs,
valident les UUID, normalisent les dates, dédupliquent les références et conservent
au maximum les 30 dernières entrées. Ni statut ni numéro Packers ne sont persistés.
Les tokens permettent d'accéder au suivi : l'interface recommande de les garder privés.

La liste est lue après hydratation, se met à jour sur changement local et événement
storage d'un autre onglet. Une donnée corrompue est ignorée ; un échec de stockage
reste non bloquant. Retirer supprime exclusivement le favori local, jamais la commande.

Les cartes affichent référence, date, statut Elegancia et mode de livraison. Sans
tracking, elles indiquent qu'il sera disponible après création du colis ; avec
tracking, elles affichent le numéro et un bouton copier. Le même composant est
utilisé sur `/order/$token`. Copie via navigator.clipboard, fallback textarea temporaire
avec restauration du focus ; sinon message invitant à sélectionner le numéro.

Une référence inconnue ou une erreur réseau ne supprime jamais le favori. Le suivi
se recharge à l'ouverture et selon les règles de fraîcheur React Query ; pas de
polling des commandes clientes. Effacer les données navigateur ou changer d'appareil
fait perdre les favoris. Deux écritures exactement simultanées entre onglets peuvent
se remplacer : localStorage n'est pas une base transactionnelle.

## Migration et sécurité

`20261031103939_enable_orders_realtime.sql`, générée par Supabase CLI, ajoute `orders`
à `supabase_realtime` de façon idempotente. Elle refuse de continuer si les RLS sont
désactivées ou si anon possède SELECT. Aucun GRANT, policy, trigger de stock ou
SECURITY DEFINER modifié. Le schéma historique n'est pas réécrit.

Vérification en lecture seule du projet Supabase Elegancia Home : RLS actives,
SELECT anon absent, policy owner/staff présente ; publication existante mais orders
absente. La migration est donc nécessaire. Aucune mutation de production réalisée.
Les advisors de sécurité signalent des avertissements préexistants sur pg_net,
les RPC SECURITY DEFINER et la protection des mots de passe, sans modification ici.
Référence : https://supabase.com/docs/guides/database/database-linter

Après validation de la PR, appliquer la migration puis exécuter
`supabase/tests/orders-realtime.sql`. Vérifier ensuite avec une session admin et
une commande de test : toast unique, compteur, son après activation, navigation et
reconnexion. Vérifier avec anon et un compte non admin qu'aucune commande n'est reçue.
La migration et le test SQL n'ont pas été exécutés ici : aucune base jetable accessible,
socket Docker indisponible. Le test Realtime authentifié reste à faire après migration.

## Tests et qualité

31 nouveaux tests couvrent sauvegarde explicite du token, déduplication, suppression, corruption,
champs autorisés uniquement, quota/stockage bloqué, bornage, checkout réussi/échoué,
double clic, absence de sauvegarde au checkout, consentement, appareil partagé,
commande déjà enregistrée, confirmation et suivi malgré un échec de stockage, tracking absent puis présent, copie et fallback, erreur RPC,
changement d'onglet, StrictMode, nettoyage, reconnexion, données minimales transmises,
invalidation des queries et son facultatif.

Comparaison locale avec un worktree indépendant de `main` :

| Contrôle                    | Branche                                                  | Main                         |
| --------------------------- | -------------------------------------------------------- | ---------------------------- |
| Typecheck                   | 25 erreurs préexistantes                                 | 25 erreurs                   |
| Lint global                 | 50 erreurs préexistantes, 9 avertissements               | 57 erreurs, 9 avertissements |
| Tests                       | 31 nouveaux réussis ; 3 échecs préexistants              | 116 réussis, 3 échecs        |
| Knip                        | 9 fichiers, 13 exports, 2 types inutilisés, préexistants | Identique                    |
| Build                       | Réussi                                                   | Réussi                       |
| Lint des fichiers concernés | Réussi                                                   | —                            |

Les trois échecs existants concernent `delivery.test.ts` (2 anciennes attentes
sur les tarifs) et `page-titles.test.ts`. Les erreurs TypeScript concernent les types
Supabase du catalogue, le registre des routes, des variables inutilisées et un locale.
Aucun échec n'est masqué. La vérification UI est réalisée sous jsdom avec React DOM ;
pas de validation visuelle ou de connexion Realtime réelle revendiquée.
