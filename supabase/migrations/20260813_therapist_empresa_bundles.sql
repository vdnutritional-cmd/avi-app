-- ─────────────────────────────────────────────────────────────
-- Migración: empresas por terapeuta + bloques de cupo de pacientes
-- Fecha: 2026-08-13
-- ─────────────────────────────────────────────────────────────

-- 1. therapist_empresa
--    Relación muchos-a-muchos entre terapeutas y empresas en CONVENIO.
--    Un terapeuta puede participar en varias empresas.
CREATE TABLE IF NOT EXISTS therapist_empresa (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  empresa_id   uuid NOT NULL REFERENCES convenio_empresas(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, empresa_id)
);

ALTER TABLE therapist_empresa ENABLE ROW LEVEL SECURITY;

-- El terapeuta puede leer sus propias asociaciones
CREATE POLICY "therapist_read_own_empresas"
  ON therapist_empresa FOR SELECT
  USING (auth.uid() = therapist_id);

-- Service role (webhooks, admin) tiene acceso total
CREATE POLICY "service_role_all_therapist_empresa"
  ON therapist_empresa FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- 2. therapist_slot_bundles
--    Cada compra de plan genera un bloque de cupo de pacientes.
--    Un terapeuta puede tener varios bloques activos en paralelo:
--      - uno por empresa en convenio
--      - uno o más paquetes regulares propios
--    La capacidad total = SUM(patient_slots) de todos los bloques activos.
CREATE TABLE IF NOT EXISTS therapist_slot_bundles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 'convenio'     = plan con descuento o patrocinio de empresa
  -- 'regular'      = plan pagado por el terapeuta sin convenio
  -- 'free_approved'= plan gratuito aprobado por el admin
  source_type   text NOT NULL CHECK (source_type IN ('convenio', 'regular', 'free_approved')),
  empresa_id    uuid REFERENCES convenio_empresas(id) ON DELETE SET NULL,
  patient_slots int NOT NULL DEFAULT 0,
  -- 0 = precio normal, 50 = 50% descuento, 100 = patrocinado (sin costo)
  discount_pct  int NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  stripe_sub_id text,     -- ID de suscripción Stripe si aplica
  notes         text,     -- notas del admin
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE therapist_slot_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "therapist_read_own_bundles"
  ON therapist_slot_bundles FOR SELECT
  USING (auth.uid() = therapist_id);

CREATE POLICY "service_role_all_bundles"
  ON therapist_slot_bundles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- 3. Vincular pacientes a su empresa/bundle específico
--    empresa_id: a qué empresa en convenio pertenece este paciente (si aplica)
--    bundle_id:  de qué bloque de cupo proviene el slot de este paciente
ALTER TABLE therapist_patients
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES convenio_empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bundle_id  uuid REFERENCES therapist_slot_bundles(id) ON DELETE SET NULL;
