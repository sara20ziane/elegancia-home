# Validation — commandes manuelles

Validation effectuée le 31 octobre 2026 sur le projet Supabase Elegancia Home.

- `orders.order_source` existe avec `website` par défaut et une contrainte de valeurs.
- `place_admin_order(jsonb,jsonb,text,boolean)` n'est pas exécutable par `anon` et l'est par `authenticated`; la fonction vérifie ensuite le rôle admin.
- Test transactionnel réel : création d'une commande manuelle source `instagram`, `p_confirmed=true`, recalcul du total et décrément du stock d'une unité.
- Assertions réussies : source, statut, date de confirmation, total positif et stock réservé.
- La transaction a été annulée; contrôle final : 0 commande test restante et stock revenu à sa valeur initiale.

Le preview Vercel du code complet doit être `READY` avant fusion.
