import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Registra un acceso a una ruta de API clínica en audit_log.
 * NOM-024-SSA3-2012 — trazabilidad de accesos a información clínica.
 *
 * Fire-and-forget: no bloquea la respuesta. Los errores se descartan
 * silenciosamente para no interrumpir el flujo clínico.
 */
export function logApiAccess(
  supabase: SupabaseClient,
  userId: string,
  path: string,
  method: string,
  metadata?: Record<string, unknown>
) {
  supabase
    .from('audit_log')
    .insert({
      usuario_id: userId,
      operacion: `API:${method}:${path}`,
      tabla: 'api_route',
      registro_id: null,
      datos_despues: { path, method, ...metadata },
    })
    .then(() => {})
    .catch(() => {})
}
