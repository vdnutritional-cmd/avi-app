import type { SupabaseClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Registra un acceso a una ruta de API clínica en audit_log.
 * NOM-024-SSA3-2012 — trazabilidad de accesos a información clínica.
 *
 * No bloquea la respuesta: se guarda con after() al terminar la petición.
 * Los errores no interrumpen el flujo clínico, pero se reportan en los logs.
 *
 * Fix 17 oct 2026: antes era `void supabase.from('audit_log').insert(...)` y la
 * consulta nunca se enviaba (Supabase solo la ejecuta al esperar su resultado):
 * audit_log no tenía ni un registro "API:". Ahora usa el cliente de servicio
 * (sin depender de las cookies después de responder). `_supabase` se conserva
 * para no cambiar a quienes la llaman.
 */
export function logApiAccess(
  _supabase: SupabaseClient,
  userId: string,
  path: string,
  method: string,
  metadata?: Record<string, unknown>
) {
  const registrar = async () => {
    const { error } = await createAdminClient()
      .from('audit_log')
      .insert({
        usuario_id: userId,
        operacion: `API:${method}:${path}`,
        tabla: 'api_route',
        registro_id: null,
        datos_despues: { path, method, ...metadata },
      })
    if (error) console.error('[audit] No se pudo registrar', path, error.message)
  }
  try {
    after(registrar)
  } catch {
    // Fuera de una petición (p. ej. un script): registrar directo
    void registrar()
  }
}
