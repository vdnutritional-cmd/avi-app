-- 27 oct 2026: Mensajes del terapeuta al paciente (AVI-CLÍNICO › Cuestionarios).
-- Canal de un solo sentido: Asunto + Mensaje; el paciente solo los lee (pestaña "Mensajes").
-- No se borran nunca: "Retirar" (envío por error) solo pone retirado_at y el paciente deja de verlo.
-- Solo el servidor de AVI (service role) lee y escribe: RLS activo y sin políticas.

create table if not exists public.patient_mensajes (
  id            uuid        primary key default gen_random_uuid(),
  patient_id    uuid        not null references public.profiles(id),
  therapist_id  uuid        not null references public.profiles(id),
  asunto        text        not null check (char_length(asunto) between 1 and 150),
  mensaje       text        not null check (char_length(mensaje) between 1 and 5000),
  created_at    timestamptz not null default now(),
  leido_at      timestamptz,
  retirado_at   timestamptz
);

create index if not exists idx_patient_mensajes_paciente on public.patient_mensajes (patient_id, created_at desc);
create index if not exists idx_patient_mensajes_terapeuta on public.patient_mensajes (therapist_id, patient_id, created_at desc);

alter table public.patient_mensajes enable row level security;
