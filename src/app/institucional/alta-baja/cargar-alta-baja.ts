// ─────────────────────────────────────────────────────────────
// Datos de Alta/Baja de <Pros> (solo servidor, cliente admin).
// Muestra los terapeutas que ya están en las empresas que administra la persona
// (opción b). De cada uno: sus empresas de esa lista (pacientes y fecha de alta),
// cuántas OTRAS empresas tiene (sin nombres), registro en AVI, último acceso y
// última sesión AVI de sus pacientes en esas empresas.
// ─────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

export interface EmpresaAdministrada { id: string; nombre: string }

export interface ProEnEmpresa { empresaId: string; nombre: string; desde: string; pacientes: number }

export interface ProAltaBaja {
  therapistId: string
  nombre: string
  email: string
  registroAvi: string | null
  ultimoAcceso: string | null
  ultimaSesionPac: string | null
  empresas: ProEnEmpresa[]
  otrasEmpresas: number
}

export async function cargarAltaBaja(admin: Db, empresas: EmpresaAdministrada[]): Promise<ProAltaBaja[]> {
  const ids = empresas.map(e => e.id)
  if (ids.length === 0) return []
  const nombreEmpresa = new Map(empresas.map(e => [e.id, e.nombre]))

  const { data: rels } = await admin
    .from('therapist_empresa')
    .select('therapist_id, empresa_id, created_at')
    .in('empresa_id', ids)
  const therapistIds = [...new Set((rels ?? []).map(r => r.therapist_id as string))]
  if (therapistIds.length === 0) return []

  const [{ data: perfiles }, { data: todasRels }, { data: vinculos }] = await Promise.all([
    admin.from('profiles').select('id, full_name, email, created_at').in('id', therapistIds),
    admin.from('therapist_empresa').select('therapist_id, empresa_id').in('therapist_id', therapistIds),
    admin.from('therapist_patients').select('therapist_id, patient_id, empresa_id')
      .in('therapist_id', therapistIds).in('empresa_id', ids).eq('is_active', true),
  ])

  // Última sesión AVI de los pacientes de cada terapeuta en estas empresas
  const pacientesPorPro = new Map<string, string[]>()
  for (const v of vinculos ?? []) {
    const lista = pacientesPorPro.get(v.therapist_id) ?? []
    lista.push(v.patient_id)
    pacientesPorPro.set(v.therapist_id, lista)
  }
  const todosPacientes = [...new Set((vinculos ?? []).map(v => v.patient_id as string))]
  const { data: sesiones } = todosPacientes.length
    ? await admin.from('sessions').select('patient_id, started_at').in('patient_id', todosPacientes)
        .order('started_at', { ascending: false }).limit(2000)
    : { data: [] }
  const ultimaPorPaciente = new Map<string, string>()
  for (const s of sesiones ?? []) if (!ultimaPorPaciente.has(s.patient_id)) ultimaPorPaciente.set(s.patient_id, s.started_at)

  const accesos = await Promise.all(therapistIds.map(async id => {
    const { data } = await admin.auth.admin.getUserById(id)
    return [id, data?.user?.last_sign_in_at ?? null] as const
  }))
  const ultimoAcceso = new Map(accesos)

  return therapistIds.map(id => {
    const p = (perfiles ?? []).find(x => x.id === id)
    const propias = (rels ?? []).filter(r => r.therapist_id === id)
    const total = (todasRels ?? []).filter(r => r.therapist_id === id).length
    const fechasPac = (pacientesPorPro.get(id) ?? []).map(pid => ultimaPorPaciente.get(pid)).filter((f): f is string => !!f)
    return {
      therapistId: id,
      nombre: p?.full_name || p?.email || '—',
      email: p?.email ?? '',
      registroAvi: p?.created_at ?? null,
      ultimoAcceso: ultimoAcceso.get(id) ?? null,
      ultimaSesionPac: fechasPac.sort().at(-1) ?? null,
      empresas: propias.map(r => ({
        empresaId: r.empresa_id,
        nombre: nombreEmpresa.get(r.empresa_id) ?? '',
        desde: r.created_at,
        pacientes: (vinculos ?? []).filter(v => v.therapist_id === id && v.empresa_id === r.empresa_id).length,
      })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
      otrasEmpresas: Math.max(0, total - propias.length),
    }
  }).sort((a, b) => a.nombre.localeCompare(b.nombre))
}
