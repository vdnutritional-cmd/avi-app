import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con clave de servicio (service_role).
 * Solo usar en rutas de servidor — NUNCA exponer al cliente.
 * Bypassa RLS y permite operaciones de administración.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
