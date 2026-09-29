import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function nombreMes(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
}

function nombreMesLargo(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

export default async function EstadisticasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const therapistId = user.id
  const now = new Date()
  const mesActualInicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const mesSiguiente = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0]

  // ── 1. Pacientes activos / histórico ───────────────────────────────────────
  const [{ data: pacientesActivos }, { data: pacientesTodos }] = await Promise.all([
    supabase
      .from('therapist_patients')
      .select('patient_id', { count: 'exact', head: true })
      .eq('therapist_id', therapistId)
      .eq('is_active', true),
    supabase
      .from('therapist_patients')
      .select('patient_id')
      .eq('therapist_id', therapistId),
  ])

  const totalActivos   = (pacientesActivos as unknown as { count?: number } | null)?.count ?? 0
  // pacientesTodos is used below for patient IDs
  const pacienteIds = (pacientesTodos ?? []).map((r: { patient_id: string }) => r.patient_id)
  const totalHistorico = pacienteIds.length

  // ── 2. Sesiones presenciales — mes actual ──────────────────────────────────
  const [{ data: sesionesPresenciales }, { data: notasInicialesMes }] = await Promise.all([
    supabase
      .from('therapist_session_notes')
      .select('session_date, is_pro_bono')
      .eq('therapist_id', therapistId)
      .gte('session_date', mesActualInicio)
      .lt('session_date', mesSiguiente),
    supabase
      .from('therapist_patients')
      .select('initial_note_date, initial_note_pro_bono')
      .eq('therapist_id', therapistId)
      .not('initial_note', 'is', null)
      .not('initial_note_date', 'is', null)
      .gte('initial_note_date', mesActualInicio)
      .lt('initial_note_date', mesSiguiente),
  ])

  const sesionesMes = [
    ...(sesionesPresenciales ?? []),
    ...(notasInicialesMes ?? []).map(n => ({
      session_date: n.initial_note_date as string,
      is_pro_bono: n.initial_note_pro_bono ?? false,
    })),
  ]
  const totalMes     = sesionesMes.length
  const totalMesFact = sesionesMes.filter(s => !s.is_pro_bono).length
  const totalMesPb   = sesionesMes.filter(s =>  s.is_pro_bono).length

  // ── 3. Sesiones presenciales — acumuladas ─────────────────────────────────
  const [{ data: todasSesiones }, { data: todasNotasIniciales }] = await Promise.all([
    supabase
      .from('therapist_session_notes')
      .select('is_pro_bono')
      .eq('therapist_id', therapistId),
    supabase
      .from('therapist_patients')
      .select('initial_note_pro_bono')
      .eq('therapist_id', therapistId)
      .not('initial_note', 'is', null)
      .not('initial_note_date', 'is', null),
  ])

  const acumuladasRows = [
    ...(todasSesiones ?? []),
    ...(todasNotasIniciales ?? []).map(n => ({ is_pro_bono: n.initial_note_pro_bono ?? false })),
  ]
  const totalAcumuladas     = acumuladasRows.length
  const totalAcumuladasFact = acumuladasRows.filter(s => !s.is_pro_bono).length
  const totalAcumuladasPb   = acumuladasRows.filter(s =>  s.is_pro_bono).length

  // ── 4. Sesiones AVI de mis pacientes ──────────────────────────────────────
  let totalAVI = 0
  if (pacienteIds.length > 0) {
    const { count } = await supabase
      .from('patterns')
      .select('id', { count: 'exact', head: true })
      .in('patient_id', pacienteIds)
    totalAVI = count ?? 0
  }

  // ── 5. Actividad mensual — últimos 12 meses ────────────────────────────────
  const doceAtras = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0]
  const [{ data: histSesiones }, { data: histNotas }] = await Promise.all([
    supabase
      .from('therapist_session_notes')
      .select('session_date')
      .eq('therapist_id', therapistId)
      .gte('session_date', doceAtras)
      .lt('session_date', mesSiguiente),
    supabase
      .from('therapist_patients')
      .select('initial_note_date')
      .eq('therapist_id', therapistId)
      .not('initial_note', 'is', null)
      .not('initial_note_date', 'is', null)
      .gte('initial_note_date', doceAtras)
      .lt('initial_note_date', mesSiguiente),
  ])

  // Construir mapa de los 12 meses (incluyendo meses vacíos)
  const actividadPorMes: Record<string, number> = {}
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    actividadPorMes[key] = 0
  }
  for (const s of histSesiones ?? []) {
    const key = (s.session_date as string).slice(0, 7)
    if (key in actividadPorMes) actividadPorMes[key]++
  }
  for (const n of histNotas ?? []) {
    const key = (n.initial_note_date as string).slice(0, 7)
    if (key in actividadPorMes) actividadPorMes[key]++
  }
  const actividadEntries = Object.entries(actividadPorMes)
  const maxActividad = Math.max(...actividadEntries.map(([, v]) => v), 1)

  // ── 6. Distribución por problemática ──────────────────────────────────────
  let problematicaDistrib: Record<string, number> = {}
  if (pacienteIds.length > 0) {
    const { data: expedientes } = await supabase
      .from('patient_expediente')
      .select('problematica')
      .eq('therapist_id', therapistId)
      .in('patient_id', pacienteIds)
      .not('problematica', 'is', null)

    for (const exp of expedientes ?? []) {
      const p = (exp as { problematica?: string }).problematica
      if (p) problematicaDistrib[p] = (problematicaDistrib[p] ?? 0) + 1
    }
  }
  const problematicaEntries = Object.entries(problematicaDistrib)
    .sort(([, a], [, b]) => b - a)

  return (
    <div className="max-w-3xl space-y-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estadísticas del Terapeuta</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Resumen global de tu práctica clínica — {nombreMesLargo(now.getFullYear(), now.getMonth() + 1)}
        </p>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Resumen general</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiCard label="Pacientes activos" value={totalActivos} sub="Con acceso habilitado" accent />
          <KpiCard label="Pacientes histórico" value={totalHistorico} sub="Total registrados" />
          <KpiCard label="Sesiones AVI" value={totalAVI} sub="Generadas por tus pacientes" />
          <KpiCard label="Sesiones del mes" value={totalMes} sub={nombreMesLargo(now.getFullYear(), now.getMonth() + 1)} />
          <KpiCard label="Sesiones acumuladas" value={totalAcumuladas} sub="Total histórico presencial" />
          <KpiCard
            label="Pro-bono / Facturable"
            value={`${totalAcumuladasPb} / ${totalAcumuladasFact}`}
            sub={totalAcumuladas > 0 ? `${Math.round((totalAcumuladasPb / totalAcumuladas) * 100)}% pro-bono` : 'Sin sesiones aún'}
          />
        </div>
      </section>

      {/* ── Mes actual: pro-bono vs facturable ─────────────────────────────── */}
      {totalMes > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Desglose del mes — {nombreMesLargo(now.getFullYear(), now.getMonth() + 1)}
          </h2>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Facturables</span>
              <span className="font-semibold text-gray-800">{totalMesFact}</span>
            </div>
            <BarRow value={totalMesFact} max={totalMes} color="bg-primary-500" />
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-600">Pro-bono</span>
              <span className="font-semibold text-gray-800">{totalMesPb}</span>
            </div>
            <BarRow value={totalMesPb} max={totalMes} color="bg-amber-400" />
          </div>
        </section>
      )}

      {/* ── Actividad mensual — últimos 12 meses ────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Actividad mensual</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          {actividadEntries.every(([, v]) => v === 0) ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin sesiones registradas aún.</p>
          ) : (
            <div className="space-y-2">
              {actividadEntries.map(([key, count]) => {
                const [y, m] = key.split('-').map(Number)
                const pct = Math.round((count / maxActividad) * 100)
                const esMesActual = key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className={`text-xs w-14 text-right shrink-0 ${esMesActual ? 'text-primary-600 font-semibold' : 'text-gray-400'}`}>
                      {nombreMes(y, m)}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className={`h-5 rounded-full transition-all ${esMesActual ? 'bg-primary-500' : 'bg-primary-200'}`}
                        style={{ width: count > 0 ? `${Math.max(pct, 4)}%` : '0%' }}
                      />
                    </div>
                    <span className={`text-xs w-6 text-right shrink-0 ${esMesActual ? 'text-primary-600 font-semibold' : 'text-gray-500'}`}>
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Distribución por problemática ───────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Distribución por problemática</h2>
        {problematicaEntries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
            <p className="text-sm text-gray-400">
              Ningún expediente tiene problemática registrada aún.<br />
              <span className="text-xs">Se registra en AVI-CLÍNICO → Tipo de caso de cada paciente.</span>
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Problemática</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Pacientes</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {problematicaEntries.map(([prob, count]) => (
                  <tr key={prob} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-700">{prob}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800">{count}</td>
                    <td className="px-5 py-3 text-right text-gray-400">
                      {totalHistorico > 0 ? Math.round((count / totalHistorico) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: {
  label: string
  value: string | number
  sub: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? 'bg-primary-50 border border-primary-100' : 'bg-white border border-gray-100'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-primary-600' : 'text-gray-800'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

function BarRow({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
      <div
        className={`h-3 rounded-full ${color}`}
        style={{ width: value > 0 ? `${Math.max(pct, 3)}%` : '0%' }}
      />
    </div>
  )
}
