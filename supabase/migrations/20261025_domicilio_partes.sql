-- 25 oct 2026: Domicilio en partes para filtrar por Municipio o Estado.
-- contacto_domicilio se conserva: guarda el domicilio completo en una línea
-- (y el texto anterior de quienes se registraron antes de este cambio).

alter table patient_expediente
  add column if not exists domicilio_calle     text,
  add column if not exists domicilio_num_ext   text,
  add column if not exists domicilio_num_int   text,
  add column if not exists domicilio_colonia   text,
  add column if not exists domicilio_municipio text,
  add column if not exists domicilio_cp        text,
  add column if not exists domicilio_estado    text,
  add column if not exists domicilio_pais      text;

create index if not exists patient_expediente_domicilio_estado_idx
  on patient_expediente (domicilio_estado, domicilio_municipio);
