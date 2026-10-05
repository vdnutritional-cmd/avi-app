import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

// ── Server Actions ────────────────────────────────────────────────────────────

async function aprobarTerapeuta(formData: FormData) {
  'use server'
  const therapistId = formData.get('therapistId') as string
  const slots = Number(formData.get('slots') ?? 10)
  const tier  = (formData.get('tier') as string) ?? 'esencial'
  const supabase = createAdminClient()
  await supabase.from('subscriptions').upsert({
    therapist_id: therapistId,
    status: 'free_approved',
    plan: 'free',
    patient_slots: slots,
    tier,
  }, { onConflict: 'therapist_id' })
  revalidatePath('/admin')
}

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminPanelPage() {
  const supabase = createAdminClient()

  // ── 1. Terapeutas + suscripciones ─────────────────────────────────────────
  const [
    { data: terapeutas },
    { data: subs },
    { data: allPatients },
    { data: therapistEmpresas },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, created_at, is_active')
      .eq('role', 'therapist')
      .order('created_at', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('therapist_id, status, patient_slots, tier'),
    // Pacientes activos con empresa_id (para saber cuáles son CONVENIO)
    supabase
      .from('therapist_patients')
      .select('therapist_id, patient_id, empresa_id, profiles!therapist_patients_patient_id_fkey(full_name, email)')
      .eq('is_active', true)
      .neq('status', 'archived'),
    supabase
      .from('therapist_empresa')
      .select('therapist_id, empresa_id'),
  ])

  const subMap = new Map((subs ?? []).map(s => [s.therapist_id, s]))
  const terapeutasList = terapeutas ?? []
  const pacientesList  = allPatients ?? []

  // Terapeutas activos (con plan vigente)
  const ACTIVE_STATUSES = ['active', 'trialing', 'free_approved']
  const PAID_STATUSES   = ['active', 'trialing']

  const activos   = terapeutasList.filter(t => t.is_active !== false && ACTIVE_STATUSES.includes(subMap.get(t.id)?.status ?? ''))
  const pendientes = terapeutasList.filter(t => t.is_active !== false && !subMap.has(t.id))
  const pastDue   = terapeutasList.filter(t => t.is_active !== false && subMap.get(t.id)?.status === 'past_due')

  // ── 2. Análisis de cobertura ───────────────────────────────────────────────
  // Por terapeuta: ¿tiene pacientes sin convenio (empresa_id=null)?
  type PacienteRow = {
    therapist_id: string
    patient_id: string
    empresa_id: string | null
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
  // Todos los terapeutas (activos + cualquier estado) que tienen pacientes sin convenio
  // Separar: los que tienen plan pagado (OK) y los que NO (bloqueados)
  const todosConSinConvenio = terapeutasList.filter(t => {
    if (t.is_active === false) return false
    const pacs = pacientesPorTerapeuta.get(t.id) ?? []
    return pacs.some(p => p.empresa_id === null)
  })

  const cumplimientoOK = todosConSinConvenio.filter(t => PAID_STATUSES.includes(subMap.get(t.id)?.status ?? ''))
  const cumplimientoAlert = todosConSinConvenio.filter(t => !PAID_STATUSES.includes(subMap.get(t.id)?.status ?? ''))

  // Para cada terapeuta en alerta: lista de pacientes sin convenio (bloqueados)
  function getSinConvenioPacientes(therapistId: string) {
    return (pacientesPorTerapeuta.get(therapistId) ?? [])
      .filter(p => p.empresa_id === null)
      .map(p => {
        const prof = Array.isArray(p.profiles) ? (p.profiles as unknown[])[0] as { full_name: string | null; email: string | null } : p.profiles
        return {
          id: p.patient_id,
          nombre: prof?.full_name ?? prof?.email ?? p.patient_id,
        }
      })
  }

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
          <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            Pendientes de aprobación ({pendientes.length})
          </h2>
          <div className="space-y-3">
            {pendientes.map(t => (
              <div key={t.id} className="bg-white border border-amber-200 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <p className="font-medium text-gray-800 text-sm">{t.full_name ?? '—'}</p>
                  <p className="text-xs text-gray-400">{t.email} · Registrado {fmtDate(t.created_at)}</p>
                </div>
                <form action={aprobarTerapeuta} className="flex items-center gap-2 flex-wrap">
                  <input type="hidden" name="therapistId" value={t.id} />
                  <select name="tier" className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                    <option value="esencial">Esencial</option>
                    <option value="clinico">Clínico</option>
                  </select>
                  <select name="slots" className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                    <option value="10">10 pacientes</option>
                    <option value="20">20 pacientes</option>
                    <option value="30">30 pacientes</option>
                    <option value="50">50 pacientes</option>
                  </select>
                  <button
                    type="submit"
                    className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    Aprobar →
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

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
          Terapeutas que tienen pacientes fuera de convenio institucional.
          Para atender esos pacientes deben contar con un plan Stripe activo (Esencial o Clínico).
        </p>

        {todosConSinConvenio.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 text-sm text-green-700 font-medium">
            ✓ Sin irregularidades. Todos los pacientes sin convenio tienen cobertura activa.
          </div>
        )}

        {/* Con plan pagado ✅ */}
        {cumplimientoOK.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-green-700 mb-2">✅ Con plan pagado ({cumplimientoOK.length})</p>
            <div className="space-y-2">
              {cumplimientoOK.map(t => {
                const sub = subMap.get(t.id)
                const sinConv = getSinConvenioPacientes(t.id)
                return (
                  <div key={t.id} className="bg-white border border-green-200 rounded-2xl px-5 py-3.5 flex flex-wrap items-center gap-3 justify-between">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{t.full_name ?? '—'}</p>
                      <p className="text-xs text-gray-400">
                        {t.email} · {statusBadge(sub?.status)} · {sub?.tier ?? '—'} · {sinConv.length} pac. sin convenio
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Sin plan o caído ⚠️ */}
        {cumplimientoAlert.length > 0 && (
          <div>
            <p className="text-sm font-medium text-red-700 mb-2">⚠️ Sin plan o pago caído — pacientes bloqueados ({cumplimientoAlert.length})</p>
            <div className="space-y-3">
              {cumplimientoAlert.map(t => {
                const sub = subMap.get(t.id)
                const sinConv = getSinConvenioPacientes(t.id)
                return (
                  <details key={t.id} className="bg-white border border-red-200 rounded-2xl overflow-hidden group">
                    <summary className="flex flex-wrap items-center gap-3 justify-between px-5 py-3.5 cursor-pointer list-none">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{t.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">
                          {t.email} · {statusBadge(sub?.status)} · {sub?.tier ?? 'sin plan'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                          {sinConv.length} {sinConv.length === 1 ? 'paciente bloqueado' : 'pacientes bloqueados'}
                        </span>
                        <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </summary>
                    <div className="border-t border-red-100 px-5 py-3 bg-red-50">
                      <p className="text-xs text-red-700 mb-2 font-medium">Pacientes sin convenio (acceso bloqueado a módulos AVI):</p>
                      <ul className="space-y-1">
                        {sinConv.map(p => (
                          <li key={p.id} className="text-xs text-red-700 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            {p.nombre}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 pt-3 border-t border-red-200 flex gap-3">
                        <Link
                          href={`/admin/terapeutas`}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          Gestionar terapeuta →
                        </Link>
                      </div>
                    </div>
                  </details>
                )
              })}
            </div>
          </div>
        )}
      </section>

    </div>
  )
}
