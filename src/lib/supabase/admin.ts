import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con clave de servicio (service_role).
 * Solo usar en rutas de servidor — NUNCA exponer al cliente.
 * Bypassa RLS y permite operaciones de administración.
 *
 * Variables de entorno requeridas en Vercel (Settings → Environment Variables):
 *   SUPABASE_URL          — mismo valor que NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY — clave service_role del proyecto
 *
 * Nota: se usa SUPABASE_URL (sin prefijo NEXT_PUBLIC_) porque en Next.js 16
 * con Turbopack las variables NEXT_PUBLIC_ no se propagan a módulos
 * puramente server-side que importan @supabase/supabase-js directamente.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      'SUPABASE_URL no está configurada en Vercel. ' +
      'Agregar en Settings → Environment Variables con el mismo valor que NEXT_PUBLIC_SUPABASE_URL.'
    )
  }
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no está configurada en Vercel. ' +
      'Agregar en Settings → Environment Variables.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
