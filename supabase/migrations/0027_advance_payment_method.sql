-- =============================================================================
-- 0027_advance_payment_method.sql
-- =============================================================================
-- A payment method for "covered from the family's advance balance". Lives
-- in its own migration because a new enum value can't be used in the same
-- transaction that adds it (0028 uses it).
-- =============================================================================

alter type public.payment_method add value if not exists 'advance';
