-- Agrega flag de sesiones AVI ilimitadas por paciente (default: false)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS unlimited_avi_sessions boolean NOT NULL DEFAULT false;

-- Activar para TEST Jose (test@vdproducts.net)
UPDATE profiles
SET unlimited_avi_sessions = true
WHERE email = 'test@vdproducts.net';
