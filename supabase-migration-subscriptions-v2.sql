-- ─────────────────────────────────────────────────────────────
-- AVI — Migración: subscriptions v2 (patient_slots + Stripe)
-- Pegar en Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────

-- 1. Agregar columnas nuevas a subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS patient_slots      integer not null default 5,
  ADD COLUMN IF NOT EXISTS stripe_price_id    text,
  ADD COLUMN IF NOT EXISTS billing_cycle_start timestamptz;

-- 2. Ampliar enum de plan para incluir 'valora'
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('paid', 'free', 'valora', 'unit'));
-- paid   = paquete estándar (5/10/20/30/40 pac)
-- unit   = precio unitario flexible ($3.35 × N)
-- valora = paquete especial asesores VALORA
-- free   = aprobado por desarrollador / patrocinado

-- 3. Índice para búsqueda rápida por stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_subs_stripe_customer
  ON public.subscriptions(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- 4. RLS: permitir que el webhook (service role) actualice subscriptions
-- (service role ya bypasea RLS — no necesita política adicional)

-- 5. Vista actualizada con patient_slots
CREATE OR REPLACE VIEW public.therapist_access AS
  SELECT
    therapist_id,
    patient_slots,
    plan,
    status,
    CASE
      WHEN status IN ('active', 'free_approved', 'trialing') THEN true
      ELSE false
    END AS has_access
  FROM public.subscriptions;
