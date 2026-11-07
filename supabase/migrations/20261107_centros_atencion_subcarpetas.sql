-- 7 nov 2026: CentrosAtención (carpetas de la empresa en CONVENIO) y SubCarpetas (del terapeuta).
--
-- CentrosAtención: los crea la Persona Institucional User/Superuser (o el superadmin) en
-- Configuración Admin y les asigna sus terapeutas en Alta/Baja de <Pros>. Un terapeuta puede
-- estar en varios. La persona atendida queda en uno (therapist_patients.centro_id): si el
-- terapeuta cambia de CentroAtención, la historia de sus personas no se mueve.
--
-- SubCarpetas: las crea cada terapeuta (con o sin empresa, con plan pagado o gratis) para
-- ordenar a sus personas. Un solo nivel. Privadas: solo él las ve (therapist_patients.subcarpeta_id).
--
-- Solo servidor (RLS sin políticas, como patient_mensajes): todo pasa por las API con service role.
-- No cambia ningún dato existente.

create table if not exists public.empresa_centros_atencion (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.convenio_empresas(id) on delete cascade,
  nombre      text not null check (length(btrim(nombre)) between 1 and 80),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists empresa_centros_atencion_nombre_uniq
  on public.empresa_centros_atencion (empresa_id, lower(btrim(nombre)));

create table if not exists public.therapist_centro_atencion (
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  centro_id    uuid not null references public.empresa_centros_atencion(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (therapist_id, centro_id)
);
create index if not exists therapist_centro_atencion_centro_idx on public.therapist_centro_atencion (centro_id);

create table if not exists public.therapist_subcarpetas (
  id           uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  nombre       text not null check (length(btrim(nombre)) between 1 and 60),
  created_at   timestamptz not null default now()
);
create unique index if not exists therapist_subcarpetas_nombre_uniq
  on public.therapist_subcarpetas (therapist_id, lower(btrim(nombre)));

alter table public.therapist_patients
  add column if not exists centro_id uuid references public.empresa_centros_atencion(id) on delete set null,
  add column if not exists subcarpeta_id uuid references public.therapist_subcarpetas(id) on delete set null;
create index if not exists therapist_patients_centro_idx on public.therapist_patients (centro_id);
create index if not exists therapist_patients_subcarpeta_idx on public.therapist_patients (subcarpeta_id);

alter table public.empresa_centros_atencion  enable row level security;
alter table public.therapist_centro_atencion enable row level security;
alter table public.therapist_subcarpetas     enable row level security;
