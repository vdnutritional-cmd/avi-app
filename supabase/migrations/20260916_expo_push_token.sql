-- Sprint 21 — Task #202
-- Agrega expo_push_token a profiles para notificaciones push nativas (Expo)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

COMMENT ON COLUMN profiles.expo_push_token IS
  'Token de Expo Push Notifications. Guardado por la app nativa AVI-TCA al iniciar sesión.
   Formato: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
   Null cuando el terapeuta no tiene la app nativa instalada o denegó el permiso.';
