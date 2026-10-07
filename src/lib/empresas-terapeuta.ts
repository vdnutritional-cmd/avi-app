// Empresas CONVENIO activas a las que pertenece un terapeuta (therapist_empresa).
// Se usa para que un paciente solo pueda quedar ligado a empresas de su propio terapeuta.
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getEmpresasDeTerapeuta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  therapistId: string,
): Promise<{ id: string; nombre: string }[]> {
  const { data } = await db
    .from('therapist_empresa')
    .select('empresa_id, convenio_empresas(nombre, is_active)')
    .eq('therapist_id', therapistId)

  return (data ?? [])
    .flatMap(r => {
      const raw = r.convenio_empresas as { nombre?: string; is_active?: boolean } | { nombre?: string; is_active?: boolean }[] | null
      const e = Array.isArray(raw) ? raw[0] : raw
      return e?.is_active ? [{ id: r.empresa_id as string, nombre: e.nombre ?? '' }] : []
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}
