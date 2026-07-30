import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Determina si una fecha (YYYY-MM-DD) es fin de semana (sábado o domingo)
function esFindeSemana(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay() // 0=Dom, 6=Sáb
  return dow === 0 || dow === 6
}

function nombreMes(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

export default async function AsesoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Mes a mostrar (default: mes actual)
  const now = new Date()
  const [yearStr, monthStr] = (mes ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).split('-')
  const year  = parseInt(yearStr)
  const month = parseInt(monthStr)

  const mesInicio = `${year}-${String(month).padStart(2, '0')}-01`
  const mesFin    = new Date(year, month, 1).toISOString().split('T')[0] // primer día del mes siguiente

  // Sesiones presenciales del mes
  const { data: sesiones } = await supabase
    .from('therapist_session_notes')
    .select('session_date, is_pro_bono, is_virtual')
    .eq('therapist_id', user!.id)
    .gte('session_date', mesInicio)
    .lt('session_date', mesFin)
    .order('session_date', { ascending: true })

  // Notas iniciales del mes (cuentan como sesión)
  const { data: notasIniciales } = await supabase
    .from('therapist_patients')
    .select('initial_note_date, initial_note_pro_bono, initial_note_virtual')
    .eq('therapist_id', user!.id)
    .not('initial_note', 'is', null)
    .not('initial_note_date', 'is', null)
    .gte('initial_note_date', mesInicio)
    .lt('initial_note_date', mesFin)

  type Row = { session_date: string; is_pro_bono: boolean; is_virtual?: boolean }

  const rows: Row[] = [
    ...(sesiones ?? []),
    ...(notasIniciales ?? []).map(n => ({
      session_date: n.initial_note_date as string,
      is_pro_bono: n.initial_note_pro_bono ?? false,
      is_virtual: (n as Record<string, unknown>).initial_note_virtual as boolean ?? false,
    })),
  ]

  // Cálculos — virtuales van a su propia columna, no a ES/FS
  const ebFact    = rows.filter(s => !s.is_virtual && !esFindeSemana(s.session_date) && !s.is_pro_bono).length
  const ebPb      = rows.filter(s => !s.is_virtual && !esFindeSemana(s.session_date) &&  s.is_pro_bono).length
  const fsFact    = rows.filter(s => !s.is_virtual &&  esFindeSemana(s.session_date) && !s.is_pro_bono).length
  const fsPb      = rows.filter(s => !s.is_virtual &&  esFindeSemana(s.session_date) &&  s.is_pro_bono).length
  const virtFact  = rows.filter(s =>  s.is_virtual && !s.is_pro_bono).length
  const virtPb    = rows.filter(s =>  s.is_virtual &&  s.is_pro_bono).length
  const total     = rows.length
  const totalFact = ebFact + fsFact + virtFact
  const totalPb   = ebPb   + fsPb   + virtPb
  const totalEb   = ebFact + ebPb
  const totalFs   = fsFact + fsPb
  const totalVirt = virtFact + virtPb

  // Navegación de meses
  const prevMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
  const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1)

  // Historial: últimos 6 meses para mini-tabla
  const seisMesesAtras = new Date(year, month - 7, 1).toISOString().split('T')[0]
  const [{ data: historial }, { data: historialNotas }] = await Promise.all([
    supabase
      .from('therapist_session_notes')
      .select('session_date, is_pro_bono')
      .eq('therapist_id', user!.id)
      .gte('session_date', seisMesesAtras)
      .lt('session_date', mesInicio)
      .order('session_date', { ascending: true }),
    supabase
      .from('therapist_patients')
      .select('initial_note_date, initial_note_pro_bono')
      .eq('therapist_id', user!.id)
      .not('initial_note', 'is', null)
      .not('initial_note_date', 'is', null)
      .gte('initial_note_date', seisMesesAtras)
      .lt('initial_note_date', mesInicio),
  ])

  const historialCombinado = [
    ...(historial ?? []),
    ...(historialNotas ?? []).map(n => ({
      session_date: n.initial_note_date as string,
      is_pro_bono: n.initial_note_pro_bono ?? false,
    })),
  ]

  // Agrupar historial por mes
  const historialPorMes: Record<string, { total: number; fact: number; pb: number }> = {}
  for (const s of historialCombinado) {
    const key = s.session_date.slice(0, 7) // YYYY-MM
    if (!historialPorMes[key]) historialPorMes[key] = { total: 0, fact: 0, pb: 0 }
    historialPorMes[key].total++
    if (s.is_pro_bono) historialPorMes[key].pb++
    else historialPorMes[key].fact++
  }
  const historialMeses = Object.entries(historialPorMes)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 5)

  return (
    <div className="max-w-3xl space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis asesorías</h1>
          <p className="text-gray-500 mt-1 text-sm">Estadísticas mensuales por jornada y tipo</p>
        </div>
        {/* Navegador de meses */}
        <div className="flex items-center gap-2">
          <Link
            href={`/therapist/asesorias?mes=${prevMonth}`}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
          >
            ← ant.
          </Link>
          <span className="text-sm font-medium text-gray-700 capitalize min-w-[140px] text-center">
            {nombreMes(year, month)}
          </span>
          <Link
            href={isCurrentMonth ? '#' : `/therapist/asesorias?mes=${nextMonth}`}
            className={`px-3 py-1.5 text-sm border rounded-xl transition-colors ${
              isCurrentMonth
                ? 'border-gray-100 text-gray-300 cursor-default'
                : 'border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            sig. →
          </Link>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total asesorías', value: total, sub: nombreMes(year, month), accent: true },
          { label: 'Entre semana', value: totalEb, sub: 'Lun – Vie (presencial)' },
          { label: 'Fin de semana', value: totalFs, sub: 'Sáb – Dom (presencial)' },
          { label: 'Virtuales', value: totalVirt, sub: 'Cualquier día' },
          { label: 'Facturables', value: totalFact, sub: `${totalPb} pro-bono` },
        ].map(c => (
          <div
            key={c.label}
            className={`rounded-2xl p-5 ${c.accent ? 'bg-primary-50 border border-primary-100' : 'bg-white border border-gray-100'}`}
          >
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-3xl font-bold ${c.accent ? 'text-primary-600' : 'text-gray-800'}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabla desglose */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Tipo</th>
              <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Entre semana</th>
              <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Fin de semana</th>
              <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Virtual</th>
              <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Subtotal</th>
              <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <tr>
              <td className="px-5 py-4">
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pro-bono</span>
              </td>
              <td className="px-5 py-4 text-right text-gray-700">{ebPb}</td>
              <td className="px-5 py-4 text-right text-gray-700">{fsPb}</td>
              <td className="px-5 py-4 text-right text-blue-600">{virtPb}</td>
              <td className="px-5 py-4 text-right font-medium text-gray-800">{totalPb}</td>
              <td className="px-5 py-4 text-right text-gray-400">
                {total > 0 ? Math.round((totalPb / total) * 100) : 0}%
              </td>
            </tr>
            <tr>
              <td className="px-5 py-4">
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Facturable</span>
              </td>
              <td className="px-5 py-4 text-right text-gray-700">{ebFact}</td>
              <td className="px-5 py-4 text-right text-gray-700">{fsFact}</td>
              <td className="px-5 py-4 text-right text-blue-600">{virtFact}</td>
              <td className="px-5 py-4 text-right font-medium text-gray-800">{totalFact}</td>
              <td className="px-5 py-4 text-right text-gray-400">
                {total > 0 ? Math.round((totalFact / total) * 100) : 0}%
              </td>
            </tr>
            <tr className="bg-gray-50">
              <td className="px-5 py-3 font-semibold text-gray-700">Total</td>
              <td className="px-5 py-3 text-right font-semibold text-gray-700">{totalEb}</td>
              <td className="px-5 py-3 text-right font-semibold text-gray-700">{totalFs}</td>
              <td className="px-5 py-3 text-right font-semibold text-blue-600">{totalVirt}</td>
              <td className="px-5 py-3 text-right font-semibold text-primary-600">{total}</td>
              <td className="px-5 py-3 text-right text-gray-400">100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {total === 0 && (
        <div className="text-center py-10 text-gray-400">
          <p className="text-4xl mb-3">📊</p>
          <p>No hay sesiones registradas en {nombreMes(year, month)}.</p>
          <p className="text-sm mt-1">Las sesiones presenciales aparecen aquí al registrarlas en el perfil de cada paciente.</p>
        </div>
      )}

      {/* Historial últimos meses */}
      {historialMeses.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Meses anteriores</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Mes</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Total</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Facturables</th>
                  <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Pro-bono</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historialMeses.map(([key, data]) => {
                  const [hy, hm] = key.split('-').map(Number)
                  return (
                    <tr key={key} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/therapist/asesorias?mes=${key}`}
                          className="text-primary-600 hover:underline capitalize"
                        >
                          {nombreMes(hy, hm)}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">{data.total}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{data.fact}</td>
                      <td className="px-5 py-3 text-right text-gray-400">{data.pb}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
