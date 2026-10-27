-- 27 oct 2026: Enfoques terapéuticos autorizados por cada empresa en CONVENIO.
-- Los marca la Persona Institucional (User/Superuser) o el superadmin en Configuración Admin.
-- El terapeuta sin plan pagado personal solo puede elegir entre los autorizados por sus
-- empresas activas (src/lib/enfoques-permitidos.ts). Arranca con los 3 en todas las empresas.

alter table convenio_empresas
  add column if not exists enfoques_permitidos text[] not null default '{famsis,trec,cc}';

alter table convenio_empresas drop constraint if exists convenio_empresas_enfoques_check;
alter table convenio_empresas add constraint convenio_empresas_enfoques_check
  check (cardinality(enfoques_permitidos) >= 1 and enfoques_permitidos <@ array['famsis','trec','cc']);
