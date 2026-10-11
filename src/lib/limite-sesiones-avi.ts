// ─────────────────────────────────────────────────────────────
// Sesiones AVI-Consúltame que puede iniciar un paciente (fuente única)
//
// Política (José Luis, 11 oct 2026):
//   - Límite según la "Frecuencia de las sesiones" de la Nota Inicial
//     (therapist_patients.frecuencia_config):
//       semanal → 3 · cada 2 semanas → 6 · mensual → 12 · sin definir → 5
//   - Periodo: desde la última sesión presencial con su terapeuta actual (si no
//     tiene, desde la Nota Inicial; si tampoco, desde su registro). Cada sesión
//     presencial nueva reinicia el contador; lo no usado NO se acumula.
//   - Solo mientras esté activo: bloqueado por inactividad, manualmente o por
//     falta de cupo / plan del terapeuta → no puede iniciar sesiones AVI.
//   - profiles.unlimited_avi_sessions = excepción sin límite.
// Se revisa en el servidor al iniciar una sesión (api/chat) y se muestra en la
// pantalla del paciente (api/patient/sesiones-avi). Solo servidor (cliente admin).
// ─────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAccesoTerapeuta } from './acceso-paciente'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

export const LIMITE_POR_FRECUENCIA: Record<string, number> = {
  semanal:        3,
  cada_2_semanas: 6,
  mensual:        12,
}
export const LIMITE_SIN_FRECUENCIA = 5

export type MotivoSesionesAvi = 'ok' | 'limite' | 'bloqueado' | 'sin_cupo' | 'sin_terapeuta'

export interface EstadoSesionesAvi {
  permitido: boolean
  motivo: MotivoSesionesAvi
  usadas: number
  /** null = sin límite (excepción) */
  limite: number | null
  frecuencia: string | null
  /** Inicio del periodo (YYYY-MM-DD) */
  desde: string | null
}

const fecha = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 10) : null)

export async function getEstadoSesionesAvi(db: Db, patientId: string): Promise<EstadoSesionesAvi> {
  const base = { usadas: 0, limite: null, frecuencia: null, desde: null }

  // Vínculo activo más reciente (un paciente transferido tiene vínculos archivados)
  const { data: vinculos } = await db
    .from('therapist_patients')
    .select('therapist_id, empresa_id, is_active, status, frecuencia_config, frecuencia_sesiones, initial_note_date, created_at')
    .eq('patient_id', patientId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  const activo = (vinculos ?? []).find(v => v.is_active)
  if (!activo) {
    return { ...base, permitido: false, motivo: (vinculos ?? []).length > 0 ? 'bloqueado' : 'sin_terapeuta' }
  }

  // Bloqueado por falta de cupo / plan (solo pacientes sin empresa: la empresa paga a los de CONVENIO)
  if (!activo.empresa_id) {
    const acceso = await getAccesoTerapeuta(db, activo.therapist_id as string)
    if (!acceso.indepPermitidos.has(patientId)) return { ...base, permitido: false, motivo: 'sin_cupo' }
  }

  const { data: perfil } = await db.from('profiles').select('unlimited_avi_sessions').eq('id', patientId).maybeSingle()
  if (perfil?.unlimited_avi_sessions) return { ...base, permitido: true, motivo: 'ok' }

  const frecuencia = ((activo.frecuencia_config ?? activo.frecuencia_sesiones) as string | null) || null
  const limite = (frecuencia && LIMITE_POR_FRECUENCIA[frecuencia]) || LIMITE_SIN_FRECUENCIA

  // Inicio del periodo: última sesión presencial con su terapeuta actual
  const { data: ultimaPresencial } = await db
    .from('therapist_session_notes')
    .select('session_date')
    .eq('patient_id', patientId)
    .eq('therapist_id', activo.therapist_id)
    .order('session_date', { ascending: false })
    .limit(1)
  const desde = fecha(ultimaPresencial?.[0]?.session_date) ?? fecha(activo.initial_note_date) ?? fecha(activo.created_at)

  // Sesiones AVI desde ese día (hora de México: UTC-6, sin horario de verano desde 2022)
  let q = db.from('sessions').select('*', { count: 'exact', head: true }).eq('patient_id', patientId)
  if (desde) q = q.gte('started_at', `${desde}T00:00:00-06:00`)
  const { count } = await q
  const usadas = count ?? 0

  return {
    permitido: usadas < limite,
    motivo: usadas < limite ? 'ok' : 'limite',
    usadas,
    limite,
    frecuencia,
    desde,
  }
}
