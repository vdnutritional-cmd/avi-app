import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import FiltrosEstadisticas from './FiltrosEstadisticas'
import PrintEstadisticasButton from './PrintEstadisticasButton'

export const dynamic = 'force-dynamic'

// ── Helpers ───────────────────────────────────────────────────────────────────

function nombreMesLargo(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

function mesAnterior(year: number, month: number) {
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, '0')}`
}

function mesSiguienteStr(year: number, month: number) {
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`
}

const TIPOS_DERIVACION = [
  'Psicólogo',
  'Psiquiatra',
  'Especialista en Adicciones',
  'Ginecólogo',
  'Urólogo',
  'Otro Médico de la salud',
]

type Tipo = 'activos' | 'inactivos' | 'total'

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; tipo?: string; pid?: string }>
}) {
  const { mes, tipo: tipoParam, pid: pidParam } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin       = createAdminClient()
  const therapistId = user.id
  const tipo        = (['activos', 'inactivos', 'total'].includes(tipoParam ?? '')
    ? tipoParam
    : 'activos') as Tipo
  const pid         = pidParam ?? 'all'

  // ── Mes a mostrar ──────────────────────────────────────────────────────────
  const now = new Date()
  const [ySt, mSt] = (mes ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).split('-')
  const year  = parseInt(ySt)
  const month = parseInt(mSt)
  const mesKey = `${year}-${String(month).padStart(2, '0')}`

  const mesInicio    = `${mesKey}-01`
  const mesSiguiente = new Date(year, month, 1).toISOString().split('T')[0]
  const isCurrentMonth = mesKey === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // ── 1. Pacientes en scope (SIN filtrar por pid) ────────────────────────────
  // Siempre traemos todos los del tipo seleccionado para que el dropdown
  // refleje correctamente los pacientes con actividad en el mes.
  // El filtro por pid se aplica solo al calcular las estadísticas en pantalla.
  let relacionesQuery = admin
    .from('therapist_patients')
    .select('patient_id, is_active, empresa_id, sensacion_paciente_inicial, initial_note_date, initial_note_pro_bono, initial_note, status, convenio_empresas(nombre)')
    .eq('therapist_id', therapistId)

  if (tipo === 'activos') {
    relacionesQuery = relacionesQuery.eq('is_active', true).neq('status', 'archived')
  } else if (tipo === 'inactivos') {
    relacionesQuery = relacionesQuery.eq('is_active', false).neq('status', 'archived')
  }
  // tipo === 'total': sin filtros → incluye activos + inactivos + archivados

  const { data: relaciones } = await relacionesQuery

  // Nombre del terapeuta (para encabezado de impresión)
  const { data: therapistProfile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', therapistId)
    .single()
  const terapeutaNombre = (therapistProfile?.full_name || therapistProfile?.email || user.email || 'Terapeuta') as string

  // Empresas CONVENIO del terapeuta (para selector de logo al imprimir)
  const { data: empresaRels } = await admin
    .from('therapist_empresa')
    .select('empresa_id, convenio_empresas(nombre, logo_url)')
    .eq('therapist_id', therapistId)
  const empresasParaLogo = (empresaRels ?? []).map(r => {
    const e = r.convenio_empresas as { nombre?: string; logo_url?: string | null } | null
    return { id: r.empresa_id as string, nombre: e?.nombre ?? '', logo_url: e?.logo_url ?? null }
  })

  // Mapa patient_id → empresa nombre
  const empresaByPatient: Record<string, string> = {}
  for (const r of relaciones ?? []) {
    const empresaRow = r.convenio_empresas as { nombre?: string } | null
    empresaByPatient[r.patient_id as string] = empresaRow?.nombre ?? 'Sin empresa'
  }

  const pacienteIds = (relaciones ?? []).map(r => r.patient_id as string)

  // Nombres (via admin)
  const { data: profiles } = pacienteIds.length > 0
    ? await admin.from('profiles').select('id, full_name, email').in('id', pacienteIds)
    : { data: [] }

  const nombreByPatient: Record<string, string> = {}
  for (const p of profiles ?? []) {
    nombreByPatient[p.id] = p.full_name ?? p.email ?? p.id
  }

  // ── 2. Sesiones del periodo (siempre para todos los pacientes en scope) ────
  // Para tipo=total: sin filtro de patient_id (igual que Mis Asesorías)
  // Para activos/inactivos: filtrar por pacienteIds
  // En ambos casos ignoramos pid aquí — el filtro por pid va en renderPage

  const esTotal = tipo === 'total'

  let sesionesQuery = admin
    .from('therapist_session_notes')
    .select('patient_id, session_date, is_pro_bono')
    .eq('therapist_id', therapistId)
    .gte('session_date', mesInicio)
    .lt('session_date', mesSiguiente)

  // Notas iniciales: excluir archivados para evitar doble conteo con cuentas fusionadas
  let notasIniQuery = admin
    .from('therapist_patients')
    .select('patient_id, initial_note_date, initial_note_pro_bono, initial_note')
    .eq('therapist_id', therapistId)
    .neq('status', 'archived')
    .not('initial_note', 'is', null)
    .not('initial_note_date', 'is', null)
    .gte('initial_note_date', mesInicio)
    .lt('initial_note_date', mesSiguiente)

  if (!esTotal) {
    if (pacienteIds.length === 0) {
      // Sin pacientes en scope → página vacía
      return renderPage({
        year, month, mesKey, isCurrentMonth, tipo, pid,
        terapeutaNombre, empresasParaLogo,
        todasLasSesiones: [], pacientesEnPeriodoIds: [],
        relaciones: [],
        derivacionesRows: [], expedientesRows: [],
        todosActivosRows: [], derivActivosRows: [],
        empresaByPatient, nombreByPatient,
      })
    }
    sesionesQuery = sesionesQuery.in('patient_id', pacienteIds)
    notasIniQuery = notasIniQuery.in('patient_id', pacienteIds)
  }

  const [{ data: sesionesRows }, { data: notasRows }] = await Promise.all([
    sesionesQuery,
    notasIniQuery,
  ])

  type SesionRow = { patient_id: string; session_date: string; is_pro_bono: boolean }

  const todasLasSesiones: SesionRow[] = [
    ...(sesionesRows ?? []).map(s => ({
      patient_id:   s.patient_id as string,
      session_date: s.session_date as string,
      is_pro_bono:  (s.is_pro_bono as boolean) ?? false,
    })),
    ...(notasRows ?? []).map(n => ({
      patient_id:   n.patient_id as string,
      session_date: n.initial_note_date as string,
      is_pro_bono:  (n.initial_note_pro_bono as boolean) ?? false,
    })),
  ]

  // Pacientes únicos con sesión en el periodo (base para el dropdown)
  const pacientesEnPeriodoSet = new Set(todasLasSesiones.map(s => s.patient_id))
  const pacientesEnPeriodoIds = [...pacientesEnPeriodoSet]

  // ── 3. Derivaciones y expedientes ─────────────────────────────────────────
  // Traemos para TODOS los del periodo; el filtro por pid va en renderPage
  const [{ data: derivacionesRows }, { data: expedientesRows }] = await Promise.all([
    pacientesEnPeriodoIds.length > 0
      ? supabase
          .from('patient_derivaciones_cierres')
          .select('patient_id, derivacion_tipos, caso_riesgo, asistencia_seguimiento, atencion_especializada, percepcion_alivio, cambio_funcionamiento, abandono, sensacion_paciente_final')
          .eq('therapist_id', therapistId)
          .in('patient_id', pacientesEnPeriodoIds)
      : Promise.resolve({ data: [] }),
    pacientesEnPeriodoIds.length > 0
      ? supabase
          .from('patient_expediente')
          .select('patient_id, tipo_caso, problematica')
          .eq('therapist_id', therapistId)
          .in('patient_id', pacientesEnPeriodoIds)
      : Promise.resolve({ data: [] }),
  ])

  // ── 4. Todos los activos para Satisfacción (sin filtro de mes) ─────────────
  const { data: todosActivosRows } = await admin
    .from('therapist_patients')
    .select('patient_id, sensacion_paciente_inicial')
    .eq('therapist_id', therapistId)
    .eq('is_active', true)
    .neq('status', 'archived')

  const todosActivosIds = (todosActivosRows ?? []).map(r => r.patient_id as string)

  const { data: derivActivosRows } = todosActivosIds.length > 0
    ? await supabase
        .from('patient_derivaciones_cierres')
        .select('patient_id, sensacion_paciente_final')
        .eq('therapist_id', therapistId)
        .in('patient_id', todosActivosIds)
    : { data: [] }

  return renderPage({
    year, month, mesKey, isCurrentMonth, tipo, pid,
    terapeutaNombre, empresasParaLogo,
    todasLasSesiones, pacientesEnPeriodoIds,
    relaciones: relaciones ?? [],
    derivacionesRows: derivacionesRows ?? [],
    expedientesRows:  expedientesRows  ?? [],
    todosActivosRows: todosActivosRows ?? [],
    derivActivosRows: derivActivosRows ?? [],
    empresaByPatient,
    nombreByPatient,
  })
}

// ── Renderer ──────────────────────────────────────────────────────────────────

interface RenderProps {
  year: number
  month: number
  mesKey: string
  isCurrentMonth: boolean
  tipo: Tipo
  pid: string
  terapeutaNombre: string
  empresasParaLogo: { id: string; nombre: string; logo_url: string | null }[]
  todasLasSesiones: { patient_id: string; session_date: string; is_pro_bono: boolean }[]
  pacientesEnPeriodoIds: string[]
  relaciones: Record<string, unknown>[]
  derivacionesRows: Record<string, unknown>[]
  expedientesRows: Record<string, unknown>[]
  todosActivosRows: Record<string, unknown>[]
  derivActivosRows: Record<string, unknown>[]
  empresaByPatient: Record<string, string>
  nombreByPatient: Record<string, string>
}

function renderPage({
  year, month, mesKey, isCurrentMonth, tipo, pid,
  terapeutaNombre, empresasParaLogo,
  todasLasSesiones, pacientesEnPeriodoIds,
  relaciones, derivacionesRows, expedientesRows,
  todosActivosRows, derivActivosRows,
  empresaByPatient, nombreByPatient,
}: RenderProps) {

  // ── Dropdown: pacientes con sesiones en el mes, excluyendo archivados ──────
  const archivedSet = new Set(
    relaciones
      .filter(r => r.status === 'archived')
      .map(r => r.patient_id as string)
  )
  const pacientesParaDropdown = pacientesEnPeriodoIds
    .filter(id => !archivedSet.has(id))
    .map(id => ({ id, nombre: nombreByPatient[id] ?? id }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  // ── Filtro por pid (aplicado solo a las estadísticas en pantalla) ──────────
  const sesiones      = pid !== 'all' ? todasLasSesiones.filter(s => s.patient_id === pid)    : todasLasSesiones
  const derivaciones  = pid !== 'all' ? derivacionesRows.filter(d => d.patient_id === pid)    : derivacionesRows
  const expedientes   = pid !== 'all' ? expedientesRows.filter(e  => e.patient_id  === pid)   : expedientesRows
  const periodoIds    = pid !== 'all' ? pacientesEnPeriodoIds.filter(id => id === pid)         : pacientesEnPeriodoIds

  // ── Cálculos ───────────────────────────────────────────────────────────────

  // A) Sesiones por empresa
  const totalSesiones = sesiones.length
  const sesionesPorEmpresa: Record<string, number> = {}
  for (const s of sesiones) {
    const emp = empresaByPatient[s.patient_id] ?? 'Sin empresa'
    sesionesPorEmpresa[emp] = (sesionesPorEmpresa[emp] ?? 0) + 1
  }

  // B) Personas atendidas
  const personasAtendidas = new Set(sesiones.map(s => s.patient_id)).size

  // C) Motivo de consulta
  const motivoMap: Record<string, number> = {}
  for (const exp of expedientes) {
    const tc  = (exp.tipo_caso    as string) ?? ''
    const pr  = (exp.problematica as string) ?? ''
    if (!tc && !pr) continue
    const key = [tc, pr].filter(Boolean).join(' / ')
    motivoMap[key] = (motivoMap[key] ?? 0) + 1
  }
  const motivoEntries = Object.entries(motivoMap).sort(([, a], [, b]) => b - a)

  // D) Derivaciones
  const derivacionesPorTipo: Record<string, number> = {}
  let totalDerivaciones = 0
  for (const d of derivaciones) {
    const tipos = Array.isArray(d.derivacion_tipos) ? d.derivacion_tipos as string[] : []
    for (const t of tipos) {
      derivacionesPorTipo[t] = (derivacionesPorTipo[t] ?? 0) + 1
      totalDerivaciones++
    }
  }

  // E) Métricas de cierres
  const casosRiesgo       = derivaciones.filter(d => d.caso_riesgo           === 'SI').length
  const asistSeguimiento  = derivaciones.filter(d => d.asistencia_seguimiento === 'SI').length
  const percepcionAlivio  = derivaciones.filter(d => d.percepcion_alivio      === 'SI').length
  const cambioFunc        = derivaciones.filter(d => d.cambio_funcionamiento  === 'SI').length
  const abandono          = derivaciones.filter(d => d.abandono               === true).length
  const atenEspecializada = derivaciones.filter(d => d.atencion_especializada === 'SI').length

  // F) Satisfacción (siempre para todos los activos, sin filtro de mes/pid)
  const totalActivos = todosActivosRows.length

  const finalPorPatient: Record<string, string> = {}
  for (const d of derivActivosRows) {
    finalPorPatient[d.patient_id as string] = (d.sensacion_paciente_final as string) ?? 'n/a'
  }

  const distInicial: Record<string, number> = { 'n/a': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0 }
  const distFinal:   Record<string, number> = { 'n/a': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0 }

  for (const r of todosActivosRows) {
    const ini    = r.sensacion_paciente_inicial
    const keyIni = (ini !== null && ini !== undefined) ? String(ini) : 'n/a'
    distInicial[keyIni in distInicial ? keyIni : 'n/a']++

    const fin = finalPorPatient[r.patient_id as string] ?? 'n/a'
    distFinal[fin in distFinal ? fin : 'n/a']++
  }

  // G) Tabla calificación por paciente (pacientes del periodo con filtro pid)
  const relacionesByPid: Record<string, Record<string, unknown>> = {}
  for (const r of relaciones) relacionesByPid[r.patient_id as string] = r

  const calificaciones = periodoIds
    .filter(id => !archivedSet.has(id))
    .map(id => {
      const rel = relacionesByPid[id]
      const der = derivacionesRows.find(d => d.patient_id === id)
      return {
        pid: id,
        nombre: nombreByPatient[id] ?? id,
        inicial: rel?.sensacion_paciente_inicial !== null && rel?.sensacion_paciente_inicial !== undefined
          ? String(rel.sensacion_paciente_inicial) : 'n/a',
        final: (der?.sensacion_paciente_final as string) ?? 'n/a',
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  // ── Navegación de meses ────────────────────────────────────────────────────
  const prevMes    = mesAnterior(year, month)
  const nextMes    = mesSiguienteStr(year, month)
  const baseParams = (m: string) => `/therapist/estadisticas?mes=${m}&tipo=${tipo}&pid=${pid}`

  const tipoLabel = tipo === 'activos' ? 'activos' : tipo === 'inactivos' ? 'inactivos' : 'activos + inactivos'

  // ── Datos para botón de impresión ──────────────────────────────────────────
  const institucionRows = Object.entries(sesionesPorEmpresa)
    .map(([nombre, total]) => ({
      nombre,
      total,
      pct: totalSesiones > 0 ? Math.round((total / totalSesiones) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi estadística</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Información clínica y operativa de tu práctica · pacientes {tipoLabel}
        </p>
      </div>

      {/* ── Controles ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Navegación de meses */}
        <div className="flex items-center gap-2">
          <Link
            href={baseParams(prevMes)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
          >
            ← ant.
          </Link>
          <span className="text-sm font-medium text-gray-700 capitalize min-w-[150px] text-center">
            {nombreMesLargo(year, month)}
          </span>
          <Link
            href={isCurrentMonth ? '#' : baseParams(nextMes)}
            className={`px-3 py-1.5 text-sm border rounded-xl transition-colors ${
              isCurrentMonth
                ? 'border-gray-100 text-gray-300 cursor-default'
                : 'border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            sig. →
          </Link>
        </div>

        {/* Toggle activos/inactivos/total + dropdown filtrado por mes */}
        <FiltrosEstadisticas
          tipo={tipo}
          pid={pid}
          mes={mesKey}
          pacientes={pacientesParaDropdown}
        />
      </div>

      {/* ── Sin sesiones ───────────────────────────────────────────────────── */}
      {totalSesiones === 0 && (
        <EmptyCard text={`No hay sesiones registradas en ${nombreMesLargo(year, month)} para pacientes ${tipoLabel}${pid !== 'all' ? ' (paciente seleccionado)' : ''}.`} />
      )}

      {/* ── A. Resumen del periodo ─────────────────────────────────────────── */}
      {totalSesiones > 0 && (
        <section className="space-y-3">
          <SectionTitle>Resumen del periodo</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Cantidad de sesiones" value={totalSesiones} accent />
            <KpiCard label="Personas atendidas" value={personasAtendidas}
              sub="Pacientes únicos con al menos 1 sesión" />
          </div>
        </section>
      )}

      {/* ── B. Sesiones por institución ────────────────────────────────────── */}
      {totalSesiones > 0 && (
        <section className="space-y-3">
          <SectionTitle>Sesiones por institución</SectionTitle>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Institución</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Sesiones</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(sesionesPorEmpresa)
                  .sort(([, a], [, b]) => b - a)
                  .map(([emp, cnt]) => (
                    <tr key={emp} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-700">{emp}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-800">{cnt}</td>
                      <td className="px-5 py-3 text-right text-gray-400">
                        {Math.round((cnt / totalSesiones) * 100)}%
                      </td>
                    </tr>
                  ))}
                <tr className="bg-gray-50">
                  <td className="px-5 py-3 font-semibold text-gray-700">Total</td>
                  <td className="px-5 py-3 text-right font-semibold text-primary-600">{totalSesiones}</td>
                  <td className="px-5 py-3 text-right text-gray-400">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── C. Motivo de consulta ──────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionTitle>Motivo de consulta</SectionTitle>
        {motivoEntries.length === 0 ? (
          <EmptyCard text="Sin expedientes con tipo de caso o problemática registrada para el periodo." />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Tipo de caso / Problemática</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Pacientes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {motivoEntries.map(([key, cnt]) => (
                  <tr key={key} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-700">{key}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800">{cnt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── D. Derivaciones y Cierres ──────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionTitle>Derivaciones y Cierres</SectionTitle>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Derivaciones</p>
          {TIPOS_DERIVACION.map(t => (
            <div key={t} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{t}</span>
              <span className={`font-semibold ${(derivacionesPorTipo[t] ?? 0) > 0 ? 'text-primary-600' : 'text-gray-300'}`}>
                {derivacionesPorTipo[t] ?? 0}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-3 mt-1">
            <span className="font-semibold text-gray-700">Total derivaciones</span>
            <span className="font-bold text-primary-600">{totalDerivaciones}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard label="Casos de riesgo"           value={casosRiesgo}       sub="con respuesta SI" color="red"   />
          <MetricCard label="Asistencia de seguimiento" value={asistSeguimiento}  sub="con respuesta SI"              />
          <MetricCard label="Percepción de alivio"      value={percepcionAlivio}  sub="con respuesta SI" color="green"/>
          <MetricCard label="Cambios en funcionamiento" value={cambioFunc}        sub="con respuesta SI"              />
          <MetricCard label="Abandono"                  value={abandono}          sub="marcados como abandono" color="amber"/>
          <MetricCard label="Atención especializada"    value={atenEspecializada} sub="con respuesta SI" color="blue" />
        </div>
      </section>

      {/* ── E. Satisfacción del asesorado ──────────────────────────────────── */}
      <section className="space-y-3">
        <SectionTitle>
          Satisfacción del asesorado
          <span className="ml-2 text-xs font-normal text-gray-400 normal-case">
            todos los pacientes activos ({totalActivos})
          </span>
        </SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Calificación inicial</p>
            {(['n/a','1','2','3','4','5','6','7','8','9','10'] as const).map(v => (
              <ScoreRow key={v} label={v} count={distInicial[v] ?? 0} total={totalActivos} />
            ))}
            <div className="flex justify-between text-xs text-gray-400 border-t border-gray-100 pt-2 mt-1">
              <span>Total</span>
              <span className="font-semibold text-gray-700">{Object.values(distInicial).reduce((a, b) => a + b, 0)}</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Calificación final</p>
            {(['n/a','1','2','3','4','5','6','7','8','9','10'] as const).map(v => (
              <ScoreRow key={v} label={v} count={distFinal[v] ?? 0} total={totalActivos} />
            ))}
            <div className="flex justify-between text-xs text-gray-400 border-t border-gray-100 pt-2 mt-1">
              <span>Total</span>
              <span className="font-semibold text-gray-700">{Object.values(distFinal).reduce((a, b) => a + b, 0)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── F. Calificación por paciente ───────────────────────────────────── */}
      {calificaciones.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Calificación inicial y final por paciente</SectionTitle>
          <p className="text-xs text-gray-400">
            Pacientes atendidos en {nombreMesLargo(year, month)} · {tipoLabel}
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Paciente</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-center">Cal. Inicial</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-center">Cal. Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {calificaciones.map(c => (
                  <tr key={c.pid} className="hover:bg-gray-50 transition-colors">
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

      {/* ── Botón de impresión ─────────────────────────────────────────────── */}
      {totalSesiones > 0 && (
        <div className="flex justify-end pt-2">
          <PrintEstadisticasButton
            terapeutaNombre={terapeutaNombre}
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
          />
        </div>
      )}

    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{children}</h2>
}

function KpiCard({ label, value, sub, accent }: {
  label: string; value: number; sub?: string; accent?: boolean
}) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? 'bg-primary-50 border border-primary-100' : 'bg-white border border-gray-100'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-primary-600' : 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function MetricCard({ label, value, sub, color = 'default' }: {
  label: string; value: number; sub?: string
  color?: 'red' | 'green' | 'amber' | 'blue' | 'default'
}) {
  const colors = {
    red:     'text-red-600 bg-red-50 border-red-100',
    green:   'text-green-600 bg-green-50 border-green-100',
    amber:   'text-amber-600 bg-amber-50 border-amber-100',
    blue:    'text-blue-600 bg-blue-50 border-blue-100',
    default: 'text-gray-800 bg-white border-gray-100',
  }
  return (
    <div className={`rounded-2xl p-4 border ${colors[color]}`}>
      <p className="text-xs text-gray-500 mb-1 leading-tight">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  )
}

function ScoreRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-8 text-right shrink-0 font-medium ${label === 'n/a' ? 'text-gray-300' : 'text-gray-600'}`}>
        {label}
      </span>
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        {count > 0 && <div className="h-3 rounded-full bg-primary-400" style={{ width: `${Math.max(pct, 4)}%` }} />}
      </div>
      <span className="w-6 text-right shrink-0 text-gray-500">{count}</span>
    </div>
  )
}

function ScoreBadge({ value }: { value: string }) {
  if (value === 'n/a') return <span className="text-xs text-gray-300 font-medium">n/a</span>
  const num = parseInt(value, 10)
  const color = num >= 8 ? 'bg-green-100 text-green-700' : num >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{value}</span>
}
