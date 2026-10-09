// Reporte Institucional General — misma lógica que reporte-terapeuta
// pero siempre agrega TODOS los terapeutas de la empresa (sin dropdown de terapeuta).
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FiltrosReporteGeneral from './FiltrosReporteGeneral'
import PrintEstadisticasButton from '@/app/therapist/estadisticas/PrintEstadisticasButton'
import { NIVELES_REPORTE_GENERAL } from '@/lib/niveles-institucionales'

export const dynamic = 'force-dynamic'

const TIPOS_DERIVACION = ['Psicólogo', 'Psiquiatra', 'Especialista en Adicciones', 'Ginecólogo', 'Urólogo', 'Otro Médico de la salud']

function nombreMesLargo(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}
function mesAnteriorStr(year: number, month: number) {
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
}
function mesSiguienteStr(year: number, month: number) {
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
}

export default async function ReporteGeneralPage({
  searchParams,
}: {
  searchParams: Promise<{ empresaIds?: string; mes?: string; tipo?: string; pid?: string }>
}) {
  const { empresaIds: empIdsParam, mes, tipo: tipoParam, pid: pidParam } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: piRecords } = await admin
    .from('convenio_personas_institucionales')
    .select('empresa_id, convenio_empresas(nombre, logo_url)')
    .eq('therapist_id', user.id)
    .eq('is_active', true)
    .in('nivel', NIVELES_REPORTE_GENERAL)   // solo empresas donde su nivel permite este reporte

  if (!piRecords || piRecords.length === 0) redirect('/institucional/dashboard')

  const { data: piProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()
  const piNombre = piProfile?.full_name || piProfile?.email || 'Persona Institucional'

  const empresas = piRecords.map(r => {
    const e = r.convenio_empresas as { nombre?: string; logo_url?: string | null } | null
    return { id: r.empresa_id as string, nombre: e?.nombre ?? 'Empresa', logo_url: e?.logo_url ?? null }
  })

  // Solo empresas permitidas para esta PI (nunca confiar en la URL)
  const selectedIds = (empIdsParam ? empIdsParam.split(',').filter(Boolean) : [])
    .filter(id => empresas.some(e => e.id === id))
  const empresasActuales = empresas.filter(e => selectedIds.includes(e.id))

  // ── Validar mes antes de cualquier early return ────────────────────────────
  const now = new Date()
  const defaultMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const validMes = (mes && /^\d{4}-\d{2}$/.test(mes)) ? mes : defaultMes

  if (selectedIds.length === 0) {
    return (
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte Institucional General</h1>
          <p className="text-gray-500 mt-1 text-sm">Selecciona una o más empresas para generar el reporte.</p>
        </div>
        <FiltrosReporteGeneral basePath="/institucional/reporte-general"
          empresas={empresas} empresaIdsSelected={[]}
          tipo="activos" pid="all" mes={validMes} pacientes={[]} />
      </div>
    )
  }

  // ── Todos los terapeutas de la empresa ────────────────────────────────────
  const [{ data: teRels }, { data: piTer }] = await Promise.all([
    admin.from('therapist_empresa').select('therapist_id').in('empresa_id', selectedIds),
    admin.from('convenio_personas_institucionales').select('therapist_id')
      .in('empresa_id', selectedIds).eq('opera_como_terapeuta', true).eq('is_active', true),
  ])
  const therapistIds = [...new Set([
    ...(teRels ?? []).map(r => r.therapist_id as string),
    ...(piTer ?? []).map(r => r.therapist_id as string),
  ])]

  // ── Parámetros de fecha ────────────────────────────────────────────────────
  const [ySt, mSt] = validMes.split('-')
  const year = parseInt(ySt); const month = parseInt(mSt)
  const mesKey = `${year}-${String(month).padStart(2, '0')}`
  const mesInicio = `${mesKey}-01`
  const mesSiguiente = new Date(year, month, 1).toISOString().split('T')[0]
  const isCurrentMonth = mesKey === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const tipo = (['activos', 'inactivos', 'total'].includes(tipoParam ?? '') ? tipoParam : 'activos') as 'activos' | 'inactivos' | 'total'
  const pid = pidParam ?? 'all'

  if (therapistIds.length === 0) {
    return (
      <div className="max-w-3xl space-y-8">
        <div><h1 className="text-2xl font-bold text-gray-900">Reporte Institucional General</h1></div>
        <FiltrosReporteGeneral basePath="/institucional/reporte-general"
          empresas={empresas} empresaIdsSelected={selectedIds}
          tipo={tipo} pid={pid} mes={mesKey} pacientes={[]} />
        <p className="text-sm text-gray-400 text-center py-8">No hay terapeutas registrados en las empresas seleccionadas.</p>
      </div>
    )
  }

  // ── Perfiles de terapeutas (para tabla Tipo de asesoría) ──────────────────
  const { data: terapeutaProfiles } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', therapistIds)
  const therapistNombres: Record<string, string> = {}
  for (const p of terapeutaProfiles ?? [])
    therapistNombres[p.id as string] = (p.full_name ?? p.email ?? p.id) as string

  // ── 1. Pacientes en scope ──────────────────────────────────────────────────
  let relacionesQuery = admin
    .from('therapist_patients')
    .select('patient_id, is_active, empresa_id, sensacion_paciente_inicial, initial_note_date, initial_note_pro_bono, initial_note, status, convenio_empresas(nombre)')
    .in('empresa_id', selectedIds)
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

  // ── 5. Pacientes SIN convenio (referencia) — ejecutar ANTES del early return
  // para que aparezca aunque no haya pacientes del convenio en el mes/tipo.
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

  // ── 2. Sesiones del periodo ────────────────────────────────────────────────
  // pacienteIds ya excluye archivados para todos los tipos (activos/inactivos/total)
  if (pacienteIds.length === 0) {
    return renderPage({ year, month, mesKey, isCurrentMonth, tipo, pid, piNombre, empresas, selectedIds, empresasActuales, todasLasSesiones: [], pacientesEnPeriodoIds: [], relaciones: [], derivacionesRows: [], expedientesRows: [], todosActivosRows: [], derivActivosRows: [], empresaByPatient, nombreByPatient, sinConvenioSesiones, sinConvenioPersonas, tipoAsesoriaRows: [] })
  }

  const sesionesQuery = admin
    .from('therapist_session_notes')
    .select('patient_id, session_date, is_pro_bono, is_virtual, therapist_id')
    .in('therapist_id', therapistIds)
    .in('patient_id', pacienteIds)
    .gte('session_date', mesInicio)
    .lt('session_date', mesSiguiente)

  const notasIniQuery = admin
    .from('therapist_patients')
    .select('patient_id, initial_note_date, initial_note_pro_bono, initial_note, therapist_id, initial_note_virtual')
    .in('therapist_id', therapistIds)
    .in('empresa_id', selectedIds)
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

  // ── 6. Tipo de asesoría por terapeuta ─────────────────────────────────────
  const tipoAsesoriaMap: Record<string, { nombre: string; total: number; virtuales: number; presenciales: number; proBono: number; facturables: number }> = {}
  for (const id of therapistIds) {
    tipoAsesoriaMap[id] = { nombre: therapistNombres[id] ?? id, total: 0, virtuales: 0, presenciales: 0, proBono: 0, facturables: 0 }
  }
  for (const s of sesionesRows ?? []) {
    const row = tipoAsesoriaMap[s.therapist_id as string]
    if (!row) continue
    row.total++
    if (s.is_virtual) row.virtuales++; else row.presenciales++
    if (s.is_pro_bono) row.proBono++; else row.facturables++
  }
  for (const n of notasRows ?? []) {
    const row = tipoAsesoriaMap[n.therapist_id as string]
    if (!row) continue
    row.total++
    const isVirtual = (n as Record<string, unknown>).initial_note_virtual as boolean ?? false
    if (isVirtual) row.virtuales++; else row.presenciales++
    if (n.initial_note_pro_bono) row.proBono++; else row.facturables++
  }
  const tipoAsesoriaRows = Object.values(tipoAsesoriaMap).sort((a, b) => a.nombre.localeCompare(b.nombre))

  const [{ data: derivacionesRows }, { data: expedientesRows }] = await Promise.all([
    pacientesEnPeriodoIds.length > 0
      ? supabase.from('patient_derivaciones_cierres')
          .select('patient_id, derivacion_tipos, caso_riesgo, asistencia_seguimiento, atencion_especializada, percepcion_alivio, cambio_funcionamiento, abandono, sensacion_paciente_final')
          .in('therapist_id', therapistIds).in('patient_id', pacientesEnPeriodoIds)
      : Promise.resolve({ data: [] }),
    pacientesEnPeriodoIds.length > 0
      ? supabase.from('patient_expediente')
          .select('patient_id, tipo_caso, problematica')
          .in('therapist_id', therapistIds).in('patient_id', pacientesEnPeriodoIds)
      : Promise.resolve({ data: [] }),
  ])

  const { data: todosActivosRows } = await admin
    .from('therapist_patients')
    .select('patient_id, sensacion_paciente_inicial')
    .in('therapist_id', therapistIds)
    .in('empresa_id', selectedIds)
    .eq('is_active', true)
    .neq('status', 'archived')

  const todosActivosIds = (todosActivosRows ?? []).map(r => r.patient_id as string)
  const { data: derivActivosRows } = todosActivosIds.length > 0
    ? await supabase.from('patient_derivaciones_cierres')
        .select('patient_id, sensacion_paciente_final')
        .in('therapist_id', therapistIds).in('patient_id', todosActivosIds)
    : { data: [] }

  return renderPage({
    year, month, mesKey, isCurrentMonth, tipo, pid,
    piNombre, empresas, selectedIds, empresasActuales,
    todasLasSesiones, pacientesEnPeriodoIds,
    relaciones: relaciones ?? [],
    derivacionesRows: derivacionesRows ?? [],
    expedientesRows: expedientesRows ?? [],
    todosActivosRows: todosActivosRows ?? [],
    derivActivosRows: derivActivosRows ?? [],
    empresaByPatient, nombreByPatient,
    sinConvenioSesiones, sinConvenioPersonas,
    tipoAsesoriaRows,
  })
}

// ── Renderer ──────────────────────────────────────────────────────────────────

interface RenderProps {
  year: number; month: number; mesKey: string; isCurrentMonth: boolean
  tipo: 'activos' | 'inactivos' | 'total'; pid: string
  piNombre: string
  empresas: { id: string; nombre: string; logo_url: string | null }[]
  selectedIds: string[]
  empresasActuales: { id: string; nombre: string; logo_url: string | null }[]
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
  tipoAsesoriaRows: { nombre: string; total: number; virtuales: number; presenciales: number; proBono: number; facturables: number }[]
}

function renderPage({
  year, month, mesKey, isCurrentMonth, tipo, pid,
  piNombre, empresas, selectedIds, empresasActuales,
  todasLasSesiones, pacientesEnPeriodoIds,
  relaciones, derivacionesRows, expedientesRows,
  todosActivosRows, derivActivosRows,
  empresaByPatient, nombreByPatient,
  sinConvenioSesiones, sinConvenioPersonas,
  tipoAsesoriaRows,
}: RenderProps) {
  const archivedSet = new Set(relaciones.filter(r => r.status === 'archived').map(r => r.patient_id as string))
  const pacientesParaDropdown = pacientesEnPeriodoIds
    .filter(id => !archivedSet.has(id))
    .map(id => ({ id, nombre: nombreByPatient[id] ?? id }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const sesiones     = pid !== 'all' ? todasLasSesiones.filter(s => s.patient_id === pid) : todasLasSesiones
  const derivaciones = pid !== 'all' ? derivacionesRows.filter(d => d.patient_id === pid) : derivacionesRows
  const expedientes  = pid !== 'all' ? expedientesRows.filter(e => e.patient_id === pid)  : expedientesRows
  const periodoIds   = pid !== 'all' ? pacientesEnPeriodoIds.filter(id => id === pid)      : pacientesEnPeriodoIds

  const totalSesiones     = sesiones.length
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
  for (const k of ['n/a','1','2','3','4','5','6','7','8','9','10']) { distInicial[k] = 0; distFinal[k] = 0 }
  for (const r of todosActivosRows) {
    const ini = r.sensacion_paciente_inicial
    distInicial[ini != null ? String(ini) : 'n/a']++
    const fin = finalPorPatient[r.patient_id as string] ?? 'n/a'
    distFinal[fin in distFinal ? fin : 'n/a']++
  }

  const relacionesByPid: Record<string, Record<string, unknown>> = {}
  for (const r of relaciones) relacionesByPid[r.patient_id as string] = r

  const calificaciones = periodoIds.filter(id => !archivedSet.has(id)).map(id => {
    const rel = relacionesByPid[id]
    const der = derivacionesRows.find(d => d.patient_id === id)
    return { pid: id, nombre: nombreByPatient[id] ?? id, inicial: rel?.sensacion_paciente_inicial != null ? String(rel.sensacion_paciente_inicial) : 'n/a', final: (der?.sensacion_paciente_final as string) ?? 'n/a' }
  }).sort((a, b) => a.nombre.localeCompare(b.nombre))

  const prevMes = mesAnteriorStr(year, month)
  const nextMes = mesSiguienteStr(year, month)
  const tipoLabel = tipo === 'activos' ? 'activos' : tipo === 'inactivos' ? 'inactivos' : 'activos + inactivos'

  const baseNavParams = (m: string) => {
    const sp = new URLSearchParams({ empresaIds: selectedIds.join(','), tipo, pid, mes: m })
    return `/institucional/reporte-general?${sp.toString()}`
  }

  const institucionRows = Object.entries(sesionesPorEmpresa)
    .map(([nombre, total]) => ({ nombre, total, pct: totalSesiones > 0 ? Math.round((total / totalSesiones) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)

  const empresasParaLogo = empresasActuales

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reporte Institucional General</h1>
        <p className="text-gray-500 mt-1 text-sm">{empresasActuales.map(e => e.nombre).join(' + ') || '—'} · Todos los terapeutas · pacientes {tipoLabel}</p>
      </div>

      <FiltrosReporteGeneral basePath="/institucional/reporte-general"
        empresas={empresas} empresaIdsSelected={selectedIds}
        tipo={tipo} pid={pid} mes={mesKey} pacientes={pacientesParaDropdown} />

      <div className="flex items-center gap-2">
        <Link href={baseNavParams(prevMes)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600">← ant.</Link>
        <span className="text-sm font-medium text-gray-700 capitalize min-w-[150px] text-center">{nombreMesLargo(year, month)}</span>
        <Link href={isCurrentMonth ? '#' : baseNavParams(nextMes)} className={`px-3 py-1.5 text-sm border rounded-xl transition-colors ${isCurrentMonth ? 'border-gray-100 text-gray-300 cursor-default' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>sig. →</Link>
      </div>

      {totalSesiones === 0 && (
        <EmptyCard text={`No hay sesiones en ${nombreMesLargo(year, month)} para los filtros seleccionados.`} />
      )}

      {totalSesiones === 0 && sinConvenioSesiones > 0 && (
        <section className="space-y-3">
          <SectionTitle destacado>Sesiones por institución</SectionTitle>
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
        </section>
      )}

      {totalSesiones > 0 && (
        <>
          <section className="space-y-3">
            <SectionTitle destacado>Resumen del periodo</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Cantidad de sesiones" value={totalSesiones} accent />
              <KpiCard label="Personas atendidas" value={personasAtendidas} sub="Pacientes únicos con al menos 1 sesión" />
            </div>
          </section>

          {tipoAsesoriaRows.length > 0 && (
            <section className="space-y-3">
              <SectionTitle>Tipo de asesoría por terapeuta</SectionTitle>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Terapeuta</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Virtuales</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Presenciales</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide border-l border-gray-100">Pro-Bono</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Facturables</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tipoAsesoriaRows.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700 font-medium">{r.nombre}</td>
                        <td className="px-4 py-3 text-right font-semibold text-primary-600">{r.total || ''}</td>
                        <td className="px-4 py-3 text-right text-blue-600">{r.virtuales || ''}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.presenciales || ''}</td>
                        <td className="px-4 py-3 text-right text-amber-600 border-l border-gray-100">{r.proBono || ''}</td>
                        <td className="px-4 py-3 text-right text-green-600">{r.facturables || ''}</td>
                      </tr>
                    ))}
                    {tipoAsesoriaRows.length > 0 && (() => {
                      const tot = tipoAsesoriaRows.reduce((a, r) => ({ total: a.total + r.total, virtuales: a.virtuales + r.virtuales, presenciales: a.presenciales + r.presenciales, proBono: a.proBono + r.proBono, facturables: a.facturables + r.facturables }), { total: 0, virtuales: 0, presenciales: 0, proBono: 0, facturables: 0 })
                      return (
                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                          <td className="px-4 py-3 font-semibold text-gray-700">Total</td>
                          <td className="px-4 py-3 text-right font-bold text-primary-600">{tot.total}</td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-600">{tot.virtuales}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-700">{tot.presenciales}</td>
                          <td className="px-4 py-3 text-right font-semibold text-amber-600 border-l border-gray-100">{tot.proBono}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">{tot.facturables}</td>
                        </tr>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <SectionTitle destacado>Sesiones por institución</SectionTitle>
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
            <SectionTitle destacado>Derivaciones</SectionTitle>
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
              <MetricCard label="Casos de riesgo"           value={casosRiesgo}       color="red"   />
              <MetricCard label="Asistencia de seguimiento" value={asistSeguimiento}               />
              <MetricCard label="Atención especializada"    value={atenEspecializada} color="blue"  />
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle destacado>Cierres</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard label="Cambios en funcionamiento" value={cambioFunc}                     />
              <MetricCard label="Percepción de alivio"      value={percepcionAlivio}  color="green" />
              <MetricCard label="Abandono"                  value={abandono}          color="amber" />
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
                        <td className="px-5 py-3 text-center"><ScoreBadge value={c.final} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="flex justify-end pt-2">
            <PrintEstadisticasButton
              terapeutaNombre="Total terapeutas"
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
              reportTitle="Reporte Institucional General"
              impresoPor={piNombre}
            />
          </div>
        </>
      )}
    </div>
  )
}

// ── Componentes auxiliares (mismo estilo que reporte-terapeuta) ───────────────

function SectionTitle({ children, destacado }: { children: React.ReactNode; destacado?: boolean }) {
  const cls = destacado
    ? 'text-sm font-bold text-primary-600 uppercase tracking-wide'
    : 'text-xs font-semibold text-gray-400 uppercase tracking-wide'
  return <h2 className={cls}>{children}</h2>
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
  return <div className={`rounded-2xl p-4 border ${colors[color]}`}><p className="text-xs text-gray-500 mb-1 leading-tight">{label}</p><p className="text-2xl font-bold">{value}</p></div>
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
        const count = dist[v] ?? 0; const pct = total > 0 ? Math.round((count / total) * 100) : 0
        return (
          <div key={v} className="flex items-center gap-2 text-xs">
            <span className={`w-8 text-right shrink-0 font-medium ${v === 'n/a' ? 'text-gray-300' : 'text-gray-600'}`}>{v}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">{count > 0 && <div className="h-3 rounded-full bg-primary-400" style={{ width: `${Math.max(pct, 4)}%` }} />}</div>
            <span className="w-6 text-right shrink-0 text-gray-500">{count}</span>
          </div>
        )
      })}
      <div className="flex justify-between text-xs text-gray-400 border-t border-gray-100 pt-2"><span>Total</span><span className="font-semibold text-gray-700">{Object.values(dist).reduce((a, b) => a + b, 0)}</span></div>
    </div>
  )
}
function ScoreBadge({ value }: { value: string }) {
  if (value === 'n/a') return <span className="text-xs text-gray-300 font-medium">n/a</span>
  const num = parseInt(value, 10)
  const color = num >= 8 ? 'bg-green-100 text-green-700' : num >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{value}</span>
}
