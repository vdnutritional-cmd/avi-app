// ─────────────────────────────────────────────────────────────
// Terminología que ve un paciente: la de la empresa de su vínculo activo.
// Sin empresa → TERMINOLOGIA_SIN_EMPRESA (paciente / terapeuta / terapia).
// Solo servidor (cliente admin). Diccionario en src/lib/terminologia.ts.
// ─────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarTerminologia, TERMINOLOGIA_SIN_EMPRESA, type Terminologia } from './terminologia'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

export async function getTerminologiaPaciente(db: Db, patientId: string): Promise<Terminologia> {
  const { data: vinculos } = await db
    .from('therapist_patients')
    .select('empresa_id, is_active, created_at')
    .eq('patient_id', patientId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
  const rel = (vinculos ?? []).find(v => v.is_active) ?? vinculos?.[0]
  if (!rel?.empresa_id) return TERMINOLOGIA_SIN_EMPRESA

  const { data: empresa } = await db.from('convenio_empresas').select('terminologia').eq('id', rel.empresa_id).maybeSingle()
  return empresa ? normalizarTerminologia(empresa.terminologia) : TERMINOLOGIA_SIN_EMPRESA
}
