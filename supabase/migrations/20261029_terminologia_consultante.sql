-- 29 oct 2026: tercera terminología "Consultante" (consultante / consultor / consultoría),
-- de grado profesional entre Terapeuta y Asesor. Se amplía la regla (CHECK) de las dos columnas:
--   convenio_empresas.terminologia  (Configuración Admin de la empresa)
--   profiles.terminologia           ("Cómo me nombran" del terapeuta)
-- Quita la regla anterior sea cual sea su nombre y pone la nueva. No cambia ningún dato.

do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tabla, c.conname
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.convenio_empresas'::regclass, 'public.profiles'::regclass)
      and pg_get_constraintdef(c.oid) ilike '%terminologia%'
  loop
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
  end loop;
end $$;

alter table public.convenio_empresas
  add constraint convenio_empresas_terminologia_check
  check (terminologia in ('paciente', 'consultante', 'asesorado'));

alter table public.profiles
  add constraint profiles_terminologia_check
  check (terminologia in ('paciente', 'consultante', 'asesorado'));
