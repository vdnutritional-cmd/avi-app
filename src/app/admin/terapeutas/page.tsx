import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RejectTherapistButton from '@/app/admin/RejectTherapistButton'
import DesactivarTherapistButton from '@/app/admin/DesactivarTherapistButton'
import { createClient } from '@/lib/supabase/server'
import { COMPANION_PLANS } from '@/lib/stripe/plans'
import { activarCompanion, generarCodigoConvenio } from '@/lib/companion'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'pepe.vargas.papa@gmail.com'

// Asignar AVI Therapy Companion a un terapeuta existente: crea un código CONVENIO
// del Companion (queda en Códigos CONVENIO → Usados) y lo activa con la misma
// lógica del checkout (Opción B). El cron desactivar-companion-expirados lo vence.
async function asignarCompanion(formData: FormData) {
  'use server'
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) redirect('/admin')

  const therapistId = formData.get('therapistId') as string
  const planId      = formData.get('planId') as string
  const expiresAt   = formData.get('expiresAt') as string
  const plan = COMPANION_PLANS.find(p => p.id === planId)
  if (!therapistId || !plan || !expiresAt) redirect('/admin/terapeutas?error=companion-datos')
  if (new Date(`${expiresAt}T23:59:59`) <= new Date()) redirect('/admin/terapeutas?error=companion-fecha')

  const supabase = createAdminClient()

  // Código único para el Companion
  let code = ''
  for (let i = 0; i < 5; i++) {
    code = generarCodigoConvenio()
    const { data: existing } = await supabase.from('convenio_codes').select('id').eq('code', code).maybeSingle()
    if (!existing) break
  }
  const { data: codeRow, error: codeError } = await supabase
    .from('convenio_codes')
    .insert({ code, plan_id: plan!.id, expires_at: expiresAt })
    .select('id')
    .single()
  if (codeError || !codeRow) redirect('/admin/terapeutas?error=companion-fallo')

  const r = await activarCompanion(supabase, {
    therapistId,
    codeId: codeRow!.id as string,
    patientSlots: typeof plan!.patientSlots === 'number' ? plan!.patientSlots : 5,
  })
  if (!r.ok) {
    // No dejar un código libre de un Companion que no se pudo asignar
    await supabase.from('convenio_codes').update({ is_active: false }).eq('id', codeRow!.id)
    redirect('/admin/terapeutas?error=companion-fallo')
  }

  revalidatePath('/admin/terapeutas')
  revalidatePath('/admin/convenio')
  redirect(`/admin/terapeutas?ok=companion&plan=${plan!.id}`)
}

// Formulario para asignar un Companion (5 o 10 + vencimiento)
function CompanionForm({ therapistId }: { therapistId: string }) {
  const hoy = new Date().toISOString().split('T')[0]
  return (
    <form action={asignarCompanion} className="flex items-center gap-1.5 mt-1 flex-wrap">
      <input type="hidden" name="therapistId" value={therapistId} />
      <span className="text-xs text-emerald-700 font-medium">AVI Therapy Companion:</span>
      <select name="planId" defaultValue="companion_5"
        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-300 text-gray-600">
        {COMPANION_PLANS.map(p => <option key={p.id} value={p.id}>{p.name.replace('AVI Therapy Companion', 'Companion')}</option>)}
      </select>
      <label className="text-xs text-gray-500">vence</label>
      <input type="date" name="expiresAt" required min={hoy}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-300 text-gray-600" />
      <button type="submit"
        className="text-xs text-emerald-700 border border-emerald-200 rounded-lg px-2 py-1 hover:bg-emerald-50 transition-colors">
        Asignar
      </button>
    </form>
  )
}

function esFindeSemana(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return dow === 0 || dow === 6
}

function nombreMes(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

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
  revalidatePath('/admin/terapeutas')
}

async function cambiarTier(formData: FormData) {
  'use server'
  const therapistId = formData.get('therapistId') as string
  const tier        = formData.get('tier') as string
  const supabase    = createAdminClient()
  await supabase
    .from('subscriptions')
    .update({ tier })
    .eq('therapist_id', therapistId)
  revalidatePath('/admin/terapeutas')
}

async function agregarEmpresa(formData: FormData) {
  'use server'
  const therapistId = formData.get('therapistId') as string
  const empresaId   = formData.get('empresaId')   as string
  if (!therapistId || !empresaId) return
  const supabase = createAdminClient()
  await supabase.from('therapist_empresa').upsert(
    { therapist_id: therapistId, empresa_id: empresaId },
    { onConflict: 'therapist_id,empresa_id', ignoreDuplicates: true }
  )
  revalidatePath('/admin/terapeutas')
}

async function quitarEmpresa(formData: FormData) {
  'use server'
  const therapistId = formData.get('therapistId') as string
  const empresaId   = formData.get('empresaId')   as string
  if (!therapistId || !empresaId) return
  const supabase = createAdminClient()
  await supabase.from('therapist_empresa')
    .delete()
    .eq('therapist_id', therapistId)
    .eq('empresa_id', empresaId)
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

async function rechazarTerapeuta(formData: FormData) {
  'use server'
  const therapistId = formData.get('therapistId') as string
  const supabase = createAdminClient()
  // Elimina el usuario de auth (cascada borra el perfil)
  await supabase.auth.admin.deleteUser(therapistId)
  revalidatePath('/admin/terapeutas')
}

async function desactivarTerapeuta(formData: FormData) {
  'use server'
  const therapistId = formData.get('therapistId') as string
  const supabase = createAdminClient()

  // Verificar si tiene pacientes activos — no se puede desactivar con pacientes sin transferir
  const { count } = await supabase
    .from('therapist_patients')
    .select('*', { count: 'exact', head: true })
    .eq('therapist_id', therapistId)
    .eq('is_active', true)
    .neq('status', 'archived')

  if (count && count > 0) {
    redirect(`/admin/terapeutas?error=tiene-pacientes&count=${count}`)
  }

  // Sin pacientes activos → desactivar perfil (NOM-024: no se borra nada)
  await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', therapistId)

  revalidatePath('/admin/terapeutas')
}

async function reactivarPerfil(formData: FormData) {
  'use server'
  const therapistId = formData.get('therapistId') as string
  const supabase = createAdminClient()
  await supabase
    .from('profiles')
    .update({ is_active: true })
    .eq('id', therapistId)
  revalidatePath('/admin/terapeutas')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminTerapeutasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; error?: string; count?: string; ok?: string; plan?: string }>
}) {
  const { mes, error: errorParam, count: countParam, ok: okParam, plan: planParam } = await searchParams
  const supabase = createAdminClient()

  const now = new Date()
  const [yearStr, monthStr] = (mes ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).split('-')
  const year  = parseInt(yearStr)
  const month = parseInt(monthStr)
  const mesInicio = `${year}-${String(month).padStart(2, '0')}-01`
  const mesFin    = new Date(year, month, 1).toISOString().split('T')[0]
  const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1)
  const prevMonth = month === 1  ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`

  // Todos los terapeutas (incluyendo desactivados)
  const { data: terapeutas, error: errT } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at, is_active')
    .eq('role', 'therapist')
    .order('created_at', { ascending: false })

  // Sus suscripciones
  const { data: subs, error: errS } = await supabase
    .from('subscriptions')
    .select('therapist_id, status, patient_slots, plan, tier')

  // Todas las empresas en convenio ACTIVAS (para el selector del admin)
  const { data: todasEmpresas } = await supabase
    .from('convenio_empresas')
    .select('id, nombre')
    .eq('is_active', true)
    .order('nombre', { ascending: true })

  // Empresas asignadas por terapeuta
  const { data: therapistEmpresas } = await supabase
    .from('therapist_empresa')
    .select('therapist_id, empresa_id, convenio_empresas(id, nombre)')

  // Mapa: therapistId → array de { empresa_id, nombre }
  const empresasByTherapist = new Map<string, { empresa_id: string; nombre: string }[]>()
  for (const row of therapistEmpresas ?? []) {
    const nombre = (row.convenio_empresas as unknown as { nombre: string } | null)?.nombre ?? ''
    if (!empresasByTherapist.has(row.therapist_id)) empresasByTherapist.set(row.therapist_id, [])
    empresasByTherapist.get(row.therapist_id)!.push({ empresa_id: row.empresa_id, nombre })
  }

  // ── Datos de actividad ────────────────────────────────────────
  const [
    { data: convenioCodes },
    { data: allPatients },
    { data: allSessions },
    authUsersResult,
  ] = await Promise.all([
    supabase.from('convenio_codes').select('used_by, plan_id').not('used_by', 'is', null),
    supabase.from('therapist_patients')
      .select('therapist_id, patient_id, profiles!therapist_patients_patient_id_fkey(full_name, email)')
      .eq('is_active', true).eq('status', 'active'),
    supabase.from('sessions').select('patient_id, created_at').order('created_at', { ascending: false }),
    supabase.auth.admin.listUsers({ perPage: 500 }),
  ])

  // Mapas de actividad
  const convenioMap = new Map<string, string | null>(
    (convenioCodes ?? []).map(c => [c.used_by as string, c.plan_id as string | null])
  )
  const CONVENIO_LABELS: Record<string, string> = {
    esencial_valora10: 'Esencial 10',
    esencial_valora20: 'Esencial 20',
    clinico_valora10:  'Clínico 10',
    clinico_valora20:  'Clínico 20',
    companion_5:       'Companion 5',
    companion_10:      'Companion 10',
  }
  const lastSignInMap = new Map<string, string>(
    (authUsersResult.data?.users ?? [])
      .filter(u => u.last_sign_in_at)
      .map(u => [u.id, u.last_sign_in_at!])
  )
  // Pacientes por terapeuta (count + nombres)
  const patientsByTherapist = new Map<string, Set<string>>()
  const patientNamesByTherapist = new Map<string, { id: string; nombre: string }[]>()
  for (const p of allPatients ?? []) {
    if (!patientsByTherapist.has(p.therapist_id)) patientsByTherapist.set(p.therapist_id, new Set())
    patientsByTherapist.get(p.therapist_id)!.add(p.patient_id)
    if (!patientNamesByTherapist.has(p.therapist_id)) patientNamesByTherapist.set(p.therapist_id, [])
    const prof = Array.isArray((p as any).profiles) ? (p as any).profiles[0] : (p as any).profiles
    patientNamesByTherapist.get(p.therapist_id)!.push({
      id: p.patient_id,
      nombre: prof?.full_name ?? prof?.email ?? p.patient_id,
    })
  }
  // Última sesión de paciente por terapeuta
  const lastPatientSessionMap = new Map<string, string>()
  for (const s of allSessions ?? []) {
    for (const [therapistId, patients] of patientsByTherapist) {
      if (patients.has(s.patient_id) && !lastPatientSessionMap.has(therapistId)) {
        lastPatientSessionMap.set(therapistId, s.created_at)
      }
    }
  }

  function fmtDate(iso: string | undefined | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Sesiones presenciales del mes actual (todos los terapeutas)
  const [{ data: sesionesMesRaw }, { data: notasInicialesAdmin }] = await Promise.all([
    supabase
      .from('therapist_session_notes')
      .select('therapist_id, session_date, is_pro_bono, is_virtual')
      .gte('session_date', mesInicio)
      .lt('session_date', mesFin),
    supabase
      .from('therapist_patients')
      .select('therapist_id, initial_note_date, initial_note_pro_bono, initial_note_virtual')
      .not('initial_note', 'is', null)
      .not('initial_note_date', 'is', null)
      .gte('initial_note_date', mesInicio)
      .lt('initial_note_date', mesFin),
  ])

  const sesionesMes = [
    ...(sesionesMesRaw ?? []),
    ...(notasInicialesAdmin ?? []).map(n => ({
      therapist_id: n.therapist_id,
      session_date: n.initial_note_date as string,
      is_pro_bono: n.initial_note_pro_bono ?? false,
      is_virtual: (n as Record<string, unknown>).initial_note_virtual as boolean ?? false,
    })),
  ]

  const subMap = new Map(subs?.map(s => [s.therapist_id, s]) ?? [])

  // Desactivados primero (is_active = false) — siempre en su propia sección
  const desactivados = (terapeutas ?? []).filter(t => t.is_active === false)
  const activosIds   = new Set(desactivados.map(t => t.id))

  const pendientes = (terapeutas ?? []).filter(t => !subMap.has(t.id) && !activosIds.has(t.id))
  const aprobados  = (terapeutas ?? []).filter(t => {
    if (activosIds.has(t.id)) return false
    const s = subMap.get(t.id)
    return s && ['free_approved', 'active', 'trialing'].includes(s.status)
  })
  const revocados  = (terapeutas ?? []).filter(t => {
    if (activosIds.has(t.id)) return false
    const s = subMap.get(t.id)
    return s && ['cancelled', 'past_due'].includes(s.status)
  })

  return (
    <div className="space-y-10">
      {/* ── Resultado de asignar AVI Therapy Companion ── */}
      {okParam === 'companion' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-800">
          ✓ {COMPANION_PLANS.find(p => p.id === planParam)?.name ?? 'AVI Therapy Companion'} asignado. El código quedó registrado en Códigos CONVENIO → Usados.
        </div>
      )}
      {errorParam?.startsWith('companion-') && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          {errorParam === 'companion-fecha' ? 'La fecha de vencimiento debe ser posterior a hoy.'
            : errorParam === 'companion-datos' ? 'Elige el paquete Companion y la fecha de vencimiento.'
            : 'No se pudo asignar el Companion. Intenta de nuevo.'}
        </div>
      )}

      {/* ── Alerta: terapeuta con pacientes activos ── */}
      {errorParam === 'tiene-pacientes' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800 text-sm">No se puede desactivar: tiene pacientes activos</p>
            <p className="text-amber-700 text-xs mt-0.5">
              Este terapeuta tiene {countParam} {Number(countParam) === 1 ? 'paciente activo' : 'pacientes activos'}.
              Transfiérelos a otro terapeuta desde{' '}
              <a href="/therapist/transferir-paciente" className="underline font-medium">Transferir paciente</a>{' '}
              antes de desactivarlo.
            </p>
          </div>
        </div>
      )}

      {/* ── DEBUG temporal ── */}
      {(errT || errS) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 font-mono whitespace-pre-wrap">
          {errT && <p>Error profiles: {JSON.stringify(errT)}</p>}
          {errS && <p>Error subs: {JSON.stringify(errS)}</p>}
        </div>
      )}
      <div className="text-xs text-gray-400">
        Terapeutas encontrados: {terapeutas?.length ?? 0}
      </div>

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
              <div key={t.id} className="bg-white border border-amber-100 rounded-2xl p-5">
                {/* Títulos de los dos bloques (desktop) */}
                <div className="hidden md:grid md:grid-cols-2 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-primary-600 text-center">Registro Temporal</p>
                    <p className="text-xs font-normal text-primary-500 text-center">(Registro mediante Código CONVENIO)</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary-600 text-center">Registro Permanente</p>
                    <p className="text-xs font-normal text-primary-500 text-center">(Autorización exclusiva: Administrador AVI)</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0">
                {/* Registro temporal: datos del terapeuta + Companion con vencimiento */}
                <div className="md:pr-5 md:border-r-2 md:border-primary-500">
                  <p className="md:hidden text-sm font-semibold text-primary-600">Registro Temporal</p>
                  <p className="md:hidden text-xs font-normal text-primary-500 mb-1">(Registro mediante Código CONVENIO)</p>
                  <p className="font-medium text-gray-800">{t.full_name ?? '—'}</p>
                  <p className="text-sm text-gray-500">{t.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Registro: {new Date(t.created_at).toLocaleDateString('es-MX')}
                  </p>
                  <CompanionForm therapistId={t.id} />
                </div>
                {/* Registro permanente: gratis aprobado por AVI (a la altura del bloque temporal) */}
                <div className="md:pl-5 flex flex-col justify-end">
                  <p className="md:hidden text-sm font-semibold text-primary-600">Registro Permanente</p>
                  <p className="md:hidden text-xs font-normal text-primary-500 mb-1">(Autorización exclusiva: Administrador AVI)</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Formulario aprobar */}
                  <form action={aprobarTerapeuta} className="flex items-center gap-2 flex-wrap">
                    <input type="hidden" name="therapistId" value={t.id} />
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500">Pac:</label>
                      <select name="slots" defaultValue="10"
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                        {[3, 5, 10, 15, 20, 30, 40].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500">Tier:</label>
                      <select name="tier" defaultValue="esencial"
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                        <option value="esencial">Esencial</option>
                        <option value="clinico">Clínico</option>
                      </select>
                    </div>
                    <button type="submit"
                      className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                      ✓ Aprobar
                    </button>
                  </form>
                  {/* Botón rechazar con confirm */}
                  <RejectTherapistButton
                    therapistId={t.id}
                    displayName={t.full_name ?? t.email ?? 'este terapeuta'}
                    action={rechazarTerapeuta}
                  />
                </div>
                </div>
                </div>
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
              const empresasAsignadas = empresasByTherapist.get(t.id) ?? []
              const convenioVal   = convenioMap.has(t.id) ? convenioMap.get(t.id) : undefined
              const convenioLabel = convenioVal !== undefined
                ? (convenioVal ? `CONVENIO ${CONVENIO_LABELS[convenioVal] ?? convenioVal}` : 'CONVENIO')
                : null
              const empresasDisponibles = (todasEmpresas ?? []).filter(
                e => !empresasAsignadas.some(a => a.empresa_id === e.id)
              )
              const pacientes       = patientsByTherapist.get(t.id)?.size ?? 0
              const pacientesNombres = (patientNamesByTherapist.get(t.id) ?? [])
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
              const lastTerapLogin  = lastSignInMap.get(t.id)
              const lastPatientSess = lastPatientSessionMap.get(t.id)

              return (
                <div key={t.id} className="bg-white border border-green-100 rounded-2xl p-5">
                  {/* Renglón 1: nombre (izquierda) · correo (centrado) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 items-baseline gap-x-4">
                    <p className="font-medium text-gray-800">{t.full_name ?? '—'}</p>
                    <p className="text-sm text-gray-500 md:text-center truncate">{t.email}</p>
                  </div>
                  {/* Plan(es) del terapeuta */}
                  <p className="text-xs text-gray-400 mt-0.5">
                    Plan: {sub.plan} · {sub.patient_slots} pac ·{' '}
                    <span className="capitalize">{sub.status}</span> ·{' '}
                    <span className={`font-semibold ${sub.tier === 'clinico' ? 'text-purple-600' : 'text-gray-500'}`}>
                      AVI {sub.tier === 'clinico' ? 'Clínico' : 'Esencial'}
                    </span>
                    {convenioLabel && <> · Código: {convenioLabel}</>}
                  </p>

                  {/* Control de acceso con registro temporal */}
                  <div className="mt-4 pt-3 border-t border-primary-300">
                    <p className="text-sm font-normal text-primary-400 mb-1">Control de acceso con registro temporal</p>
                    {/* ── Métricas de actividad ── */}
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {/* Empresas en CONVENIO */}
                      {empresasAsignadas.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-50 text-gray-400 border border-gray-100 font-medium">
                          🏢 Sin CONVENIO
                        </span>
                      ) : (
                        empresasAsignadas.map(emp => (
                          <form key={emp.empresa_id} action={quitarEmpresa} className="inline-flex">
                            <input type="hidden" name="therapistId" value={t.id} />
                            <input type="hidden" name="empresaId" value={emp.empresa_id} />
                            <button
                              type="submit"
                              title="Quitar empresa"
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors group"
                            >
                              🏢 {emp.nombre}
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] ml-0.5">✕</span>
                            </button>
                          </form>
                        ))
                      )}
                      {/* Pacientes — acordeón */}
                      {pacientes === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-50 text-gray-400 border border-gray-100 font-medium">
                          👥 0 pacientes
                        </span>
                      ) : (
                        <details className="relative inline-block">
                          <summary className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium cursor-pointer select-none list-none">
                            👥 {pacientes} {pacientes === 1 ? 'paciente' : 'pacientes'} ▾
                          </summary>
                          <div className="absolute z-20 left-0 mt-1 bg-white border border-blue-100 rounded-xl px-3 py-2 shadow-md min-w-[180px]">
                            <ul className="space-y-0.5">
                              {pacientesNombres.map(p => (
                                <li key={p.id} className="text-xs text-gray-700 py-0.5 border-b border-gray-50 last:border-0">
                                  {p.nombre}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </details>
                      )}
                      {/* Último acceso del terapeuta */}
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
                        lastTerapLogin
                          ? 'bg-green-50 text-green-700 border-green-100'
                          : 'bg-gray-50 text-gray-400 border-gray-100'
                      }`}>
                        🕐 Terapeuta: {fmtDate(lastTerapLogin)}
                      </span>
                      {/* Última sesión de paciente */}
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
                        lastPatientSess
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : 'bg-gray-50 text-gray-400 border-gray-100'
                      }`}>
                        📱 Últ. sesión pac.: {fmtDate(lastPatientSess)}
                      </span>
                    </div>

                    {/* Agregar empresa */}
                    {empresasDisponibles.length > 0 && (
                      <form action={agregarEmpresa} className="flex items-center gap-1.5 mt-1">
                        <input type="hidden" name="therapistId" value={t.id} />
                        <select
                          name="empresaId"
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-300 text-gray-600"
                          defaultValue=""
                        >
                          <option value="" disabled>+ Agregar empresa...</option>
                          {empresasDisponibles.map(e => (
                            <option key={e.id} value={e.id}>{e.nombre}</option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="text-xs text-purple-600 border border-purple-200 rounded-lg px-2 py-1 hover:bg-purple-50 transition-colors"
                        >
                          Agregar
                        </button>
                      </form>
                    )}
                    <CompanionForm therapistId={t.id} />
                  </div>

                  {/* Control de acceso con registro permanente */}
                  <div className="mt-4 pt-3 border-t border-primary-300">
                    <p className="text-sm font-normal text-primary-400 mb-2">Control de acceso con registro permanente</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Cambiar tier */}
                    <form action={cambiarTier} className="flex items-center gap-1">
                      <input type="hidden" name="therapistId" value={t.id} />
                      <select name="tier" defaultValue={sub.tier ?? 'esencial'}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300">
                        <option value="esencial">Esencial</option>
                        <option value="clinico">Clínico</option>
                      </select>
                      <button type="submit"
                        className="border border-purple-200 text-purple-600 hover:bg-purple-50 text-xs px-3 py-1.5 rounded-xl transition-colors">
                        Cambiar tier
                      </button>
                    </form>
                    <form action={revocarTerapeuta}>
                      <input type="hidden" name="therapistId" value={t.id} />
                      <button type="submit"
                        className="border border-red-200 text-red-600 hover:bg-red-50 text-sm px-4 py-2 rounded-xl transition-colors">
                        Revocar acceso
                      </button>
                    </form>
                    <DesactivarTherapistButton
                      therapistId={t.id}
                      displayName={t.full_name ?? t.email ?? 'este terapeuta'}
                      action={desactivarTerapeuta}
                    />
                  </div>
                  </div>
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
              <div key={t.id} className="bg-white border border-red-100 rounded-2xl p-5">
                {/* Títulos de los dos bloques (desktop) — mismo diseño que Pendientes */}
                <div className="hidden md:grid md:grid-cols-2 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-primary-600 text-center">Registro Temporal</p>
                    <p className="text-xs font-normal text-primary-500 text-center">(Registro mediante Código CONVENIO)</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary-600 text-center">Registro Permanente</p>
                    <p className="text-xs font-normal text-primary-500 text-center">(Autorización exclusiva: Administrador AVI)</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0">
                {/* Registro temporal: datos del terapeuta + Companion con vencimiento */}
                <div className="md:pr-5 md:border-r-2 md:border-primary-500">
                  <p className="md:hidden text-sm font-semibold text-primary-600">Registro Temporal</p>
                  <p className="md:hidden text-xs font-normal text-primary-500 mb-1">(Registro mediante Código CONVENIO)</p>
                  <p className="font-medium text-gray-800">{t.full_name ?? '—'}</p>
                  <p className="text-sm text-gray-500">{t.email}</p>
                  <CompanionForm therapistId={t.id} />
                </div>
                {/* Registro permanente: gratis aprobado por AVI (a la altura del bloque temporal) */}
                <div className="md:pl-5 flex flex-col justify-end">
                  <p className="md:hidden text-sm font-semibold text-primary-600">Registro Permanente</p>
                  <p className="md:hidden text-xs font-normal text-primary-500 mb-1">(Autorización exclusiva: Administrador AVI)</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <form action={aprobarTerapeuta} className="flex items-center gap-2 flex-wrap">
                    <input type="hidden" name="therapistId" value={t.id} />
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500">Pac:</label>
                      <select name="slots" defaultValue="10"
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                        {[3, 5, 10, 15, 20, 30, 40].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500">Tier:</label>
                      <select name="tier" defaultValue="esencial"
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                        <option value="esencial">Esencial</option>
                        <option value="clinico">Clínico</option>
                      </select>
                    </div>
                    <button type="submit"
                      className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                      Reactivar
                    </button>
                  </form>
                  <DesactivarTherapistButton
                    therapistId={t.id}
                    displayName={t.full_name ?? t.email ?? 'este terapeuta'}
                    action={desactivarTerapeuta}
                  />
                </div>
                </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Desactivados ── */}
      {desactivados.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-500 mb-3">
            🔒 Desactivados ({desactivados.length})
          </h2>
          <div className="space-y-3">
            {desactivados.map(t => (
              <div key={t.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 opacity-75">
                <div className="flex-1">
                  <p className="font-medium text-gray-600">{t.full_name ?? '—'}</p>
                  <p className="text-sm text-gray-400">{t.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Desactivado · datos conservados (NOM-024)
                  </p>
                </div>
                <form action={reactivarPerfil}>
                  <input type="hidden" name="therapistId" value={t.id} />
                  <button type="submit"
                    className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                    ✓ Reactivar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Resumen estratégico de asesorías ── */}
      <section>
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="text-base font-semibold text-primary-700">
              📊 Resumen estratégico — asesorías
            </h2>
            <p className="text-sm text-gray-400 capitalize mt-0.5">{nombreMes(year, month)}</p>
          </div>
          {/* Navegador de meses */}
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/terapeutas?mes=${prevMonth}`}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
            >
              ← ant.
            </Link>
            <Link
              href={isCurrentMonth ? '#' : `/admin/terapeutas?mes=${nextMonth}`}
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

        {(!sesionesMes || sesionesMes.length === 0) ? (
          <p className="text-sm text-gray-400">Sin sesiones registradas en {nombreMes(year, month)}.</p>
        ) : (() => {
          // Agrupar por terapeuta
          type Stats = { esFact: number; esPb: number; fsFact: number; fsPb: number; virtFact: number; virtPb: number }
          const statsMap: Record<string, Stats> = {}
          for (const s of sesionesMes) {
            if (!statsMap[s.therapist_id]) statsMap[s.therapist_id] = { esFact: 0, esPb: 0, fsFact: 0, fsPb: 0, virtFact: 0, virtPb: 0 }
            const virt = (s as Record<string, unknown>).is_virtual as boolean ?? false
            const fs   = esFindeSemana(s.session_date)
            if (virt  &&  s.is_pro_bono) statsMap[s.therapist_id].virtPb++
            if (virt  && !s.is_pro_bono) statsMap[s.therapist_id].virtFact++
            if (!virt && fs  &&  s.is_pro_bono) statsMap[s.therapist_id].fsPb++
            if (!virt && fs  && !s.is_pro_bono) statsMap[s.therapist_id].fsFact++
            if (!virt && !fs &&  s.is_pro_bono) statsMap[s.therapist_id].esPb++
            if (!virt && !fs && !s.is_pro_bono) statsMap[s.therapist_id].esFact++
          }

          const filas = (terapeutas ?? [])
            .filter(t => statsMap[t.id])
            .map(t => ({ t, s: statsMap[t.id] }))

          const totEsFact   = filas.reduce((a, f) => a + f.s.esFact, 0)
          const totEsPb     = filas.reduce((a, f) => a + f.s.esPb, 0)
          const totFsFact   = filas.reduce((a, f) => a + f.s.fsFact, 0)
          const totFsPb     = filas.reduce((a, f) => a + f.s.fsPb, 0)
          const totVirtFact = filas.reduce((a, f) => a + f.s.virtFact, 0)
          const totVirtPb   = filas.reduce((a, f) => a + f.s.virtPb, 0)
          const totTotal    = totEsFact + totEsPb + totFsFact + totFsPb + totVirtFact + totVirtPb

          return (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Terapeuta</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">ES Fact.</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">ES PB</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">FS Fact.</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">FS PB</th>
                    <th className="px-4 py-3 font-medium text-blue-500 text-xs uppercase tracking-wide text-right">Virt. Fact.</th>
                    <th className="px-4 py-3 font-medium text-blue-500 text-xs uppercase tracking-wide text-right">Virt. PB</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">PB %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filas.map(({ t, s }) => {
                    const tot = s.esFact + s.esPb + s.fsFact + s.fsPb + s.virtFact + s.virtPb
                    const pb  = s.esPb + s.fsPb + s.virtPb
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{t.full_name ?? t.email}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{s.esFact}</td>
                        <td className="px-4 py-3 text-right text-amber-600">{s.esPb}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{s.fsFact}</td>
                        <td className="px-4 py-3 text-right text-amber-600">{s.fsPb}</td>
                        <td className="px-4 py-3 text-right text-blue-600">{s.virtFact}</td>
                        <td className="px-4 py-3 text-right text-blue-400">{s.virtPb}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">{tot}</td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {tot > 0 ? Math.round((pb / tot) * 100) : 0}%
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-primary-50 font-semibold">
                    <td className="px-4 py-3 text-primary-700">Total general</td>
                    <td className="px-4 py-3 text-right text-primary-700">{totEsFact}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{totEsPb}</td>
                    <td className="px-4 py-3 text-right text-primary-700">{totFsFact}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{totFsPb}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{totVirtFact}</td>
                    <td className="px-4 py-3 text-right text-blue-400">{totVirtPb}</td>
                    <td className="px-4 py-3 text-right text-primary-700">{totTotal}</td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {totTotal > 0 ? Math.round(((totEsPb + totFsPb + totVirtPb) / totTotal) * 100) : 0}%
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="px-5 py-2 text-xs text-gray-400 border-t border-gray-100">
                ES = entre semana (Lun–Vie) · FS = fin de semana (Sáb–Dom) · Virt. = virtual · Fact. = facturable · PB = pro-bono
              </p>
            </div>
          )
        })()}
      </section>
    </div>
  )
}
