# Google Sheets — Elegancia Home

Fonction facultative. Une nouvelle destination est **désactivée**. Les commandes
fonctionnent sans Google : le checkout écrit une file PostgreSQL et le traitement
planifié effectue les requêtes après validation de la transaction. Les migrations
ne sont pas appliquées à la boutique par cette PR.

## Configuration après validation

1. Faire valider et appliquer uniquement les nouvelles migrations de cette PR
   selon `supabase/MIGRATIONS.md`. Ne jamais réexécuter `schema.sql` sur la boutique.
2. Créer une feuille privée dans votre compte Google. Ne pas la publier et ne pas
   activer « toute personne disposant du lien ». Limiter les partages aux personnes
   autorisées à traiter les données clientes.
3. Dans Extensions → Apps Script, coller [le récepteur](GOOGLE_SHEETS_RECEIVER.gs).
4. Paramètres du projet → Propriétés du script : ajouter `ELEGANCIA_SHEET_ID`
   (l'identifiant de la feuille dans son URL) et `ELEGANCIA_EXPORT_SECRET`.
5. Déployer comme application Web, exécuter en tant que propriétaire, accès « Tout
   le monde ». Cela rend le récepteur joignable, **pas la feuille publique**. Sans
   signature HMAC valide il n'écrit rien et ne retourne aucune donnée cliente.
6. Administration → Paramètres → Export des commandes : ajouter le nom et l'URL
   HTTPS `/exec` de ce déploiement. Copier le secret généré dans la propriété
   `ELEGANCIA_EXPORT_SECRET`. Les signatures sont produites exclusivement en base.
   Le secret est consultable uniquement par la propriétaire pour la configuration.
7. Enregistrer les propriétés, redéployer une nouvelle version du script, puis
   activer explicitement la destination. Ne jamais mettre le secret dans une URL,
   un fichier frontend, une capture ou des logs.
8. Sur un environnement de recette et une feuille de test, créer une commande
   synthétique, modifier son statut, son adresse et son suivi. Vérifier qu'une seule
   ligne est mise à jour. Ne pas envoyer des commandes réelles pendant les tests.

La tâche `elegancia-order-exports` s'exécute chaque minute via `pg_cron`. `pg_net`
et `pg_cron`, déjà utilisés par la boutique, doivent être disponibles. Vérifier
leur disponibilité en recette avant application. Aucun abonnement supplémentaire.

## Protocole et reprise

- Création, modifications de commande et de lignes, changements de statut, annulation,
  retour et suivi alimentent une file par couple destination/commande. Les changements
  rapprochés sont fusionnés. Le worker lit l'état final, y compris les articles et les
  montants recalculés. Aucun token de suivi privé n'est exporté.
- HMAC-SHA256 sur **les octets du JSON envoyé par pg_net**. Apps Script ne permet
  pas de lire les headers : la signature seule passe dans `?sig=`, également dans
  le header conventionnel `X-OpenStore-Signature`. Le secret reste hors de la requête.
- Une révision monotone est signée. Le récepteur verrouille le script, recherche
  `order_id`, puis écrit ou actualise la ligne. Une ancienne révision ou une livraison
  répétée est acquittée sans écraser une révision plus récente. Français et arabe
  restent en UTF-8 ; les numéros et révisions sont conservés en texte.
- Les valeurs de texte pouvant être des formules sont neutralisées. Les noms et
  commentaires enregistrés dans la boutique ne sont jamais modifiés.
- Le journal affiche `pending`, `queued`, `succeeded` ou `failed`. `queued` n'est pas
  une confirmation. Le worker exige un HTTP 2xx et un accusé JSON contenant `ok:true`,
  le bon `order_id` et la bonne `revision`. Les réponses clientes et signatures ne
  sont pas enregistrées dans les messages d'erreur.
- Délai HTTP 10 s ; première vérification après 2 min ; reprise progressive, au plus
  cinq tentatives par révision. Après échec, la propriétaire peut utiliser Réessayer.
  Un nouvel état de commande crée une nouvelle révision et recommence les tentatives.
- Désactiver une destination suspend les envois. Réactiver reprend les tâches en
  attente ; aucune commande historique n'est exportée rétroactivement à la création
  d'une destination. Une ancienne réponse tardive ne remplace pas un état récent.

Le récepteur crée l'onglet **Commandes Elegancia**. Il refuse un en-tête incompatible.
Ne supprimez aucune feuille existante pour l'installer : choisissez un nouvel onglet
ou une nouvelle feuille, ou adaptez le nom dans le script. L'ancien récepteur OpenStore
sans révision doit être mis à jour avant d'activer cette nouvelle file.

## Contrôle avant mise en service

Vérifier le job cron et les extensions en recette, la restriction des accès owner,
le secret identique, le redéploiement Apps Script et les onglets privés. Tester une
panne, une reprise et l'arrivée inversée de deux révisions avec des données fictives.
Le succès des tests locaux ne certifie pas les quotas Google ni un déploiement externe.
