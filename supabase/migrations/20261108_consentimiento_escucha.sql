-- 8 nov 2026: Consentimiento Informado v2 y elección de la Escucha de AVI (Derechos ARCO).
-- La persona elige cómo se registran sus sesiones con su <pro> (1 solo notas · 2 Escucha de AVI ·
-- 3 Escucha de AVI y notas) y firma el Consentimiento: en el registro por QR o, si no, al entrar a AVI.
-- Cada firma es un registro nuevo que NO se puede modificar ni borrar (auditoría): guarda el texto
-- exacto que vio, su huella SHA-256, la IP y el dispositivo. El <pro> no puede cambiar la opción:
-- solo habilita una solicitud (Derechos ARCO) y la persona firma de nuevo en su app.
-- Solo el servidor de AVI (service role) lee y escribe: RLS activo y sin políticas.
-- patient_consents (onboarding de septiembre) se queda igual: el límite de sesiones AVI se cuenta desde ahí.

-- ── Solicitudes de cambio (Derechos ARCO) que habilita el <pro> ──
create table if not exists public.patient_arco_solicitudes (
  id                uuid        primary key default gen_random_uuid(),
  patient_id        uuid        not null references public.profiles(id),
  therapist_id      uuid        not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  atendida_at       timestamptz,
  consentimiento_id uuid
);

-- Una sola solicitud pendiente por persona
create unique index if not exists idx_arco_pendiente on public.patient_arco_solicitudes (patient_id) where atendida_at is null;
create index if not exists idx_arco_paciente on public.patient_arco_solicitudes (patient_id, created_at desc);

-- ── Firmas del Consentimiento (una fila por firma; nunca se modifica) ──
create table if not exists public.patient_consentimientos (
  id              uuid        primary key default gen_random_uuid(),
  patient_id      uuid        not null references public.profiles(id),
  version         integer     not null,
  opcion_escucha  smallint    not null check (opcion_escucha in (1, 2, 3)),
  origen          text        not null check (origen in ('registro_qr', 'primera_entrada', 'reconsentimiento', 'arco')),
  terminologia    text        not null,
  empresa_nombre  text,
  texto_firmado   text        not null,
  texto_sha256    text        not null,
  ip              text,
  user_agent      text,
  solicitud_id    uuid        references public.patient_arco_solicitudes(id),
  firmado_at      timestamptz not null default now()
);

create index if not exists idx_consentimientos_paciente on public.patient_consentimientos (patient_id, firmado_at desc);

do $$ begin
  alter table public.patient_arco_solicitudes
    add constraint patient_arco_solicitudes_consentimiento_fk
    foreign key (consentimiento_id) references public.patient_consentimientos(id);
exception when duplicate_object then null;
end $$;

-- ── Inborrables ──
create or replace function public.consentimiento_inmutable() returns trigger
language plpgsql as $$
begin
  raise exception 'Las firmas del Consentimiento Informado no se pueden modificar ni borrar (auditoría).';
end $$;

drop trigger if exists consentimientos_sin_cambios on public.patient_consentimientos;
create trigger consentimientos_sin_cambios
  before update or delete on public.patient_consentimientos
  for each row execute function public.consentimiento_inmutable();

drop trigger if exists consentimientos_sin_truncate on public.patient_consentimientos;
create trigger consentimientos_sin_truncate
  before truncate on public.patient_consentimientos
  for each statement execute function public.consentimiento_inmutable();

-- Solicitudes: no se borran; solo se marcan una vez como atendidas (con la firma que las atendió)
create or replace function public.arco_solicitud_proteger() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Las solicitudes de Derechos ARCO no se pueden borrar (auditoría).';
  end if;
  if old.atendida_at is not null
     or new.patient_id <> old.patient_id or new.therapist_id <> old.therapist_id or new.created_at <> old.created_at then
    raise exception 'Una solicitud de Derechos ARCO solo se marca una vez como atendida (auditoría).';
  end if;
  return new;
end $$;

drop trigger if exists arco_solicitudes_proteger on public.patient_arco_solicitudes;
create trigger arco_solicitudes_proteger
  before update or delete on public.patient_arco_solicitudes
  for each row execute function public.arco_solicitud_proteger();

drop trigger if exists arco_solicitudes_sin_truncate on public.patient_arco_solicitudes;
create trigger arco_solicitudes_sin_truncate
  before truncate on public.patient_arco_solicitudes
  for each statement execute function public.consentimiento_inmutable();

alter table public.patient_consentimientos  enable row level security;
alter table public.patient_arco_solicitudes enable row level security;
