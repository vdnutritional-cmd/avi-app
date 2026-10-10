import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { getAccesoTerapeuta, ACCESS_STATUSES, type AccesoTerapeuta } from '@/lib/acceso-paciente'
import ControlPlanesTabla, { type ControlFila } from './ControlPlanesTabla'

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'gray' }: {
  label: string; value: number | string; sub?: string
  color?: 'gray' | 'green' | 'amber' | 'red' | 'blue'
}) {
  const colors = {
    gray:  'bg-gray-50 border-gray-200 text-gray-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red:   'bg-red-50   border-red-200   text-red-800',
    blue:  'bg-blue-50  border-blue-200  text-blue-800',
  }
  return (
    <div className={`rounded-2xl border px-5 py-4 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

// Acordeón de un terapeuta con sus pacientes sin convenio y sesiones del mes
function CumplimientoTerapeuta({ t, tier, cupo, pacientes, alerta, badge }: {
  t: { id: string; full_name: string | null; email: string | null }
  status: string | undefined
  tier: string | null | undefined
  cupo: string
  pacientes: { id: string; nombre: string; sesionesMes: number; cubierto: boolean }[]
  alerta: boolean
  badge: React.ReactNode
}) {
  const bloqueados = pacientes.filter(p => !p.cubierto).length
  const totalSesiones = pacientes.reduce((n, p) => n + p.sesionesMes, 0)
  return (
    <details className={`bg-white border rounded-2xl overflow-hidden group ${alerta ? 'border-red-200' : 'border-green-200'}`}>
      <summary className="flex flex-wrap items-center gap-3 justify-between px-5 py-3.5 cursor-pointer list-none">
        <div>
          <p className="font-medium text-gray-800 text-sm">{t.full_name ?? '—'}</p>
          <p className="text-xs text-gray-400">
            {t.email} · {badge} · {tier ?? 'sin plan'} · {cupo}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-600 bg-gray-50 px-2 py-1 rounded-full">
            {pacientes.length} {pacientes.length === 1 ? 'paciente' : 'pacientes'} · {totalSesiones} ses. este mes
          </span>
          {bloqueados > 0 && (
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
              {bloqueados} {bloqueados === 1 ? 'bloqueado' : 'bloqueados'}
            </span>
          )}
          <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </summary>
      <div className={`border-t px-5 py-3 ${alerta ? 'border-red-100 bg-red-50/40' : 'border-green-100 bg-green-50/40'}`}>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="text-left font-medium pb-1">Paciente sin convenio</th>
              <th className="text-right font-medium pb-1">Sesiones del mes</th>
              <th className="text-right font-medium pb-1">Acceso</th>
            </tr>
          </thead>
          <tbody>
            {pacientes.map(p => (
              <tr key={p.id} className="border-t border-white/70">
                <td className="py-1 text-gray-700">{p.nombre}</td>
                <td className="py-1 text-right text-gray-700">{p.sesionesMes || ''}</td>
                <td className={`py-1 text-right font-medium ${p.cubierto ? 'text-green-700' : 'text-red-600'}`}>
                  {p.cubierto ? 'Cubierto' : 'Bloqueado'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 pt-3 border-t border-gray-200 flex gap-3">
          <Link href="/admin/terapeutas" className="text-xs text-primary-600 hover:underline">
            Gestionar terapeuta →
          </Link>
        </div>
      </div>
    </details>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminPanelPage() {
  const supabase = createAdminClient()

  // ── 1. Terapeutas + suscripciones ─────────────────────────────────────────
  const [
    { data: terapeutas },
    { data: subs },
    { data: allPatients },
    { data: therapistEmpresas },
    { data: companionBundles },
    { data: empresas },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, created_at, is_active')
      .eq('role', 'therapist')
      .order('created_at', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('therapist_id, status, patient_slots, tier, plan'),
    // Pacientes activos con empresa_id (para saber cuáles son CONVENIO)
    supabase
      .from('therapist_patients')
      .select('therapist_id, patient_id, empresa_id, initial_note_date, created_at, profiles!therapist_patients_patient_id_fkey(full_name, email)')
      .eq('is_active', true)
      .neq('status', 'archived'),
    supabase
      .from('therapist_empresa')
      .select('therapist_id, empresa_id'),
    // Bundle Companion activo (empresa_id=null): cubre a los independientes
    supabase
      .from('therapist_slot_bundles')
      .select('therapist_id, patient_slots')
      .eq('status', 'active')
      .is('empresa_id', null),
    supabase
      .from('convenio_empresas')
      .select('id, nombre'),
  ])

  const subMap = new Map((subs ?? []).map(s => [s.therapist_id, s]))
  const terapeutasList = terapeutas ?? []
  const pacientesList  = allPatients ?? []

  // Terapeutas activos (con plan vigente)
  const ACTIVE_STATUSES = ['active', 'trialing', 'free_approved']

  const activos   = terapeutasList.filter(t => t.is_active !== false && ACTIVE_STATUSES.includes(subMap.get(t.id)?.status ?? ''))
  const pendientes = terapeutasList.filter(t => t.is_active !== false && !subMap.has(t.id))
  const pastDue   = terapeutasList.filter(t => t.is_active !== false && subMap.get(t.id)?.status === 'past_due')

  // ── 2. Análisis de cobertura ───────────────────────────────────────────────
  // Por terapeuta: ¿tiene pacientes sin convenio (empresa_id=null)?
  type PacienteRow = {
    therapist_id: string
    patient_id: string
    empresa_id: string | null
    initial_note_date: string | null
    created_at: string
    profiles: { full_name: string | null; email: string | null } | null
  }

  // Agrupar pacientes por terapeuta
  const pacientesPorTerapeuta = new Map<string, PacienteRow[]>()
  for (const p of pacientesList as unknown as PacienteRow[]) {
    if (!pacientesPorTerapeuta.has(p.therapist_id)) {
      pacientesPorTerapeuta.set(p.therapist_id, [])
    }
    pacientesPorTerapeuta.get(p.therapist_id)!.push(p)
  }

  // Terapeutas con al menos un paciente sin convenio
  const conSinConvenio = activos.filter(t => {
    const pacs = pacientesPorTerapeuta.get(t.id) ?? []
    return pacs.some(p => p.empresa_id === null)
  })
  // Terapeutas donde TODOS los pacientes tienen convenio (o no tienen pacientes)
  const soloConvenio = activos.filter(t => {
    const pacs = pacientesPorTerapeuta.get(t.id) ?? []
    return pacs.length === 0 || pacs.every(p => p.empresa_id !== null)
  })

  // ── 3. Bloque de cumplimiento ──────────────────────────────────────────────
  // Misma regla que el resto de AVI (src/lib/acceso-paciente.ts): cubren a los
  // independientes el plan pagado, el aprobado por admin (free_approved) y el
  // Companion, dentro de su cupo; los más recientes fuera de cupo quedan bloqueados.
  const todosConSinConvenio = terapeutasList.filter(t => {
    if (t.is_active === false) return false
    const pacs = pacientesPorTerapeuta.get(t.id) ?? []
    return pacs.some(p => p.empresa_id === null)
  })

  // Acceso de todos los terapeutas con independientes (también los desactivados,
  // para la tabla de Control de Planes)
  const terapeutasConIndep = terapeutasList.filter(t =>
    (pacientesPorTerapeuta.get(t.id) ?? []).some(p => p.empresa_id === null))
  const accesoPorTerapeuta = new Map<string, AccesoTerapeuta>(
    await Promise.all(terapeutasConIndep.map(async t => [t.id, await getAccesoTerapeuta(supabase, t.id)] as const))
  )

  // Sesiones del mes en curso por paciente (presenciales + nota inicial del mes)
  const ahora = new Date()
  const mesInicio = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`
  const mesSiguiente = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1).toISOString().split('T')[0]
  const nombreMesActual = ahora.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  const indepIds = (pacientesList as unknown as PacienteRow[]).filter(p => p.empresa_id === null).map(p => p.patient_id)
  const { data: sesionesMes } = indepIds.length > 0
    ? await supabase.from('therapist_session_notes')
        .select('therapist_id, patient_id')
        .in('patient_id', indepIds)
        .gte('session_date', mesInicio)
        .lt('session_date', mesSiguiente)
    : { data: [] as { therapist_id: string; patient_id: string }[] }
  const sesionesKey = new Map<string, number>()
  for (const s of sesionesMes ?? []) {
    const k = `${s.therapist_id}:${s.patient_id}`
    sesionesKey.set(k, (sesionesKey.get(k) ?? 0) + 1)
  }

  // Pacientes sin convenio de un terapeuta, con sesiones del mes y cobertura
  function getSinConvenioPacientes(therapistId: string) {
    const acceso = accesoPorTerapeuta.get(therapistId)
    return (pacientesPorTerapeuta.get(therapistId) ?? [])
      .filter(p => p.empresa_id === null)
      .map(p => {
        const prof = Array.isArray(p.profiles) ? (p.profiles as unknown[])[0] as { full_name: string | null; email: string | null } : p.profiles
        const notaMes = p.initial_note_date != null && p.initial_note_date >= mesInicio && p.initial_note_date < mesSiguiente ? 1 : 0
        return {
          id: p.patient_id,
          nombre: prof?.full_name ?? prof?.email ?? p.patient_id,
          sesionesMes: (sesionesKey.get(`${therapistId}:${p.patient_id}`) ?? 0) + notaMes,
          cubierto: acceso ? acceso.indepPermitidos.has(p.patient_id) : false,
        }
      })
      .sort((a, b) => Number(a.cubierto) - Number(b.cubierto) || a.nombre.localeCompare(b.nombre))
  }

  const tieneBloqueados = (therapistId: string) => getSinConvenioPacientes(therapistId).some(p => !p.cubierto)
  const cumplimientoOK    = todosConSinConvenio.filter(t => !tieneBloqueados(t.id))
  const cumplimientoAlert = todosConSinConvenio.filter(t =>  tieneBloqueados(t.id))

  // Texto del cupo de independientes: "3 / 10" o "3 / sin límite"
  function cupoTexto(therapistId: string) {
    const a = accesoPorTerapeuta.get(therapistId)
    if (!a || !a.tienePlan) return 'sin plan para independientes'
    return `independientes ${a.indepCount} / ${a.indepSlots ?? 'sin límite'}`
  }

  // ── 4. Control de Planes y Contrataciones ─────────────────────────────────
  // Plan que cubre a los pacientes sin convenio (misma regla que acceso-paciente.ts):
  // bundle Companion primero; si no, la suscripción con estado de acceso.
  const bundleMap = new Map((companionBundles ?? []).map(b => [b.therapist_id as string, b.patient_slots as number]))
  const empresaNombre = new Map((empresas ?? []).map(e => [e.id as string, e.nombre as string]))

  function planDe(therapistId: string): ControlFila['plan'] {
    const bundleSlots = bundleMap.get(therapistId)
    if (bundleSlots != null) {
      return { texto: 'AVI Therapy Companion', sub: `Gratis · Clínico · ${bundleSlots} pacientes`, color: 'purple' }
    }
    const sub = subMap.get(therapistId)
    if (!sub) return { texto: 'Sin plan', sub: 'Pendiente de aprobación', color: 'red' }
    const nivel = sub.tier === 'clinico' ? 'Clínico' : 'Esencial'
    const cupo  = sub.patient_slots != null ? `${sub.patient_slots} pacientes` : 'sin límite'
    if (!ACCESS_STATUSES.includes(sub.status)) {
      return { texto: 'Sin plan vigente', sub: `Estado: ${sub.status}`, color: 'red' }
    }
    if (sub.status === 'free_approved' || sub.plan === 'free') {
      return { texto: 'Gratis — aprobado por AVI', sub: `${nivel} · ${cupo}`, color: 'blue' }
    }
    const nombrePlan: Record<string, string> = {
      paid:  'Pagado',
      unit:  'Pagado por paciente',
      valora: 'CONVENIO (pagado)',
    }
    return {
      texto: nombrePlan[sub.plan ?? ''] ?? (sub.plan ?? 'Pagado'),
      sub: `${nivel} · ${cupo}${sub.status === 'trialing' ? ' · en prueba' : ''}`,
      color: 'green',
    }
  }

  function nombreDe(p: PacienteRow) {
    const prof = Array.isArray(p.profiles) ? (p.profiles as unknown[])[0] as { full_name: string | null; email: string | null } : p.profiles
    return prof?.full_name ?? prof?.email ?? p.patient_id
  }
  const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre)

  const filasControl: ControlFila[] = terapeutasList
    .map(t => {
      const pacs = pacientesPorTerapeuta.get(t.id) ?? []
      const acceso = accesoPorTerapeuta.get(t.id)

      const convenio = pacs
        .filter(p => p.empresa_id !== null)
        .map(p => ({ id: p.patient_id, nombre: nombreDe(p), detalle: empresaNombre.get(p.empresa_id!) }))
        .sort(porNombre)

      // Independientes con acceso (incluye a los que se registraron bloqueados y
      // el terapeuta ya activó: plan nuevo o cupo ampliado)
      const indep = pacs.filter(p => p.empresa_id === null)
      const activosIndep = indep.filter(p => acceso?.indepPermitidos.has(p.patient_id))
      // Registrados este mes y que hoy siguen sin acceso
      const bloqueados = indep
        .filter(p => !acceso?.indepPermitidos.has(p.patient_id) && p.created_at >= mesInicio && p.created_at < mesSiguiente)
        .map(p => ({
          id: p.patient_id,
          nombre: nombreDe(p),
          detalle: `registrado ${new Date(p.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`,
          bloqueado: true,
        }))
        .sort(porNombre)

      const sinConvenio = [
        ...activosIndep.map(p => ({ id: p.patient_id, nombre: nombreDe(p) })),
        ...bloqueados.map(b => ({ ...b, detalle: 'Bloqueado' })),
      ].sort(porNombre)

      return {
        therapistId: t.id,
        nombre: t.full_name ?? '—',
        email: t.email ?? '',
        desactivado: t.is_active === false,
        plan: planDe(t.id),
        convenio,
        sinConvenio,
        bloqueados,
      }
    })
    // Activos primero, luego por nombre
    .sort((a, b) => Number(a.desactivado) - Number(b.desactivado) || a.nombre.localeCompare(b.nombre))

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function statusBadge(status: string | undefined) {
    if (!status) return <span className="text-xs text-gray-400">sin plan</span>
    const map: Record<string, string> = {
      free_approved: 'bg-blue-100 text-blue-700',
      active:        'bg-green-100 text-green-700',
      trialing:      'bg-teal-100 text-teal-700',
      past_due:      'bg-red-100 text-red-700',
      cancelled:     'bg-gray-100 text-gray-500',
    }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-10">

      {/* ── Título ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Control</h1>
        <p className="text-sm text-gray-400 mt-1">Resumen de actividad y cumplimiento de AVI Therapy Companion</p>
      </div>

      {/* ── Bloque 1: Stat cards ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Terapeutas activos" value={activos.length} color="green" />
        <StatCard label="Solo pacientes CONVENIO" value={soloConvenio.length} color="blue" sub="sin pacientes fuera de convenio" />
        <StatCard label="Con pacientes sin convenio" value={conSinConvenio.length} color="amber" sub="mezclan convenio y sin convenio" />
        <StatCard label="Pendientes de aprobación" value={pendientes.length} color={pendientes.length > 0 ? 'amber' : 'gray'} />
      </section>

      {/* ── Bloque 2: Pendientes de aprobación ── */}
      {pendientes.length > 0 && (
        <section>
          <h2 className="text-base mb-3 flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span className="font-semibold text-primary-700">Pendientes de aprobación ({pendientes.length})</span>
            <span className="text-sm text-gray-900">
              Autorizaciones en la sección{' '}
              <Link href="/admin/terapeutas" className="font-medium hover:underline">&quot;Terapeutas&quot;</Link>
              {' '}de esta Administración AVI
            </span>
          </h2>
          {/* Solo informativo: aprobar o asignar Companion se hace en Admin › Terapeutas */}
          <div className="space-y-3">
            {pendientes.map(t => (
              <div key={t.id} className="bg-white border border-amber-200 rounded-2xl px-5 py-4">
                <p className="font-medium text-gray-800 text-sm">{t.full_name ?? '—'}</p>
                <p className="text-xs text-gray-400">{t.email} · Registrado {fmtDate(t.created_at)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Control de Planes y Contrataciones ── */}
      <ControlPlanesTabla filas={filasControl} nombreMes={nombreMesActual} />

      {/* ── Bloque 3: Pago caído (past_due) ── */}
      {pastDue.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Suscripción con pago caído ({pastDue.length})
          </h2>
          <div className="space-y-2">
            {pastDue.map(t => {
              const sub = subMap.get(t.id)
              const sinConvenio = (pacientesPorTerapeuta.get(t.id) ?? []).filter(p => p.empresa_id === null).length
              return (
                <div key={t.id} className="bg-white border border-red-200 rounded-2xl px-5 py-3.5 flex flex-wrap items-center gap-3 justify-between">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{t.full_name ?? '—'}</p>
                    <p className="text-xs text-gray-400">
                      {t.email} · {sub?.tier ?? '—'} · {sub?.patient_slots ?? 0} slots
                      {sinConvenio > 0 && <span className="ml-2 text-red-600 font-medium">⚠ {sinConvenio} pac. sin convenio bloqueados</span>}
                    </p>
                  </div>
                  <Link
                    href={`/admin/terapeutas?buscar=${encodeURIComponent(t.email ?? '')}`}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Ver terapeuta →
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Bloque 4: Cumplimiento — Pacientes sin convenio ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-1">Cumplimiento — Pacientes sin convenio</h2>
        <p className="text-xs text-gray-400 mb-4">
          Terapeutas con pacientes fuera de convenio institucional. Los cubre un plan pagado, un plan aprobado
          por Administración AVI o un AVI Therapy Companion, dentro de su cupo de pacientes independientes.
          Sesiones de {nombreMesActual}: presenciales + nota inicial del mes.
        </p>

        {todosConSinConvenio.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 text-sm text-green-700 font-medium">
            ✓ Sin irregularidades. Todos los pacientes sin convenio tienen cobertura activa.
          </div>
        )}

        {/* Con cobertura ✅ */}
        {cumplimientoOK.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-green-700 mb-2">✅ Con cobertura ({cumplimientoOK.length})</p>
            <div className="space-y-2">
              {cumplimientoOK.map(t => (
                <CumplimientoTerapeuta key={t.id} t={t} status={subMap.get(t.id)?.status} tier={subMap.get(t.id)?.tier}
                  cupo={cupoTexto(t.id)} pacientes={getSinConvenioPacientes(t.id)} alerta={false} badge={statusBadge(subMap.get(t.id)?.status)} />
              ))}
            </div>
          </div>
        )}

        {/* Con pacientes bloqueados ⚠️ */}
        {cumplimientoAlert.length > 0 && (
          <div>
            <p className="text-sm font-medium text-red-700 mb-2">⚠️ Con pacientes bloqueados — sin plan o fuera de cupo ({cumplimientoAlert.length})</p>
            <div className="space-y-3">
              {cumplimientoAlert.map(t => (
                <CumplimientoTerapeuta key={t.id} t={t} status={subMap.get(t.id)?.status} tier={subMap.get(t.id)?.tier}
                  cupo={cupoTexto(t.id)} pacientes={getSinConvenioPacientes(t.id)} alerta={true} badge={statusBadge(subMap.get(t.id)?.status)} />
              ))}
            </div>
          </div>
        )}
      </section>

    </div>
  )
}
