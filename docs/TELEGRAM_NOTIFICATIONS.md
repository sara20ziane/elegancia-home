# Notifications Telegram Elegancia Home

Base : `main` à `171ef3d`. Branche dédiée, aucune dépendance ou migration ajoutée.
Les variables TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID sont déjà configurées dans Vercel.
Elles sont lues à l'exécution uniquement dans un module `server-only` ; aucune
recréation ou récupération de leur valeur n'est nécessaire pour cette PR.

## Nouvelle commande

Le checkout conserve son flux : place_order, token, panier vidé, confirmation. Il
lance ensuite une requête createServerFn POST avec uniquement le public_token.
Cette requête est indépendante : elle n'est pas attendue par le checkout, et toute
exception synchrone ou asynchrone est absorbée sans produire checkout.error. Aucun
effect React ne déclenche l'envoi ; la protection inFlight contre le double clic
est conservée. La sauvegarde locale reste volontaire, comme sur main.

La fonction serveur relit le RPC track_order avec la clé Supabase publique et les
permissions existantes. Elle ne lit jamais orders directement pour cette notification,
n'utilise aucune service_role et n'accepte aucun prix, article ou destinataire du
navigateur. Elle ne retourne ni données personnelles ni statut d'envoi au navigateur.
Elle vérifie le token de la réponse, sa structure et la date de création. Un token
invalide, une commande introuvable ou une réponse incohérente n'envoient aucun message.

L'action publique accepte un token de suivi qui est une capacité d'accès existante.
Pour limiter les rejeux évidents, seules les commandes créées depuis moins de 15 minutes
sont éligibles, avec une tolérance de 60 secondes sur l'horloge future. Un garde borné à
1 000 tokens supprime les répétitions sur la même instance pendant 15 minutes, y compris
les appels concurrents. Il n'est pas une garantie d'idempotence entre plusieurs instances
Vercel, redémarrages ou déploiements. Aucune nouvelle table de statut n'est créée.

## Colis Packers

Après createOrder, un tracking doit être une chaîne non vide, sans espace interne
ni caractères de contrôle, de 200 caractères maximum. L'UPDATE existant est suivi
d'un SELECT de tracking_number : la notification ne part que si une ligne avec le
tracking exact sauvegardé est retournée. Une absence de ligne ou une erreur de
sauvegarde reste un échec Packers, sans notification trompeuse.

Les informations du message proviennent de la commande déjà relue sous la session
admin et du tracking enregistré. L'envoi est attendu dans cette requête serveur,
avec délai borné et erreurs absorbées. Même une exception inattendue de l'intégration
ne peut transformer le succès du colis en erreur. Il n'y a ni annulation, suppression,
transition de statut ni restitution de stock liée à Telegram.

## Messages et transport

Texte brut français, sans parse_mode : cliente, téléphone, wilaya, commune, adresse,
mode, Stop Desk lorsqu'applicable, tous les articles avec variante/quantité/prix/total,
montants canoniques, statut traduit et date en Africa/Algiers. La notification colis
inclut identité, lieu, mode, montant COD et tracking. Les champs absents sont signalés
sans inventer d'adresse ou de point de retrait. Les espaces et sauts de ligne saisis
dans un champ sont normalisés pour préserver les libellés.

Ni public_token, ni id interne, ni note cliente ne sont ajoutés au message. La note
n'est pas disponible dans le RPC public et n'est pas récupérée par une autre voie.
Les formats et montants sont issus de la base ; le type de parure n'est affiché que
s'il figure déjà dans le libellé de variante retourné par le RPC.

POST JSON vers l'API officielle sendMessage. Les aperçus sont désactivés avec le
paramètre demandé disable_web_page_preview et l'option actuelle link_preview_options.
Un message long est découpé en parties de 4 000 unités UTF-16 maximum, en conservant
tous les caractères et articles. Le délai total de l'envoi, toutes parties comprises,
est de 5 secondes. La lecture Supabase dispose également d'un timeout de 5 secondes.
Aucune relance automatique : un timeout peut survenir après réception effective
par Telegram et une relance risquerait de dupliquer le message.

HTTP non réussi, JSON invalide, ok:false, réseau, timeout ou configuration absente
ne remontent jamais au métier. Les seuls logs ajoutés sont des libellés constants :
`[telegram] New order notification failed` ou
`[telegram] Packers parcel notification failed`.
Aucun identifiant de chat, token, URL avec token, coordonnée, corps de réponse ou
message complet n'est loggué. La destination reste le chat privé configuré côté serveur.

## Sécurité et limites de livraison

Aucune modification RLS, GRANT, SECURITY DEFINER, schema, stock ou statut. Aucun
secret transmis au client ; le module de transport et les formatters portent la
barrière server-only. Le navigateur reçoit uniquement le stub createServerFn.
Le build est vérifié avec des marqueurs de test, sans lire les secrets réels.

Il s'agit d'un envoi best effort. Une fermeture immédiate du navigateur avant le
départ de la requête peut perdre une notification. Une réponse reçue de la fonction
serveur signifie que son travail a été attendu, sans promesse de livraison durable.
Packers peut attendre jusqu'à 5 secondes supplémentaires. Un long message peut être
partiellement reçu avant un échec. Une garantie de livraison et de déduplication
globale nécessiterait ultérieurement une outbox/queue, hors périmètre de cette PR.

## Vérification

47 tests ciblés passent (dont 4 tests checkout déjà présents et 43 nouveaux cas) :
format d'un ou plusieurs articles, domicile/Stop Desk, champs absents, DA, fuseau
Alger, messages longs et emoji, JSON brut, HTTP/API/réseau/timeout/configuration,
lecture canonique, tokens invalides, introuvables, rejeux, concurrence, checkout non
bloquant et notifications Packers seulement après sauvegarde réelle du tracking.

Les commandes typecheck/lint/test/knip/build sont exécutées aussi sur un worktree
indépendant du même main. Les résultats finaux et les erreurs préexistantes sont
détaillés dans la PR. Aucun message réel n'a été envoyé pour les tests, aucune
commande de production créée et aucun secret Vercel lu. Après validation/déploiement,
la réception réelle reste à vérifier sur une commande de recette autorisée.

Références consultées :

- https://core.telegram.org/bots/api#sendmessage
- https://tanstack.com/start/latest/docs/framework/react/guide/server-functions

Résultats finaux :

| Commande | Branche | Main |
| --- | --- | --- |
| npm run typecheck | 25 erreurs préexistantes | 25 erreurs identiques |
| npm run lint | 50 erreurs, 9 avertissements | Identique |
| npm test | 190 réussis, 3 échecs préexistants | 147 réussis, mêmes 3 échecs |
| npm run knip | 9 fichiers, 13 exports, 2 types inutilisés | Mêmes constats |
| npm run build | Réussi | Réussi |
| Lint ciblé | Réussi | — |

Les trois tests en échec sont les anciennes attentes tarifaires de delivery.test.ts
et le contrôle des titres de page de page-titles.test.ts. Ils ne sont pas masqués.
185 fichiers du bundle navigateur ont été inspectés après build avec des marqueurs
factices injectés dans les variables serveur : ni marqueur, ni nom de variable
Telegram serveur, ni code api.telegram.org dans les ressources navigateur.
