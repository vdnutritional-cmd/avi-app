// ─────────────────────────────────────────────────────────────
// Qué palabras ve cada quien (política de José Luis, 14 oct 2026).
// Diccionario en src/lib/terminologia.ts. Solo servidor (cliente admin).
//
//   - Una persona (paciente / asesorado), y todo lo que el terapeuta ve dentro de
//     ella (AVI-ESENCIAL, AVI-CLÍNICO, sus reportes): la terminología de su empresa.
//     Sin empresa → la que eligió su terapeuta en "Cómo me nombran" (profiles.terminologia).
//   - Pantallas generales del terapeuta (menú, Dashboard, listas): una sola palabra.
//     'asesorado' si alguna de sus empresas (o "Cómo me nombran") es Asesorado,
//     porque las instituciones sin fines de lucro no pueden usar "paciente".
// ─────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarTerminologia, TERMINOLOGIA_SIN_EMPRESA, type Terminologia } from './terminologia'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

/** "Cómo me nombran" del terapeuta: palabras para sus personas sin empresa */
export async function getTerminologiaPropia(db: Db, therapistId: string): Promise<Terminologia> {
  const { data } = await db.from('profiles').select('terminologia').eq('id', therapistId).maybeSingle()
  return data?.terminologia ? normalizarTerminologia(data.terminologia) : TERMINOLOGIA_SIN_EMPRESA
}

/** Terminología de una empresa en CONVENIO */
export async function getTerminologiaEmpresa(db: Db, empresaId: string): Promise<Terminologia> {
  const { data } = await db.from('convenio_empresas').select('terminologia').eq('id', empresaId).maybeSingle()
  return normalizarTerminologia(data?.terminologia)
}

/** Vínculo con terapeuta + empresa → terminología (sin empresa: "Cómo me nombran" del terapeuta) */
export async function terminologiaDeVinculo(
  db: Db, vinculo: { therapist_id: string; empresa_id: string | null } | null | undefined,
): Promise<Terminologia> {
  if (!vinculo) return TERMINOLOGIA_SIN_EMPRESA
  return vinculo.empresa_id
    ? getTerminologiaEmpresa(db, vinculo.empresa_id)
    : getTerminologiaPropia(db, vinculo.therapist_id)
}

/** Persona que se registra (QR o código) con su terapeuta y, si la hay, su empresa */
export async function getTerminologiaRegistro(db: Db, therapistId: string, empresaId: string | null): Promise<Terminologia> {
  return terminologiaDeVinculo(db, { therapist_id: therapistId, empresa_id: empresaId })
}

/** Lo que ve un paciente: su vínculo activo más reciente */
export async function getTerminologiaPaciente(db: Db, patientId: string): Promise<Terminologia> {
  const { data: vinculos } = await db
    .from('therapist_patients')
    .select('therapist_id, empresa_id, is_active, created_at')
    .eq('patient_id', patientId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
  const rel = (vinculos ?? []).find(v => v.is_active) ?? vinculos?.[0]
  return terminologiaDeVinculo(db, rel)
}

/** Lo que ve el terapeuta dentro de una persona suya (AVI-ESENCIAL, AVI-CLÍNICO, reportes) */
export async function getTerminologiaPersona(db: Db, therapistId: string, patientId: string): Promise<Terminologia> {
  const { data: vinculo } = await db
    .from('therapist_patients')
    .select('therapist_id, empresa_id')
    .eq('therapist_id', therapistId)
    .eq('patient_id', patientId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return vinculo ? terminologiaDeVinculo(db, vinculo) : getTerminologiaPropia(db, therapistId)
}

/** Pantallas generales del terapeuta: 'asesorado' si alguna empresa suya (o "Cómo me nombran") lo es */
export async function getTerminologiaTerapeuta(db: Db, therapistId: string): Promise<Terminologia> {
  const [propia, { data: vinculos }, { data: rels }] = await Promise.all([
    getTerminologiaPropia(db, therapistId),
    db.from('therapist_patients').select('empresa_id').eq('therapist_id', therapistId).neq('status', 'archived'),
    db.from('therapist_empresa').select('empresa_id').eq('therapist_id', therapistId),
  ])
  if (propia === 'asesorado') return 'asesorado'

  const empresaIds = [...new Set(
    [...(vinculos ?? []), ...(rels ?? [])].map(v => v.empresa_id as string | null).filter((id): id is string => !!id)
  )]
  if (empresaIds.length === 0) return propia
  const { data: empresas } = await db.from('convenio_empresas').select('terminologia').in('id', empresaIds)
  return (empresas ?? []).some(e => normalizarTerminologia(e.terminologia) === 'asesorado') ? 'asesorado' : propia
}

/** Reportes de Administración (una o varias empresas): 'asesorado' si alguna lo es */
export async function getTerminologiaEmpresas(db: Db, empresaIds: string[]): Promise<Terminologia> {
  if (empresaIds.length === 0) return normalizarTerminologia(null)
  const { data: empresas } = await db.from('convenio_empresas').select('terminologia').in('id', empresaIds)
  return (empresas ?? []).some(e => normalizarTerminologia(e.terminologia) === 'asesorado') ? 'asesorado' : 'paciente'
}
