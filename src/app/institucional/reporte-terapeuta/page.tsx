import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FiltrosReporte from './FiltrosReporte'
import PrintEstadisticasButton from '@/app/therapist/estadisticas/PrintEstadisticasButton'

export const dynamic = 'force-dynamic'

const TIPOS_DERIVACION = [
  'Psicólogo', 'Psiquiatra', 'Especialista en Adicciones',
  'Ginecólogo', 'Urólogo', 'Otro Médico de la salud',
]

function nombreMesLargo(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}
function mesAnteriorStr(year: number, month: number) {
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
}
function mesSiguienteStr(year: number, month: number) {
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
}

export default async function ReporteTerapeutaPage({
  searchParams,
}: {
  searchParams: Promise<{ empresaId?: string; terapeutaId?: string; mes?: string; tipo?: string; pid?: string }>
}) {
  const { empresaId: empParam, terapeutaId: terapParam, mes, tipo: tipoParam, pid: pidParam } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  // Verificar que es PI activo
  const { data: piRecords } = await admin
    .from('convenio_personas_institucionales')
    .select('empresa_id, convenio_empresas(nombre, logo_url)')
    .eq('therapist_id', user.id)
    .eq('is_active', true)

  if (!piRecords || piRecords.length === 0) redirect('/institucional/dashboard')

  // Perfil de la PI (para "Reporte impreso por")
  const { data: piProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()
  const piNombre = piProfile?.full_name || piProfile?.email || 'Persona Institucional'

  // Empresas de la PI
  const empresas = piRecords.map(r => {
    const e = r.convenio_empresas as { nombre?: string; logo_url?: string | null } | null
    return { id: r.empresa_id as string, nombre: e?.nombre ?? 'Empresa', logo_url: e?.logo_url ?? null }
  })

  const empresaId = empParam ?? ''
  const empresaActual = empresas.find(e => e.id === empresaId)

  // ── Validar mes antes de cualquier early return ────────────────────────────
  const now = new Date()
  const defaultMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const validMes = (mes && /^\d{4}-\d{2}$/.test(mes)) ? mes : defaultMes

  // Terapeutas de la empresa seleccionada
  type TerapeutaRow = { id: string; nombre: string; email: string }
  let terapeutas: TerapeutaRow[] = []
  if (empresaId) {
    const [{ data: teRels }, { data: piTer }] = await Promise.all([
      admin.from('therapist_empresa')
        .select('therapist_id, profiles!therapist_id(full_name, email)')
        .eq('empresa_id', empresaId),
      admin.from('convenio_personas_institucionales')
        .select('therapist_id, profiles!therapist_id(full_name, email)')
        .eq('empresa_id', empresaId)
        .eq('opera_como_terapeuta', true)
        .eq('is_active', true),
    ])
    const tMap = new Map<string, TerapeutaRow>()
    for (const r of [...(teRels ?? []), ...(piTer ?? [])]) {
      if (!tMap.has(r.therapist_id as string)) {
        const p = r.profiles as { full_name?: string; email?: string } | null
        tMap.set(r.therapist_id as string, {
          id: r.therapist_id as string,
          nombre: p?.full_name ?? '',
          email: p?.email ?? '',
        })
      }
    }
    terapeutas = [...tMap.values()].sort((a, b) => (a.nombre || a.email).localeCompare(b.nombre || b.email))
  }

  // Si no hay empresa seleccionada, mostrar solo los filtros
  if (!empresaId) {
    return (
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte por Terapeuta</h1>
          <p className="text-gray-500 mt-1 text-sm">Selecciona empresa y terapeuta para generar el reporte.</p>
        </div>
        <FiltrosReporte
          basePath="/institucional/reporte-terapeuta"
          showTerapeutaFilter={true}
          empresas={empresas}
          terapeutas={[]}
          empresaId=""
          terapeutaId="all"
          tipo="activos"
          pid="all"
          mes={validMes}
          pacientes={[]}
        />
      </div>
    )
  }

  // ── Parámetros de fecha ────────────────────────────────────────────────────
  const [ySt, mSt] = validMes.split('-')
  const year = parseInt(ySt); const month = parseInt(mSt)
  const mesKey = `${year}-${String(month).padStart(2, '0')}`
  const mesInicio = `${mesKey}-01`
  const mesSiguiente = new Date(year, month, 1).toISOString().split('T')[0]
  const isCurrentMonth = mesKey === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const tipo = (['activos', 'inactivos', 'total'].includes(tipoParam ?? '') ? tipoParam : 'activos') as 'activos' | 'inactivos' | 'total'
  const terapeutaId = terapParam ?? 'all'
  const pid = pidParam ?? 'all'

  // ── IDs de terapeutas en scope ─────────────────────────────────────────────
  const therapistIds = terapeutaId === 'all'
    ? terapeutas.map(t => t.id)
    : [terapeutaId]

  if (therapistIds.length === 0) {
    return (
      <div className="max-w-3xl space-y-8">
        <div><h1 className="text-2xl font-bold text-gray-900">Reporte por Terapeuta</h1></div>
        <FiltrosReporte basePath="/institucional/reporte-terapeuta" showTerapeutaFilter={true}
          empresas={empresas} terapeutas={terapeutas} empresaId={empresaId} terapeutaId={terapeutaId}
          tipo={tipo} pid={pid} mes={mesKey} pacientes={[]} />
        <p className="text-sm text-gray-400 text-center py-8">No hay terapeutas registrados en esta empresa.</p>
      </div>
    )
  }

  // ── 1. Pacientes en scope ──────────────────────────────────────────────────
  let relacionesQuery = admin
    .from('therapist_patients')
    .select('patient_id, is_active, empresa_id, sensacion_paciente_inicial, initial_note_date, initial_note_pro_bono, initial_note, status, convenio_empresas(nombre)')
    .eq('empresa_id', empresaId)
    .in('therapist_id', therapistIds)

  if (tipo === 'activos') relacionesQuery = relacionesQuery.eq('is_active', true).neq('status', 'archived')
  else if (tipo === 'inactivos') relacionesQuery = relacionesQuery.eq('is_active', false).neq('status', 'archived')
  else relacionesQuery = relacionesQuery.neq('status', 'archived') // total: activos + inactivos sin archivados

  const { data: relaciones } = await relacionesQuery
  const pacienteIds = (relaciones ?? []).map(r => r.patient_id as string)

  const { data: profiles } = pacienteIds.length > 0
    ? await admin.from('profiles').select('id, full_name, email').in('id', pacienteIds)
    : { data: [] }

  const nombreByPatient: Record<string, string> = {}
  for (const p of profiles ?? []) nombreByPatient[p.id] = p.full_name ?? p.email ?? p.id

  const empresaByPatient: Record<string, string> = {}
  for (const r of relaciones ?? []) {
    const e = r.convenio_empresas as { nombre?: string } | null
    empresaByPatient[r.patient_id as string] = e?.nombre ?? 'Sin empresa'
  }

  // ── 2. Sesiones del periodo ────────────────────────────────────────────────
  // pacienteIds ya excluye archivados para todos los tipos (activos/inactivos/total)
  if (pacienteIds.length === 0) {
    return renderPage({
      year, month, mesKey, isCurrentMonth, tipo, pid, terapeutaId,
      piNombre, empresas, terapeutas, empresaId, empresaActual,
      todasLasSesiones: [], pacientesEnPeriodoIds: [],
      relaciones: [], derivacionesRows: [], expedientesRows: [],
      todosActivosRows: [], derivActivosRows: [],
      empresaByPatient, nombreByPatient,
      sinConvenioSesiones: 0, sinConvenioPersonas: 0,
    })
  }

  const sesionesQuery = admin
    .from('therapist_session_notes')
    .select('patient_id, session_date, is_pro_bono, therapist_id')
    .in('therapist_id', therapistIds)
    .in('patient_id', pacienteIds)
    .gte('session_date', mesInicio)
    .lt('session_date', mesSiguiente)

  const notasIniQuery = admin
    .from('therapist_patients')
    .select('patient_id, initial_note_date, initial_note_pro_bono, initial_note')
    .in('therapist_id', therapistIds)
    .eq('empresa_id', empresaId)
    .neq('status', 'archived')
    .not('initial_note', 'is', null)
    .not('initial_note_date', 'is', null)
    .gte('initial_note_date', mesInicio)
    .lt('initial_note_date', mesSiguiente)
    .in('patient_id', pacienteIds)

  const [{ data: sesionesRows }, { data: notasRows }] = await Promise.all([sesionesQuery, notasIniQuery])

  type SesionRow = { patient_id: string; session_date: string; is_pro_bono: boolean }
  const todasLasSesiones: SesionRow[] = [
    ...(sesionesRows ?? []).map(s => ({ patient_id: s.patient_id as string, session_date: s.session_date as string, is_pro_bono: (s.is_pro_bono as boolean) ?? false })),
    ...(notasRows ?? []).map(n => ({ patient_id: n.patient_id as string, session_date: n.initial_note_date as string, is_pro_bono: (n.initial_note_pro_bono as boolean) ?? false })),
  ]

  const pacientesEnPeriodoSet = new Set(todasLasSesiones.map(s => s.patient_id))
  const pacientesEnPeriodoIds = [...pacientesEnPeriodoSet]

  // ── 3. Derivaciones y expedientes ─────────────────────────────────────────
  const [{ data: derivacionesRows }, { data: expedientesRows }] = await Promise.all([
    pacientesEnPeriodoIds.length > 0
      ? supabase.from('patient_derivaciones_cierres')
          .select('patient_id, derivacion_tipos, caso_riesgo, asistencia_seguimiento, atencion_especializada, percepcion_alivio, cambio_funcionamiento, abandono, sensacion_paciente_final')
          .in('therapist_id', therapistIds)
          .in('patient_id', pacientesEnPeriodoIds)
      : Promise.resolve({ data: [] }),
    pacientesEnPeriodoIds.length > 0
      ? supabase.from('patient_expediente')
          .select('patient_id, tipo_caso, problematica')
          .in('therapist_id', therapistIds)
          .in('patient_id', pacientesEnPeriodoIds)
      : Promise.resolve({ data: [] }),
  ])

  // ── 4. Todos los activos (satisfacción) ───────────────────────────────────
  const { data: todosActivosRows } = await admin
    .from('therapist_patients')
    .select('patient_id, sensacion_paciente_inicial')
    .in('therapist_id', therapistIds)
    .eq('empresa_id', empresaId)
    .eq('is_active', true)
    .neq('status', 'archived')

  const todosActivosIds = (todosActivosRows ?? []).map(r => r.patient_id as string)
  const { data: derivActivosRows } = todosActivosIds.length > 0
    ? await supabase.from('patient_derivaciones_cierres')
        .select('patient_id, sensacion_paciente_final')
        .in('therapist_id', therapistIds)
        .in('patient_id', todosActivosIds)
    : { data: [] }

  // ── 5. Pacientes SIN convenio (referencia de reconciliación) ──────────────
  let scQuery = admin
    .from('therapist_patients')
    .select('patient_id, is_active, status, initial_note_date, initial_note')
    .in('therapist_id', therapistIds)
    .is('empresa_id', null)

  if (tipo === 'activos') scQuery = scQuery.eq('is_active', true).neq('status', 'archived')
  else if (tipo === 'inactivos') scQuery = scQuery.eq('is_active', false).neq('status', 'archived')
  else scQuery = scQuery.neq('status', 'archived')

  const { data: scRels } = await scQuery
  const scPacIds = (scRels ?? []).map(r => r.patient_id as string)

  const { data: scSesRaw } = scPacIds.length > 0
    ? await admin.from('therapist_session_notes')
        .select('patient_id')
        .in('therapist_id', therapistIds)
        .in('patient_id', scPacIds)
        .gte('session_date', mesInicio)
        .lt('session_date', mesSiguiente)
    : { data: [] }

  const scNotasPacIds = (scRels ?? [])
    .filter(r => r.initial_note != null && r.initial_note_date != null &&
      (r.initial_note_date as string) >= mesInicio &&
      (r.initial_note_date as string) < mesSiguiente)
    .map(r => r.patient_id as string)

  const allScPacIds = [...(scSesRaw ?? []).map(s => s.patient_id as string), ...scNotasPacIds]
  const sinConvenioSesiones = allScPacIds.length
  const sinConvenioPersonas = new Set(allScPacIds).size

  return renderPage({
    year, month, mesKey, isCurrentMonth, tipo, pid, terapeutaId,
    piNombre, empresas, terapeutas, empresaId, empresaActual,
    todasLasSesiones, pacientesEnPeriodoIds,
    relaciones: relaciones ?? [],
    derivacionesRows: derivacionesRows ?? [],
    expedientesRows: expedientesRows ?? [],
    todosActivosRows: todosActivosRows ?? [],
    derivActivosRows: derivActivosRows ?? [],
    empresaByPatient, nombreByPatient,
    sinConvenioSesiones, sinConvenioPersonas,
  })
}

// ── Renderer ──────────────────────────────────────────────────────────────────

interface RenderProps {
  year: number; month: number; mesKey: string; isCurrentMonth: boolean
  tipo: 'activos' | 'inactivos' | 'total'; pid: string; terapeutaId: string
  piNombre: string
  empresas: { id: string; nombre: string; logo_url: string | null }[]
  terapeutas: { id: string; nombre: string; email: string }[]
  empresaId: string
  empresaActual: { id: string; nombre: string; logo_url: string | null } | undefined
  todasLasSesiones: { patient_id: string; session_date: string; is_pro_bono: boolean }[]
  pacientesEnPeriodoIds: string[]
  relaciones: Record<string, unknown>[]
  derivacionesRows: Record<string, unknown>[]
  expedientesRows: Record<string, unknown>[]
  todosActivosRows: Record<string, unknown>[]
  derivActivosRows: Record<string, unknown>[]
  empresaByPatient: Record<string, string>
  nombreByPatient: Record<string, string>
  sinConvenioSesiones: number
  sinConvenioPersonas: number
}

function renderPage({
  year, month, mesKey, isCurrentMonth, tipo, pid, terapeutaId,
  piNombre, empresas, terapeutas, empresaId, empresaActual,
  todasLasSesiones, pacientesEnPeriodoIds,
  relaciones, derivacionesRows, expedientesRows,
  todosActivosRows, derivActivosRows,
  empresaByPatient, nombreByPatient,
  sinConvenioSesiones, sinConvenioPersonas,
}: RenderProps) {
  const archivedSet = new Set(relaciones.filter(r => r.status === 'archived').map(r => r.patient_id as string))
  const pacientesParaDropdown = pacientesEnPeriodoIds
    .filter(id => !archivedSet.has(id))
    .map(id => ({ id, nombre: nombreByPatient[id] ?? id }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const sesiones     = pid !== 'all' ? todasLasSesiones.filter(s => s.patient_id === pid)  : todasLasSesiones
  const derivaciones = pid !== 'all' ? derivacionesRows.filter(d => d.patient_id === pid)  : derivacionesRows
  const expedientes  = pid !== 'all' ? expedientesRows.filter(e => e.patient_id === pid)   : expedientesRows
  const periodoIds   = pid !== 'all' ? pacientesEnPeriodoIds.filter(id => id === pid)       : pacientesEnPeriodoIds

  const totalSesiones    = sesiones.length
  const personasAtendidas = new Set(sesiones.map(s => s.patient_id)).size

  const sesionesPorEmpresa: Record<string, number> = {}
  for (const s of sesiones) {
    const emp = empresaByPatient[s.patient_id] ?? 'Sin empresa'
    sesionesPorEmpresa[emp] = (sesionesPorEmpresa[emp] ?? 0) + 1
  }

  const motivoMap: Record<string, number> = {}
  for (const exp of expedientes) {
    const key = [exp.tipo_caso, exp.problematica].filter(Boolean).join(' / ')
    if (key) motivoMap[key] = (motivoMap[key] ?? 0) + 1
  }
  const motivoEntries = Object.entries(motivoMap).sort(([, a], [, b]) => b - a)

  const derivacionesPorTipo: Record<string, number> = {}
  let totalDerivaciones = 0
  for (const d of derivaciones) {
    for (const t of (Array.isArray(d.derivacion_tipos) ? d.derivacion_tipos as string[] : [])) {
      derivacionesPorTipo[t] = (derivacionesPorTipo[t] ?? 0) + 1
      totalDerivaciones++
    }
  }

  const casosRiesgo      = derivaciones.filter(d => d.caso_riesgo           === 'SI').length
  const asistSeguimiento = derivaciones.filter(d => d.asistencia_seguimiento === 'SI').length
  const percepcionAlivio = derivaciones.filter(d => d.percepcion_alivio      === 'SI').length
  const cambioFunc       = derivaciones.filter(d => d.cambio_funcionamiento  === 'SI').length
  const abandono         = derivaciones.filter(d => d.abandono               === true).length
  const atenEspecializada= derivaciones.filter(d => d.atencion_especializada === 'SI').length

  const totalActivos = todosActivosRows.length
  const finalPorPatient: Record<string, string> = {}
  for (const d of derivActivosRows) finalPorPatient[d.patient_id as string] = (d.sensacion_paciente_final as string) ?? 'n/a'

  const distInicial: Record<string, number> = {}
  const distFinal:   Record<string, number> = {}
  const KEYS = ['n/a','1','2','3','4','5','6','7','8','9','10']
  for (const k of KEYS) { distInicial[k] = 0; distFinal[k] = 0 }

  for (const r of todosActivosRows) {
    const ini = r.sensacion_paciente_inicial
    const ki  = ini != null ? String(ini) : 'n/a'
    distInicial[ki in distInicial ? ki : 'n/a']++
    const fin = finalPorPatient[r.patient_id as string] ?? 'n/a'
    distFinal[fin in distFinal ? fin : 'n/a']++
  }

  const relacionesByPid: Record<string, Record<string, unknown>> = {}
  for (const r of relaciones) relacionesByPid[r.patient_id as string] = r

  const calificaciones = periodoIds.filter(id => !archivedSet.has(id)).map(id => {
    const rel = relacionesByPid[id]
    const der = derivacionesRows.find(d => d.patient_id === id)
    return {
      pid: id,
      nombre: nombreByPatient[id] ?? id,
      inicial: rel?.sensacion_paciente_inicial != null ? String(rel.sensacion_paciente_inicial) : 'n/a',
      final: (der?.sensacion_paciente_final as string) ?? 'n/a',
    }
  }).sort((a, b) => a.nombre.localeCompare(b.nombre))

  const prevMes = mesAnteriorStr(year, month)
  const nextMes = mesSiguienteStr(year, month)
  const tipoLabel = tipo === 'activos' ? 'activos' : tipo === 'inactivos' ? 'inactivos' : 'activos + inactivos'

  const baseNavParams = (m: string) => {
    const sp = new URLSearchParams({ empresaId, terapeutaId, tipo, pid, mes: m })
    return `/institucional/reporte-terapeuta?${sp.toString()}`
  }

  const institucionRows = Object.entries(sesionesPorEmpresa)
    .map(([nombre, total]) => ({ nombre, total, pct: totalSesiones > 0 ? Math.round((total / totalSesiones) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)

  const empresasParaLogo = empresaActual
    ? [{ id: empresaActual.id, nombre: empresaActual.nombre, logo_url: empresaActual.logo_url }]
    : []

  const terapeutaLabel = terapeutaId === 'all'
    ? 'Total terapeutas'
    : (terapeutas.find(t => t.id === terapeutaId)?.nombre || terapeutas.find(t => t.id === terapeutaId)?.email || terapeutaId)

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reporte por Terapeuta</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {empresaActual?.nombre ?? '—'} · {terapeutaLabel} · pacientes {tipoLabel}
        </p>
      </div>

      {/* Filtros */}
      <FiltrosReporte
        basePath="/institucional/reporte-terapeuta"
        showTerapeutaFilter={true}
        empresas={empresas}
        terapeutas={terapeutas}
        empresaId={empresaId}
        terapeutaId={terapeutaId}
        tipo={tipo}
        pid={pid}
        mes={mesKey}
        pacientes={pacientesParaDropdown}
      />

      {/* Navegación de meses */}
      <div className="flex items-center gap-2">
        <Link href={baseNavParams(prevMes)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600">← ant.</Link>
        <span className="text-sm font-medium text-gray-700 capitalize min-w-[150px] text-center">{nombreMesLargo(year, month)}</span>
        <Link href={isCurrentMonth ? '#' : baseNavParams(nextMes)} className={`px-3 py-1.5 text-sm border rounded-xl transition-colors ${isCurrentMonth ? 'border-gray-100 text-gray-300 cursor-default' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>sig. →</Link>
      </div>

      {totalSesiones === 0 && (
        <EmptyCard text={`No hay sesiones en ${nombreMesLargo(year, month)} para los filtros seleccionados.`} />
      )}

      {totalSesiones > 0 && (
        <>
          <section className="space-y-3">
            <SectionTitle>Resumen del periodo</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Cantidad de sesiones" value={totalSesiones} accent />
              <KpiCard label="Personas atendidas" value={personasAtendidas} sub="Pacientes únicos con al menos 1 sesión" />
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>Sesiones por institución</SectionTitle>
            <TableSimple rows={institucionRows.map(r => [r.nombre, String(r.total), `${r.pct}%`])} headers={['Institución', 'Sesiones', '%']} />
            {sinConvenioSesiones > 0 && (
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-sm">
                <div>
                  <span className="text-gray-600 font-medium">Pacientes sin Convenio</span>
                  <span className="ml-2 text-xs text-gray-400">(referencia — no incluidos en totales del convenio)</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600 shrink-0">
                  <span className="font-semibold">{sinConvenioSesiones} ses.</span>
                  <span className="text-gray-300">·</span>
                  <span>{sinConvenioPersonas} personas</span>
                </div>
              </div>
            )}
          </section>

          {motivoEntries.length > 0 && (
            <section className="space-y-3">
              <SectionTitle>Motivo de consulta</SectionTitle>
              <TableSimple rows={motivoEntries.slice(0, 10).map(([k, v]) => [k, String(v)])} headers={['Tipo de caso / Problemática', 'Pacientes']} />
            </section>
          )}

          <section className="space-y-3">
            <SectionTitle>Derivaciones y Cierres</SectionTitle>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Derivaciones</p>
              {TIPOS_DERIVACION.map(t => (
                <div key={t} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t}</span>
                  <span className={`font-semibold ${(derivacionesPorTipo[t] ?? 0) > 0 ? 'text-primary-600' : 'text-gray-300'}`}>{derivacionesPorTipo[t] ?? 0}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-3">
                <span className="font-semibold text-gray-700">Total derivaciones</span>
                <span className="font-bold text-primary-600">{totalDerivaciones}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard label="Casos de riesgo"            value={casosRiesgo}       color="red"   />
              <MetricCard label="Asistencia de seguimiento"  value={asistSeguimiento}               />
              <MetricCard label="Percepción de alivio"       value={percepcionAlivio}  color="green" />
              <MetricCard label="Cambios en funcionamiento"  value={cambioFunc}                     />
              <MetricCard label="Abandono"                   value={abandono}          color="amber" />
              <MetricCard label="Atención especializada"     value={atenEspecializada} color="blue"  />
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>Satisfacción del asesorado <span className="ml-1 text-xs font-normal text-gray-400 normal-case">todos los activos ({totalActivos})</span></SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ScoreCard title="Calificación inicial" dist={distInicial} total={totalActivos} />
              <ScoreCard title="Calificación final"   dist={distFinal}   total={totalActivos} />
            </div>
          </section>

          {calificaciones.length > 0 && (
            <section className="space-y-3">
              <SectionTitle>Calificación inicial y final por paciente</SectionTitle>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50"><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Paciente</th><th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Cal. Inicial</th><th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Cal. Final</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {calificaciones.map(c => (
                      <tr key={c.pid} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-700">{c.nombre}</td>
                        <td className="px-5 py-3 text-center"><ScoreBadge value={c.inicial} /></td>
                        <td className="px-5 py-3 text-center"><ScoreBadge value={c.final}   /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="flex justify-end pt-2">
            <PrintEstadisticasButton
              terapeutaNombre={terapeutaLabel}
              empresas={empresasParaLogo}
              mes={nombreMesLargo(year, month)}
              tipoLabel={tipoLabel}
              totalSesiones={totalSesiones}
              personasAtendidas={personasAtendidas}
              institucionRows={institucionRows}
              motivoEntries={motivoEntries}
              totalDerivaciones={totalDerivaciones}
              derivacionesPorTipo={derivacionesPorTipo}
              casosRiesgo={casosRiesgo}
              asistSeguimiento={asistSeguimiento}
              percepcionAlivio={percepcionAlivio}
              cambioFunc={cambioFunc}
              abandono={abandono}
              atenEspecializada={atenEspecializada}
              calificaciones={calificaciones}
              reportTitle="Reporte por Terapeuta"
              impresoPor={piNombre}
            />
          </div>
        </>
      )}
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{children}</h2>
}

function KpiCard({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? 'bg-primary-50 border border-primary-100' : 'bg-white border border-gray-100'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-primary-600' : 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function MetricCard({ label, value, color = 'default' }: { label: string; value: number; color?: 'red' | 'green' | 'amber' | 'blue' | 'default' }) {
  const colors = { red: 'text-red-600 bg-red-50 border-red-100', green: 'text-green-600 bg-green-50 border-green-100', amber: 'text-amber-600 bg-amber-50 border-amber-100', blue: 'text-blue-600 bg-blue-50 border-blue-100', default: 'text-gray-800 bg-white border-gray-100' }
  return (
    <div className={`rounded-2xl p-4 border ${colors[color]}`}>
      <p className="text-xs text-gray-500 mb-1 leading-tight">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center"><p className="text-sm text-gray-400">{text}</p></div>
}

function TableSimple({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="bg-gray-50">{headers.map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-50">{rows.map((r, i) => <tr key={i} className="hover:bg-gray-50">{r.map((c, j) => <td key={j} className="px-5 py-3 text-gray-700">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function ScoreCard({ title, dist, total }: { title: string; dist: Record<string, number>; total: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
      {['n/a','1','2','3','4','5','6','7','8','9','10'].map(v => {
        const count = dist[v] ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        return (
          <div key={v} className="flex items-center gap-2 text-xs">
            <span className={`w-8 text-right shrink-0 font-medium ${v === 'n/a' ? 'text-gray-300' : 'text-gray-600'}`}>{v}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              {count > 0 && <div className="h-3 rounded-full bg-primary-400" style={{ width: `${Math.max(pct, 4)}%` }} />}
            </div>
            <span className="w-6 text-right shrink-0 text-gray-500">{count}</span>
          </div>
        )
      })}
      <div className="flex justify-between text-xs text-gray-400 border-t border-gray-100 pt-2">
        <span>Total</span>
        <span className="font-semibold text-gray-700">{Object.values(dist).reduce((a, b) => a + b, 0)}</span>
      </div>
    </div>
  )
}

function ScoreBadge({ value }: { value: string }) {
  if (value === 'n/a') return <span className="text-xs text-gray-300 font-medium">n/a</span>
  const num = parseInt(value, 10)
  const color = num >= 8 ? 'bg-green-100 text-green-700' : num >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{value}</span>
}
