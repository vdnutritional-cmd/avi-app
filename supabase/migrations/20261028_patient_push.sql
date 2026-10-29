-- 28 oct 2026: Avisos push al paciente (mensaje nuevo o cuestionario de su terapeuta).
-- Un registro por teléfono/navegador donde el paciente aceptó las notificaciones.
-- Solo servidor (RLS sin políticas): la escribe /api/patient/avisos y la lee src/lib/push/avisar-paciente.ts.
-- Es aparte de push_subscriptions (avisos de crisis al terapeuta).

create table if not exists public.patient_push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (patient_id, endpoint)
);

alter table public.patient_push_subscriptions enable row level security;

create index if not exists idx_patient_push_patient on public.patient_push_subscriptions(patient_id);
create index if not exists idx_patient_push_endpoint on public.patient_push_subscriptions(endpoint);
