# Reçu d’application des migrations commerce

Le 5 novembre 2026, après autorisation explicite de la propriétaire, les six
migrations ont été appliquées d’abord sur **Elegancia Home Test**, puis sur
**Elegancia Home**. La propriétaire a explicitement demandé de conserver Finance
activée lors du précontrôle ; aucune modification de ce paramètre n’a été effectuée.

| Migration                      | Version Production | Version Test     |
| ------------------------------ | ------------------ | ---------------- |
| `commerce_pack_reservations`   | `20261105102059`   | `20261105101421` |
| `commerce_insights`            | `20261105102105`   | `20261105101522` |
| `commerce_exports`             | `20261105102129`   | `20261105101635` |
| `commerce_export_dispatch`     | `20261105102138`   | `20261105101642` |
| `commerce_review_setup_search` | `20261105102143`   | `20261105101650` |
| `commerce_catalogue_stock`     | `20261105102147`   | `20261105101656` |

Les fichiers dans `supabase/migrations` portent les versions exactes Production.
Les contenus ont été appliqués avec un délai maximal de verrouillage de 5 secondes
et un délai d’exécution de 60 secondes par migration. Aucun bootstrap ni ancienne
migration n’a été rejoué. Aucun historique antérieur n’a été réécrit. Les écarts de versions financières
préexistants entre les anciens fichiers et l’historique hébergé restent à réconcilier
avant un éventuel `db push` global : cette intervention cible uniquement les six
migrations commerce identifiées.

## Contrôles après application

- Six applications réussies dans chaque projet.
- 332 tests locaux réussis, dont 49 tests de base de données ; typecheck, ESLint,
  Knip et build réussis. Le worker cron a exécuté sa tâche sans erreur après application.
- Empreintes et compteurs inchangés pour les 39 tables applicatives préexistantes
  en Production et les 38 tables préexistantes en Test. Aucun stock, produit,
  commande, réglage de livraison ou enregistrement financier modifié.
- RPC de l’ancien dashboard `admin_analytics(integer)` strictement inchangée.
- Catalogue, nouvelles statistiques, checklist et historique téléphonique répondent.
- Recherche par catégorie secondaire et données de literie couvertes par les nouveaux
  tests de non-régression ; stock des packs dérivé des composants conservé.
- RLS activée sur la file d’export, lecture anonyme refusée, schéma privé inaccessible
  aux visiteurs, job d’export présent. Aucune destination d’export activée.
- Aucun nouvel accès anonyme à une fonction SECURITY DEFINER. Les quatre nouvelles
  RPC administratives restent réservées aux rôles autorisés et contrôlent leur rôle.

Les avis Supabase préexistants restent présents : extension pg_net dans public,
protection contre les mots de passe compromis désactivée, tables internes volontairement
sans policy publique et fonctions SECURITY DEFINER intentionnelles. Aucun de ces
paramètres n’a été modifié. Voir les guides officiels pour les
[extensions dans public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public),
[fonctions privilégiées](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
et la [protection des mots de passe](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

La vérification de conservation utilise des compteurs et des empreintes calculés
sur place. Aucune copie locale de données commerciales n’a été réalisée : cette
copie a été refusée par le contrôle automatique, faute d’autorisation explicite
pour cet export. Ce reçu n’est pas une sauvegarde complète de la base.

Aucune fusion de PR, aucun déploiement du site, aucune modification de secret et
aucune configuration Google externe n’ont été effectués. Les interfaces nouvelles
attendent toujours la validation et le déploiement de la PR #45. Google Sheets
reste facultatif et désactivé jusqu’à sa configuration explicite.
