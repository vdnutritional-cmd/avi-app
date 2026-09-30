-- Sprint 10 — Cambio XII: Reportes Terapéuticos
-- Agregar logo_url a convenio_empresas para logos de empresas en CONVENIO

ALTER TABLE convenio_empresas
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Storage bucket empresa-logos (crear manualmente en Supabase Dashboard)
-- Dashboard → Storage → New bucket → nombre: "empresa-logos" → Public: ON
-- File size limit: 2MB | Allowed MIME: image/png, image/jpeg, image/webp
