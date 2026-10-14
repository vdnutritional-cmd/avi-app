-- WhatsApp para solicitudes de alta de terapeutas (14 oct 2026)
-- Distinto del teléfono de contacto que ve el paciente (convenio_empresas.telefono).
-- Lo captura la empresa en Administración › Configuración Admin; lo usa el botón
-- "Solicita acceso a la empresa" de Planes y precios / Activar plan.
ALTER TABLE convenio_empresas
  ADD COLUMN IF NOT EXISTS telefono_solicitudes text;
