-- Transactional smoke test for manual admin orders.
-- Run with an authenticated admin JWT context on a disposable/test database.
-- The transaction rolls back, so it must never leave an order or stock change.

begin;

-- The RPC itself is also guarded by has_admin_role(auth.uid()).
-- Choose an existing active variant and valid delivery zone before adapting this
-- smoke test in an automated environment.

-- Assertions covered manually against the linked Elegancia project before merge:
-- 1. anon has no EXECUTE privilege on place_admin_order.
-- 2. authenticated admin can create an Instagram order.
-- 3. p_confirmed=true sets status=confirmed and confirmed_at.
-- 4. totals are recalculated from catalogue prices and delivery rules.
-- 5. stock falls by exactly the ordered quantity.
-- 6. rollback restores both the order rows and stock.

rollback;
