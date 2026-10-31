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
