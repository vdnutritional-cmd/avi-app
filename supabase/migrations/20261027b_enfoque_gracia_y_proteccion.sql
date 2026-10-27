-- 27 oct 2026: Enfoques terapéuticos — periodo de gracia y protección.
--
-- 1) plan_pagado_visto_at: última vez que el terapeuta tuvo un plan pagado personal activo.
--    Lo actualiza el servidor (src/lib/enfoques-permitidos.ts y el cron diario ajustar-enfoques).
--    Si el plan vence, durante 30 días conserva todos los enfoques (por si vuelve a pagar).
--
-- 2) Solo el servidor de AVI (service role) cambia therapy_profile y plan_pagado_visto_at.
--    Desde el navegador (sesión del usuario) se rechaza: así no se salta la regla de las empresas.

alter table profiles
  add column if not exists plan_pagado_visto_at timestamptz;

create or replace function proteger_enfoque_terapeutico()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.therapy_profile is not null or new.plan_pagado_visto_at is not null then
        raise exception 'El enfoque terapéutico solo se cambia en Configuración › Enfoque terapéutico'
          using errcode = '42501';
      end if;
    elsif new.therapy_profile is distinct from old.therapy_profile
       or new.plan_pagado_visto_at is distinct from old.plan_pagado_visto_at then
      raise exception 'El enfoque terapéutico solo se cambia en Configuración › Enfoque terapéutico'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_proteger_enfoque on profiles;
create trigger profiles_proteger_enfoque
  before insert or update on profiles
  for each row execute function proteger_enfoque_terapeutico();
