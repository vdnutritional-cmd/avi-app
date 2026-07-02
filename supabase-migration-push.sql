-- ─────────────────────────────────────────────────────────────
-- AVI — Migración: push_subscriptions
-- Pegar en Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.push_subscriptions (
  id            uuid primary key default uuid_generate_v4(),
  therapist_id  uuid not null references public.profiles(id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  UNIQUE(therapist_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Terapeuta gestiona sus propias suscripciones
CREATE POLICY "push_subs: terapeuta gestiona las suyas"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = therapist_id);

CREATE INDEX idx_push_subs_therapist ON public.push_subscriptions(therapist_id);
