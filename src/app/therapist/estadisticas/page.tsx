import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import FiltrosEstadisticas from './FiltrosEstadisticas'

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

  const admin        = createAdminClient()
  const therapistId  = user.id
  const tipo         = (tipoParam === 'inactivos' ? 'inactivos' : 'activos') as 'activos' | 'inactivos'
  const pid          = pidParam ?? 'all'

  // ── Mes a mostrar ──────────────────────────────────────────────────────────
  const now = new Date()
  const [ySt, mSt] = (mes ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).split('-')
  const year  = parseInt(ySt)
  const month = parseInt(mSt)
  const mesKey = `${year}-${String(month).padStart(2, '0')}`

  const mesInicio    = `${mesKey}-01`
  const mesSiguiente = new Date(year, month, 1).toISOString().split('T')[0]
  const isCurrentMonth = mesKey === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // ── 1. Pacientes en scope (activos o inactivos, sin archivados) ─────────────
  let relacionesQuery = admin
    .from('therapist_patients')
    .select('patient_id, is_active, empresa_id, sensacion_paciente_inicial, initial_note_date, initial_note_pro_bono, initial_note, convenio_empresas(nombre)')
    .eq('therapist_id', therapistId)
    .eq('is_active', tipo === 'activos')
    .neq('status', 'archived')

  if (pid !== 'all') {
    relacionesQuery = relacionesQuery.eq('patient_id', pid)
  }

  const { data: relaciones } = await relacionesQuery

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

  const pacientesParaDropdown = pacienteIds.map(id => ({
    id,
    nombre: nombreByPatient[id] ?? id,
  })).sort((a, b) => a.nombre.localeCompare(b.nombre))

  // ── 2. Sesiones presenciales del periodo ───────────────────────────────────
  const [{ data: sesionesRows }, notasEnPeriodo] = await Promise.all([
    pacienteIds.length > 0
      ? admin
          .from('therapist_session_notes')
          .select('patient_id, session_date, is_pro_bono')
          .eq('therapist_id', therapistId)
          .in('patient_id', pacienteIds)
          .gte('session_date', mesInicio)
          .lt('session_date', mesSiguiente)
      : Promise.resolve({ data: [] }),
    // Notas iniciales que caen en el periodo
    Promise.resolve(
      (relaciones ?? []).filter(r =>
        r.initial_note &&
        r.initial_note_date &&
        r.initial_note_date >= mesInicio &&
        r.initial_note_date < mesSiguiente
      ).map(r => ({
        patient_id: r.patient_id as string,
        session_date: r.initial_note_date as string,
        is_pro_bono: (r.initial_note_pro_bono as boolean) ?? false,
      }))
    ),
  ])

  const todasLasSesiones = [
    ...(sesionesRows ?? []).map(s => ({
      patient_id: s.patient_id as string,
      session_date: s.session_date as string,
      is_pro_bono: (s.is_pro_bono as boolean) ?? false,
    })),
    ...notasEnPeriodo,
  ]

  // Pacientes únicos atendidos en el periodo
  const pacientesEnPeriodoSet = new Set(todasLasSesiones.map(s => s.patient_id))
  const pacientesEnPeriodoIds = [...pacientesEnPeriodoSet]

  // ── 3. Datos de Derivaciones y Cierres (para pacientes en periodo) ─────────
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

  // ── 4. TODOS los pacientes activos (para Satisfacción) ────────────────────
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

  // ── Cálculos ───────────────────────────────────────────────────────────────

  // A) Sesiones totales + por empresa
  const totalSesiones = todasLasSesiones.length
  const sesionesPorEmpresa: Record<string, number> = {}
  for (const s of todasLasSesiones) {
    const emp = empresaByPatient[s.patient_id] ?? 'Sin empresa'
    sesionesPorEmpresa[emp] = (sesionesPorEmpresa[emp] ?? 0) + 1
  }

  // B) Personas atendidas
  const personasAtendidas = pacientesEnPeriodoIds.length

  // C) Motivo de consulta (tipo_caso + problematica agrupados)
  const motivoMap: Record<string, number> = {}
  for (const exp of expedientesRows ?? []) {
    const tc = (exp.tipo_caso as string) ?? ''
    const pr = (exp.problematica as string) ?? ''
    if (!tc && !pr) continue
    const key = [tc, pr].filter(Boolean).join(' / ')
    motivoMap[key] = (motivoMap[key] ?? 0) + 1
  }
  const motivoEntries = Object.entries(motivoMap).sort(([, a], [, b]) => b - a)

  // D) Derivaciones (suma por tipo + total)
  const derivacionesPorTipo: Record<string, number> = {}
  let totalDerivaciones = 0
  for (const d of derivacionesRows ?? []) {
    const tipos = Array.isArray(d.derivacion_tipos) ? d.derivacion_tipos as string[] : []
    for (const t of tipos) {
      derivacionesPorTipo[t] = (derivacionesPorTipo[t] ?? 0) + 1
      totalDerivaciones++
    }
  }

  // E) Métricas de derivaciones/cierres
  const casosRiesgo       = (derivacionesRows ?? []).filter(d => d.caso_riesgo === 'SI').length
  const asistSeguimiento  = (derivacionesRows ?? []).filter(d => d.asistencia_seguimiento === 'SI').length
  const percepcionAlivio  = (derivacionesRows ?? []).filter(d => d.percepcion_alivio === 'SI').length
  const cambioFunc        = (derivacionesRows ?? []).filter(d => d.cambio_funcionamiento === 'SI').length
  const abandono          = (derivacionesRows ?? []).filter(d => d.abandono === true).length
  const atenEspecializada = (derivacionesRows ?? []).filter(d => d.atencion_especializada === 'SI').length

  // F) Satisfacción — distribución sensacion_inicial y sensacion_final (todos activos)
  const totalActivos = todosActivosIds.length

  const finalPorPatient: Record<string, string> = {}
  for (const d of derivActivosRows ?? []) {
    finalPorPatient[d.patient_id as string] = (d.sensacion_paciente_final as string) ?? 'n/a'
  }

  const distInicial: Record<string, number> = { 'n/a': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0 }
  const distFinal:   Record<string, number> = { 'n/a': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0 }

  for (const r of todosActivosRows ?? []) {
    const ini = r.sensacion_paciente_inicial
    const key = (ini !== null && ini !== undefined) ? String(ini) : 'n/a'
    if (key in distInicial) distInicial[key]++
    else distInicial['n/a']++

    const fin = finalPorPatient[r.patient_id as string] ?? 'n/a'
    if (fin in distFinal) distFinal[fin]++
    else distFinal['n/a']++
  }

  // G) Tabla Calificación inicial y final (pacientes en periodo)
  const calificaciones = pacientesEnPeriodoIds.map(pid => {
    const rel = (relaciones ?? []).find(r => r.patient_id === pid)
    const der = (derivacionesRows ?? []).find(d => d.patient_id === pid)
    return {
      pid,
      nombre: nombreByPatient[pid] ?? pid,
      inicial: rel?.sensacion_paciente_inicial !== null && rel?.sensacion_paciente_inicial !== undefined
        ? String(rel.sensacion_paciente_inicial)
        : 'n/a',
      final: (der?.sensacion_paciente_final as string) ?? 'n/a',
    }
  }).sort((a, b) => a.nombre.localeCompare(b.nombre))

  // ── Navegación de meses ────────────────────────────────────────────────────
  const prevMes = mesAnterior(year, month)
  const nextMes = mesSiguienteStr(year, month)
  const baseParams = (m: string) =>
    `/therapist/estadisticas?mes=${m}&tipo=${tipo}&pid=${pid}`

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estadísticas del Terapeuta</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Información clínica y operativa de tu práctica · pacientes {tipo}
        </p>
      </div>

      {/* ── Controles: mes + filtros ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
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

        {/* Toggle activos/inactivos + dropdown */}
        <FiltrosEstadisticas
          tipo={tipo}
          pid={pid}
          mes={mesKey}
          pacientes={pacientesParaDropdown}
        />
      </div>

      {/* ── Sin sesiones en el periodo ─────────────────────────────────────── */}
      {pacienteIds.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-gray-400 text-sm">
            No hay pacientes {tipo} registrados.
          </p>
        </div>
      )}

      {/* ── A. Resumen del periodo ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionTitle>Resumen del periodo</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Cantidad de sesiones" value={totalSesiones} accent />
          <KpiCard label="Personas atendidas" value={personasAtendidas}
            sub="Pacientes únicos con al menos 1 sesión" />
        </div>
      </section>

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

        {/* Derivaciones por tipo */}
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

        {/* Grid de métricas de cierre */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard label="Casos de riesgo" value={casosRiesgo}
            sub={`con respuesta SI`} color="red" />
          <MetricCard label="Asistencia de seguimiento" value={asistSeguimiento}
            sub="con respuesta SI" />
          <MetricCard label="Percepción de alivio" value={percepcionAlivio}
            sub="con respuesta SI" color="green" />
          <MetricCard label="Cambios en funcionamiento" value={cambioFunc}
            sub="con respuesta SI" />
          <MetricCard label="Abandono" value={abandono}
            sub="marcados como abandono" color="amber" />
          <MetricCard label="Atención especializada" value={atenEspecializada}
            sub="con respuesta SI" color="blue" />
        </div>
      </section>

      {/* ── E. Satisfacción del asesorado (todos los activos, sin filtro de mes) */}
      <section className="space-y-3">
        <SectionTitle>
          Satisfacción del asesorado
          <span className="ml-2 text-xs font-normal text-gray-400 normal-case">
            todos los pacientes activos ({totalActivos})
          </span>
        </SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Calificación inicial */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Calificación inicial (sensacion_paciente_inicial)
            </p>
            {(['n/a', '1','2','3','4','5','6','7','8','9','10'] as const).map(v => (
              <ScoreRow
                key={v}
                label={v}
                count={distInicial[v] ?? 0}
                total={totalActivos}
              />
            ))}
            <div className="flex justify-between text-xs text-gray-400 border-t border-gray-100 pt-2 mt-1">
              <span>Total</span>
              <span className="font-semibold text-gray-700">
                {Object.values(distInicial).reduce((a, b) => a + b, 0)}
              </span>
            </div>
          </div>

          {/* Calificación final */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Calificación final (sensacion_paciente_final)
            </p>
            {(['n/a', '1','2','3','4','5','6','7','8','9','10'] as const).map(v => (
              <ScoreRow
                key={v}
                label={v}
                count={distFinal[v] ?? 0}
                total={totalActivos}
              />
            ))}
            <div className="flex justify-between text-xs text-gray-400 border-t border-gray-100 pt-2 mt-1">
              <span>Total</span>
              <span className="font-semibold text-gray-700">
                {Object.values(distFinal).reduce((a, b) => a + b, 0)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── F. Calificación inicial y final por paciente ───────────────────── */}
      {calificaciones.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Calificación inicial y final por paciente</SectionTitle>
          <p className="text-xs text-gray-400">
            Pacientes atendidos en {nombreMesLargo(year, month)} · {tipo}
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
                    <td className="px-5 py-3 text-center">
                      <ScoreBadge value={c.inicial} />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <ScoreBadge value={c.final} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
      {children}
    </h2>
  )
}

function KpiCard({ label, value, sub, accent }: {
  label: string
  value: number
  sub?: string
  accent?: boolean
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
  label: string
  value: number
  sub?: string
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
      <p className={`text-2xl font-bold ${color !== 'default' ? '' : 'text-gray-800'}`}>{value}</p>
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
        {count > 0 && (
          <div
            className="h-3 rounded-full bg-primary-400"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        )}
      </div>
      <span className="w-6 text-right shrink-0 text-gray-500">{count}</span>
    </div>
  )
}

function ScoreBadge({ value }: { value: string }) {
  if (value === 'n/a') {
    return <span className="text-xs text-gray-300 font-medium">n/a</span>
  }
  const num = parseInt(value, 10)
  const color =
    num >= 8 ? 'bg-green-100 text-green-700' :
    num >= 5 ? 'bg-amber-100 text-amber-700' :
               'bg-red-100 text-red-700'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {value}
    </span>
  )
}
