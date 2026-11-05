# Supabase migration baseline

Elegancia Home was initially bootstrapped from `supabase/schema.sql`, while the first production changes were also recorded as separate Supabase migration versions. Migration tracking in GitHub started later, which left the repository and Production histories with different version lists.

This directory is normalized as follows:

- `20261030142827_openstore_base_schema.sql` is the **squashed bootstrap baseline** for a clean database. Its blob is the same content as `supabase/schema.sql` at the time this baseline was normalized.
- Versions `20261030142856` through `20261030143146` are retained as historical marker files. Their effects are already included in the squashed bootstrap baseline, so they intentionally contain no executable SQL.
- `20261030143156_elegancia_initial_branding.sql` remains executable because it converts the generic OpenStore bootstrap into Elegancia Home.
- Later migration filenames use the exact versions recorded by the Production project whenever that change was applied through Supabase migrations.
- The Packers authoritative-rate change was already present in Production state but had not been recorded in migration history. It was re-applied idempotently and formally recorded as `20261031160705`.
- Future database changes must be made with a migration first, and the same migration file must be committed here. Do not make untracked DDL changes directly in Production.

## Fresh database

Apply migrations in timestamp order. The first migration creates the complete OpenStore bootstrap state; the historical markers then no-op; the Elegancia and later migrations bring the database to the current store schema.

## Existing Production database

Do not replay historical files manually. Supabase already records those versions. Only migrations newer than the latest Production version should be applied.

## Commerce integration, November 2026

The six migrations `20261105102059` through `20261105102147` were applied on
5 November 2026 to **Elegancia Home**, after explicit owner authorization and
successful application/verification on **Elegancia Home Test**. Filenames match
the exact Production migration versions returned by Supabase. Do not replay them.

These changes do not backfill historic stock or change wilayas, delivery rates,
secrets, or the existing Finance activation state. The legacy dashboard analytics
RPC remains unchanged so the currently deployed frontend remains compatible.

The Test project's earlier baseline and migration versions differ from Production;
commerce changes correspond by migration name. No earlier migration was replayed
and no historical migration record was rewritten. See
[`docs/MIGRATION_RECEIPT.md`](../docs/MIGRATION_RECEIPT.md) for the correspondence
and post-application verification, and
[`docs/OPENSTORE_INTEGRATION.md`](../docs/OPENSTORE_INTEGRATION.md) for feature scope.
