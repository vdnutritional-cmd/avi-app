-- Teléfono de contacto de la empresa en CONVENIO
-- Se muestra al paciente en la bienvenida (onboarding):
-- "contacta a tu terapeuta o a <empresa> al <telefono>"
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE convenio_empresas ADD COLUMN IF NOT EXISTS telefono TEXT;
