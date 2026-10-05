-- Sprint 12 Companion: permitir plan='companion' en subscriptions
-- Sin esto, el checkout companion (sin plan previo) falla al hacer upsert.
-- Aplicado manualmente en Supabase SQL Editor el 2026-10-05.

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('paid', 'free', 'valora', 'unit', 'companion'));
