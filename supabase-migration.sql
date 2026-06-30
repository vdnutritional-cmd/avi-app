-- ─────────────────────────────────────────────────────────────
-- AVI — SQL MIGRACIÓN SUPABASE
-- Pegar todo esto en Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────


-- 1. EXTENSIONES
create extension if not exists "uuid-ossp";


-- 2. TABLA: profiles
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('therapist', 'patient')),
  full_name    text,
  email        text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profiles_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'patient'),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. TABLA: subscriptions
create table public.subscriptions (
  id                     uuid primary key default uuid_generate_v4(),
  therapist_id           uuid not null references public.profiles(id) on delete cascade,
  status                 text not null default 'inactive'
                           check (status in ('active', 'free_approved', 'trialing', 'cancelled', 'inactive')),
  plan                   text not null default 'paid'
                           check (plan in ('paid', 'free')),
  amount_usd             numeric(10,2) default 12.00,
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique(therapist_id)
);

create trigger on_subscriptions_updated
  before update on public.subscriptions
  for each row execute procedure public.handle_updated_at();

create or replace view public.therapist_access as
  select
    therapist_id,
    case
      when status in ('active', 'free_approved', 'trialing') then true
      else false
    end as has_access
  from public.subscriptions;


-- 4. TABLA: authorization_codes
create table public.authorization_codes (
  id             uuid primary key default uuid_generate_v4(),
  code           text not null unique,
  therapist_id   uuid not null references public.profiles(id) on delete cascade,
  patient_email  text,
  used_by        uuid references public.profiles(id),
  used_at        timestamptz,
  expires_at     timestamptz not null default (now() + interval '30 days'),
  is_active      boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now()
);

create index idx_auth_codes_therapist on public.authorization_codes(therapist_id);
create index idx_auth_codes_code on public.authorization_codes(code);

create or replace function public.generate_auth_code()
returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$ language plpgsql;


-- 5. TABLA: therapist_patients
create table public.therapist_patients (
  id                    uuid primary key default uuid_generate_v4(),
  therapist_id          uuid not null references public.profiles(id) on delete cascade,
  patient_id            uuid not null references public.profiles(id) on delete cascade,
  authorization_code_id uuid references public.authorization_codes(id),
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  unique(therapist_id, patient_id)
);

create index idx_tp_therapist on public.therapist_patients(therapist_id);
create index idx_tp_patient on public.therapist_patients(patient_id);


-- 6. TABLA: sessions
create table public.sessions (
  id           uuid primary key default uuid_generate_v4(),
  patient_id   uuid not null references public.profiles(id) on delete cascade,
  title        text,
  status       text not null default 'active'
                 check (status in ('active', 'completed')),
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  created_at   timestamptz not null default now()
);

create index idx_sessions_patient on public.sessions(patient_id);
create index idx_sessions_status on public.sessions(status);


-- 7. TABLA: messages
create table public.messages (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index idx_messages_session on public.messages(session_id);
create index idx_messages_created on public.messages(created_at);


-- 8. TABLA: patterns
create table public.patterns (
  id                    uuid primary key default uuid_generate_v4(),
  session_id            uuid not null references public.sessions(id) on delete cascade,
  patient_id            uuid not null references public.profiles(id) on delete cascade,
  summary               text,
  emotional_patterns    jsonb default '[]',
  predominant_emotions  jsonb default '[]',
  reformulation         text,
  crisis_detected       boolean not null default false,
  raw_json              jsonb,
  created_at            timestamptz not null default now(),
  unique(session_id)
);

create index idx_patterns_patient on public.patterns(patient_id);
create index idx_patterns_session on public.patterns(session_id);


-- 9. TABLA: crisis_alerts
create table public.crisis_alerts (
  id                   uuid primary key default uuid_generate_v4(),
  patient_id           uuid not null references public.profiles(id) on delete cascade,
  session_id           uuid not null references public.sessions(id) on delete cascade,
  message_id           uuid references public.messages(id),
  detected_keywords    jsonb not null default '[]',
  therapist_notified   boolean not null default false,
  notified_at          timestamptz,
  created_at           timestamptz not null default now()
);

create index idx_crisis_patient on public.crisis_alerts(patient_id);
create index idx_crisis_therapist_notified on public.crisis_alerts(therapist_notified);


-- 10. TABLA: analyses
create table public.analyses (
  id                  uuid primary key default uuid_generate_v4(),
  patient_id          uuid not null references public.profiles(id) on delete cascade,
  therapist_id        uuid not null references public.profiles(id) on delete cascade,
  title               text not null,
  content             text not null,
  sessions_analyzed   jsonb default '[]',
  techniques_proposed jsonb default '[]',
  session_plan        jsonb default '[]',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger on_analyses_updated
  before update on public.analyses
  for each row execute procedure public.handle_updated_at();

create index idx_analyses_patient on public.analyses(patient_id);
create index idx_analyses_therapist on public.analyses(therapist_id);


-- 11. ROW LEVEL SECURITY (RLS)
alter table public.profiles            enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.authorization_codes enable row level security;
alter table public.therapist_patients  enable row level security;
alter table public.sessions            enable row level security;
alter table public.messages            enable row level security;
alter table public.patterns            enable row level security;
alter table public.crisis_alerts       enable row level security;
alter table public.analyses            enable row level security;

-- PROFILES
create policy "profiles: usuario ve el suyo"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: terapeuta ve sus pacientes"
  on public.profiles for select
  using (
    exists (
      select 1 from public.therapist_patients tp
      where tp.therapist_id = auth.uid()
        and tp.patient_id = id
        and tp.is_active = true
    )
  );

create policy "profiles: usuario actualiza el suyo"
  on public.profiles for update
  using (auth.uid() = id);

-- SUBSCRIPTIONS
create policy "subscriptions: terapeuta ve la suya"
  on public.subscriptions for select
  using (auth.uid() = therapist_id);

create policy "subscriptions: solo sistema actualiza"
  on public.subscriptions for update
  using (false);

-- AUTHORIZATION CODES
create policy "codes: terapeuta gestiona los suyos"
  on public.authorization_codes for all
  using (auth.uid() = therapist_id);

create policy "codes: lectura para validar"
  on public.authorization_codes for select
  using (true);

-- THERAPIST_PATIENTS
create policy "tp: terapeuta ve sus relaciones"
  on public.therapist_patients for select
  using (auth.uid() = therapist_id);

create policy "tp: paciente ve su relacion"
  on public.therapist_patients for select
  using (auth.uid() = patient_id);

-- SESSIONS
create policy "sessions: paciente gestiona las suyas"
  on public.sessions for all
  using (auth.uid() = patient_id);

create policy "sessions: terapeuta ve las de sus pacientes"
  on public.sessions for select
  using (
    exists (
      select 1 from public.therapist_patients tp
      where tp.therapist_id = auth.uid()
        and tp.patient_id = sessions.patient_id
        and tp.is_active = true
    )
  );

-- MESSAGES
create policy "messages: paciente gestiona los suyos"
  on public.messages for all
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.patient_id = auth.uid()
    )
  );

-- PATTERNS
create policy "patterns: paciente ve los suyos"
  on public.patterns for all
  using (auth.uid() = patient_id);

create policy "patterns: terapeuta ve los de sus pacientes"
  on public.patterns for select
  using (
    exists (
      select 1 from public.therapist_patients tp
      where tp.therapist_id = auth.uid()
        and tp.patient_id = patterns.patient_id
        and tp.is_active = true
    )
  );

-- CRISIS ALERTS
create policy "crisis: paciente ve las suyas"
  on public.crisis_alerts for select
  using (auth.uid() = patient_id);

create policy "crisis: terapeuta ve las de sus pacientes"
  on public.crisis_alerts for select
  using (
    exists (
      select 1 from public.therapist_patients tp
      where tp.therapist_id = auth.uid()
        and tp.patient_id = crisis_alerts.patient_id
        and tp.is_active = true
    )
  );

-- ANALYSES
create policy "analyses: terapeuta gestiona los suyos"
  on public.analyses for all
  using (auth.uid() = therapist_id);
