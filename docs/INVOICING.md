# Facturation native

## Émission et règle configurable

Une facture est liée à un unique snapshot `order_finance` de commande.
La préparation manuelle crée un brouillon sans numéro. Par défaut, l'émission
est manuelle et autorisée à partir de la livraison. Le réglage owner peut choisir
confirmation/expédition/livraison et activer l'émission automatique à ce stade.
La reconnaissance du CA opérationnel reste liée à la livraison.
Ce réglage n'est pas une déclaration de conformité fiscale : le comptable doit
valider le moment d'émission avant activation réelle.

`finance_issue_invoice` verrouille commande, snapshot et facture, recontrôle
l'état canonique et les montants, obtient un numéro, fige les informations
d'entreprise et de taxe, puis écrit l'audit dans la même transaction.
Une erreur annule l'ensemble. Une seconde émission renvoie le même document.

Le compteur est un UPSERT PostgreSQL transactionnel sur `(kind,year)`, avec
verrou de ligne et `RETURNING`, jamais `MAX()+1`. Format FAC-AAAA-000001 et
AV-AAAA-000001 ; l'année suit Africa/Algiers. Après un million, le numéro
s'allonge et ne tronque pas la séquence. Un numéro émis ne peut plus changer.

Les prix proviennent des `order_items` existants, jamais du navigateur ni du
catalogue courant. Le schéma existant ne conserve pas une remise catalogue
distincte : le PDF indique les prix nets enregistrés et n'invente pas de remise.
Le SKU est figé s'il existe à la capture ; aucun SKU historique n'est inventé.

## Statuts et corrections

- `draft` : préparée, sans numéro officiel.
- `issued` : émise, créance, contenu immuable.
- `paid` : reversement effectif rapproché, retenues du lot entièrement reçues.
- `cancelled` : brouillon annulé avec la commande, ou facture émise corrigée par avoir.

Le numéro, les coordonnées cliente, les lignes, prix, montants, devise, date
d'émission et informations légales sont protégés par triggers après émission.
Seules des métadonnées de paiement/statut et d'archive passent par les RPC dédiées.
Aucune suppression de facture ni modification silencieuse d'une ligne n'est permise.

Un owner peut créer un avoir intégral motivé. L'original reste conservé avec son
numéro, l'avoir porte sa propre séquence et référence l'original. L'avoir reprend
les données d'origine, pas les informations d'entreprise récemment modifiées.
Il ne rembourse pas automatiquement et ne touche pas le stock.
Le remboursement effectif est une opération distincte, complète, datée, sur un
compte réel, possible après reversement enregistré. Aucun remboursement n'est
déduit du seul statut livré. Les avoirs partiels et paiements partiels client
ne sont pas pris en charge dans cette première version.

## Taxes et identité

Nom légal, adresse, téléphone, email, RC, NIF, NIS, AI et logo sont configurables
dans Finance. À défaut de valeur spécifique, seuls les champs réellement présents
de `store_settings` sont utilisés. Aucun identifiant ou adresse fictif n'est ajouté.
La taxe est facultative et incluse dans le total TTC canonique :
`taxe = total × taux / (100 + taux)`. Le taux est vide par défaut, jamais déterminé
par le pays. Cette version ne gère pas plusieurs taux par ligne ni TVA déductible.
Le comptable doit valider cette présentation et les mentions légales.

## PDF : choix de conservation

Générer à chaque téléchargement depuis un snapshot empêcherait les changements
de données, mais une mise à jour du moteur, de la police ou du modèle pourrait
changer les octets. Le choix retenu est une archive PDF privée, sans écrasement,
avec SHA-256, chemin fixe et version de moteur `elegancia-a4-v1`.

Le backend TanStack utilise pdfme en Node, un modèle A4 premium en français,
une police locale avec accents et arabe, et le logo configuré. Il affiche
numéro/date/référence, cliente/adresse/commune/wilaya, lignes SKU/variante/quantité,
prix nets, livraison, taxe configurée et total DZD/DA.
Les lignes longues sont paginées et l'en-tête de tableau est répété.

L'émission SQL et Storage ne partagent pas une transaction distribuée :

1. Le snapshot et le numéro sont validés atomiquement en base.
2. L'action manuelle demande immédiatement le PDF ; l'émission automatique
   diffère l'archive au premier téléchargement.
3. Le serveur écrit `invoice/<uuid>/document.pdf` ou `credit/<uuid>/document.pdf`
   dans le bucket privé `finance-invoices`, `upsert:false`.
4. Il relit l'objet gagnant, calcule son SHA-256 et publie les métadonnées via
   une RPC serveur qui vérifie document émis, chemin et objet existant.
5. Chaque téléchargement suivant relit l'archive et vérifie son hash ; il ne
   regénère pas une archive déjà publiée. Une altération provoque un échec.

Deux requêtes simultanées convergent vers le même objet. Une réponse perdue
entre stockage et publication est récupérable en relisant cet objet.
Un échec PDF laisse une facture émise, jamais un deuxième numéro. Le téléchargement
se réessaie. Avant le premier archivage, seuls le snapshot et la version sont figés ;
ne modifier aucun renderer existant, ajouter une nouvelle version pour évoluer.
La disponibilité de Storage est donc nécessaire à la première remise du PDF.
Une suppression d'objet par un opérateur service_role reste hors protection RLS :
restreindre cette clé et prévoir sauvegarde/restauration des objets privés.

## Téléchargements et configuration serveur

- Admin : `/api/finance/:id/pdf`, JWT Bearer, rôle owner/staff vérifié.
- Cliente : `/api/order-invoice/:token?kind=invoice|credit`, token UUID de suivi
  existant ; le serveur résout le document de cette commande seulement.
- Aucun ID de facture arbitraire n'est accepté sur la route publique.
- Réponses binaires privées `no-store`, `nosniff`, `no-referrer`, `noindex`.
- Le service worker exclut les routes API des caches.
- Tables Finance et bucket PDF ne sont jamais publics. Aucun lien Supabase
  administratif ni clé serveur n'est envoyé à la cliente.

Variables : URL Supabase/clé publique existantes et `SUPABASE_SERVICE_ROLE_KEY`
uniquement sur le serveur Vercel de l'environnement concerné. Ne pas lui donner
un préfixe VITE ni l'utiliser pour les mutations financières admin.
Sans clé d'archive, les téléchargements échouent proprement et le suivi continue.
Les factures sont servies via les fonctions existantes ; aucun serveur supplémentaire.
