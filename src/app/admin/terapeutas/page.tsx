import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ── Server Actions ────────────────────────────────────────────────────────────

async function aprobarTerapeuta(formData: FormData) {
  'use server'
  const therapistId = formData.get('therapistId') as string
  const slots = Number(formData.get('slots') ?? 10)
  const supabase = createAdminClient()
  await supabase.from('subscriptions').upsert({
    therapist_id: therapistId,
    status: 'free_approved',
    plan: 'free',
    patient_slots: slots,
  }, { onConflict: 'therapist_id' })
  revalidatePath('/admin/terapeutas')
}

async function revocarTerapeuta(formData: FormData) {
  'use server'
  const therapistId = formData.get('therapistId') as string
  const supabase = createAdminClient()
  await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('therapist_id', therapistId)
  revalidatePath('/admin/terapeutas')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminTerapeutasPage() {
  const supabase = createAdminClient()

  // Todos los terapeutas
  const { data: terapeutas } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at')
    .eq('role', 'therapist')
    .order('created_at', { ascending: false })

  // Sus suscripciones
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('therapist_id, status, patient_slots, plan')

  const subMap = new Map(subs?.map(s => [s.therapist_id, s]) ?? [])

  const pendientes = (terapeutas ?? []).filter(t => !subMap.has(t.id))
  const aprobados  = (terapeutas ?? []).filter(t => {
    const s = subMap.get(t.id)
    return s && ['free_approved', 'active', 'trialing'].includes(s.status)
  })
  const revocados  = (terapeutas ?? []).filter(t => {
    const s = subMap.get(t.id)
    return s && ['cancelled', 'past_due'].includes(s.status)
  })

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Terapeutas registrados</h1>
        <p className="text-sm text-gray-500 mt-1">
          Aprueba o revoca el acceso a AVI. Solo tú puedes ver esta página.
        </p>
      </div>

      {/* ── Pendientes ── */}
      <section>
        <h2 className="text-base font-semibold text-amber-700 mb-3">
          ⏳ Pendientes de aprobación ({pendientes.length})
        </h2>
        {pendientes.length === 0 ? (
          <p className="text-sm text-gray-400">No hay terapeutas pendientes.</p>
        ) : (
          <div className="space-y-3">
            {pendientes.map(t => (
              <div key={t.id} className="bg-white border border-amber-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{t.full_name ?? '—'}</p>
                  <p className="text-sm text-gray-500">{t.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Registro: {new Date(t.created_at).toLocaleDateString('es-MX')}
                  </p>
                </div>
                <form action={aprobarTerapeuta} className="flex items-center gap-2">
                  <input type="hidden" name="therapistId" value={t.id} />
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-500">Pacientes:</label>
                    <select name="slots" defaultValue="10"
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                      {[3, 5, 10, 15, 20, 30, 40].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                    ✓ Aprobar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Aprobados ── */}
      <section>
        <h2 className="text-base font-semibold text-green-700 mb-3">
          ✅ Con acceso activo ({aprobados.length})
        </h2>
        {aprobados.length === 0 ? (
          <p className="text-sm text-gray-400">Ninguno aprobado aún.</p>
        ) : (
          <div className="space-y-3">
            {aprobados.map(t => {
              const sub = subMap.get(t.id)!
              return (
                <div key={t.id} className="bg-white border border-green-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{t.full_name ?? '—'}</p>
                    <p className="text-sm text-gray-500">{t.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Plan: {sub.plan} · {sub.patient_slots} pacientes ·{' '}
                      <span className="capitalize">{sub.status}</span>
                    </p>
                  </div>
                  <form action={revocarTerapeuta}>
                    <input type="hidden" name="therapistId" value={t.id} />
                    <button type="submit"
                      className="border border-red-200 text-red-600 hover:bg-red-50 text-sm px-4 py-2 rounded-xl transition-colors">
                      Revocar acceso
                    </button>
                  </form>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Revocados ── */}
      {revocados.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-red-600 mb-3">
            🚫 Sin acceso ({revocados.length})
          </h2>
          <div className="space-y-3">
            {revocados.map(t => (
              <div key={t.id} className="bg-white border border-red-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{t.full_name ?? '—'}</p>
                  <p className="text-sm text-gray-500">{t.email}</p>
                </div>
                <form action={aprobarTerapeuta} className="flex items-center gap-2">
                  <input type="hidden" name="therapistId" value={t.id} />
                  <select name="slots" defaultValue="10"
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                    {[3, 5, 10, 15, 20, 30, 40].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <button type="submit"
                    className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                    Reactivar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
