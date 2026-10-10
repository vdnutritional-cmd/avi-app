import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEmpresasDeTerapeuta } from '@/lib/empresas-terapeuta'
import { logApiAccess } from '@/lib/audit/log-access'

// ─────────────────────────────────────────────────────────────
// Transferir paciente a otro terapeuta (Mis pacientes › Transferir)
//
//   GET  → vista previa (valida todo y cuenta lo que se trasladará)
//   POST → ejecuta el traslado
//
// Reglas:
//   - El receptor debe ser terapeuta activo (no desactivado) y distinto del origen.
//   - Paciente de empresa CONVENIO: el receptor debe pertenecer a esa empresa
//     (si no, se agrega primero en Admin › Terapeutas).
//   - Primero se COPIA todo; solo si todas las copias salen bien se crea el
//     vínculo del receptor y (traslado completo) se archiva el del origen.
//   - Idempotente: un reintento solo copia lo que el receptor aún no tiene.
//   - Los datos del origen no se borran (NOM-024); en traslado completo su
//     vínculo queda archived.
//   - Cada traslado queda en audit_log.
// ─────────────────────────────────────────────────────────────

const RUTA = '/api/therapist/transferir-paciente'

// Datos clínicos del vínculo terapeuta–paciente que viajan con el paciente
// (no: id, therapist_id, authorization_code_id, created_at, bundle_id, status, is_active)
const CAMPOS_VINCULO = [
  'initial_note', 'initial_note_updated_at', 'initial_note_date', 'initial_note_pro_bono',
  'initial_note_virtual', 'initial_note_motivo', 'initial_note_subyacente', 'initial_note_premisas',
  'empresa_id', 'sensacion_paciente_inicial',
  'factores_riesgo_sel', 'factores_proteccion_sel',
  'factores_riesgo_tcc', 'factores_proteccion_tcc',
  'factores_riesgo_trec', 'factores_proteccion_trec',
  'frecuencia_sesiones', 'frecuencia_config',
] as const

type Fila = Record<string, unknown>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

interface Validacion {
  tpOrigen: Fila
  receptor: { id: string; nombre: string; email: string }
  paciente: { id: string; nombre: string; email: string | null }
}

// ── Validaciones comunes a GET y POST ────────────────────────────────────────
async function validar(
  supabase: Db, admin: Db, userId: string, patientId: string, emailReceptor: string,
): Promise<{ ok: true; v: Validacion } | { ok: false; error: string; status: number }> {
  const email = emailReceptor.toLowerCase().trim()

  // 1. Vínculo activo del paciente con quien transfiere
  const { data: tpOrigen } = await supabase
    .from('therapist_patients')
    .select('*')
    .eq('therapist_id', userId)
    .eq('patient_id', patientId)
    .eq('is_active', true)
    .maybeSingle()

  if (!tpOrigen) {
    // ¿Ya se había transferido? (vínculo del origen archivado + otro terapeuta activo)
    const { data: propio } = await supabase
      .from('therapist_patients')
      .select('status')
      .eq('therapist_id', userId)
      .eq('patient_id', patientId)
      .maybeSingle()
    if (propio?.status === 'archived') {
      const { data: otro } = await admin
        .from('therapist_patients')
        .select('therapist_id, profiles!therapist_patients_therapist_id_fkey(full_name, email)')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .neq('therapist_id', userId)
        .limit(1)
      const prof = otro?.[0]?.profiles as { full_name?: string; email?: string } | { full_name?: string; email?: string }[] | null | undefined
      const p = Array.isArray(prof) ? prof[0] : prof
      const destino = p?.full_name ?? p?.email
      return {
        ok: false, status: 409,
        error: destino
          ? `Este paciente ya fue transferido a ${destino}. Ya no está en tu lista activa.`
          : 'Este paciente ya fue transferido y no está en tu lista activa.',
      }
    }
    return { ok: false, error: 'Paciente no encontrado en tu lista activa', status: 404 }
  }

  // 2. Receptor: cuenta existente, terapeuta, activo y distinto del origen
  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const receptorUser = allUsers.find(u => u.email?.toLowerCase() === email)
  if (!receptorUser) {
    return { ok: false, error: `No existe una cuenta AVI con el correo: ${emailReceptor}`, status: 404 }
  }
  if (receptorUser.id === userId) {
    return { ok: false, error: 'No puedes transferir a tu propia cuenta', status: 400 }
  }
  const { data: receptorProfile } = await admin
    .from('profiles')
    .select('full_name, role, is_active')
    .eq('id', receptorUser.id)
    .single()
  if (receptorProfile?.role !== 'therapist') {
    return { ok: false, error: `La cuenta ${emailReceptor} no es de un terapeuta`, status: 400 }
  }
  if (receptorProfile.is_active === false) {
    return { ok: false, error: `El terapeuta ${receptorProfile.full_name ?? emailReceptor} está desactivado en AVI`, status: 400 }
  }

  // 3. Paciente de empresa CONVENIO → el receptor debe pertenecer a esa empresa
  const empresaId = tpOrigen.empresa_id as string | null
  if (empresaId) {
    const empresasReceptor = await getEmpresasDeTerapeuta(admin, receptorUser.id)
    if (!empresasReceptor.some(e => e.id === empresaId)) {
      const { data: emp } = await admin.from('convenio_empresas').select('nombre').eq('id', empresaId).maybeSingle()
      const nombreEmp = emp?.nombre ?? 'la empresa del paciente'
      return {
        ok: false, status: 400,
        // **…** se muestra en negritas en la pantalla de Transferir
        error: `El terapeuta receptor no pertenece a ${nombreEmp}. Solicita su incorporación en **Administración AVI** para proceder con el cambio.`,
      }
    }
  }

  const { data: pacienteProfile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', patientId)
    .single()

  return {
    ok: true,
    v: {
      tpOrigen,
      receptor: { id: receptorUser.id, nombre: receptorProfile.full_name ?? emailReceptor, email },
      paciente: {
        id: patientId,
        nombre: pacienteProfile?.full_name ?? pacienteProfile?.email ?? patientId,
        email: pacienteProfile?.email ?? null,
      },
    },
  }
}

// ── Copia idempotente de filas por (therapist_id, patient_id) ────────────────
// Copia del origen al receptor solo las filas cuya clave aún no existe en el receptor.
async function copiarFilas(
  admin: Db, tabla: string, origenId: string, receptorId: string, patientId: string,
  clave: (f: Fila) => string,
): Promise<{ copiadas: number; error?: string }> {
  const [{ data: origen, error: e1 }, { data: destino, error: e2 }] = await Promise.all([
    admin.from(tabla).select('*').eq('therapist_id', origenId).eq('patient_id', patientId),
    admin.from(tabla).select('*').eq('therapist_id', receptorId).eq('patient_id', patientId),
  ])
  if (e1 || e2) return { copiadas: 0, error: `${tabla}: ${(e1 ?? e2)!.message}` }

  const existentes = new Set((destino ?? []).map(clave))
  const nuevas = (origen ?? [])
    .filter(f => !existentes.has(clave(f)))
    .map(({ id: _id, ...resto }) => ({ ...resto, therapist_id: receptorId }))
  if (nuevas.length === 0) return { copiadas: 0 }

  const { error } = await admin.from(tabla).insert(nuevas)
  if (error) return { copiadas: 0, error: `${tabla}: ${error.message}` }
  return { copiadas: nuevas.length }
}

// ── GET — vista previa del traslado ──────────────────────────────────────────
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const patientId     = searchParams.get('patientId')
  const emailReceptor = searchParams.get('emailReceptor')
  if (!patientId || !emailReceptor) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const admin = createAdminClient()
  const r = await validar(supabase, admin, user.id, patientId, emailReceptor)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })

  logApiAccess(supabase, user.id, RUTA, 'GET', { patient_id: patientId, receptor_id: r.v.receptor.id })

  const contar = (tabla: string) => admin.from(tabla)
    .select('*', { count: 'exact', head: true })
    .eq('therapist_id', user.id)
    .eq('patient_id', patientId)

  const [
    { count: sesionesCount },
    { count: analysesCount },
    { count: expedienteCount },
    { count: derivacionesCount },
    { count: cuestionariosCount },
  ] = await Promise.all([
    contar('therapist_session_notes'),
    contar('analyses'),
    contar('patient_expediente'),
    contar('patient_derivaciones_cierres'),
    contar('patient_questionnaires'),
  ])

  return NextResponse.json({
    paciente: r.v.paciente,
    receptor: r.v.receptor,
    resumen: {
      sesionesPresenciales: sesionesCount ?? 0,
      analisis:             analysesCount ?? 0,
      tieneExpediente:      (expedienteCount ?? 0) > 0,
      tieneDerivaciones:    (derivacionesCount ?? 0) > 0,
      cuestionarios:        cuestionariosCount ?? 0,
    },
  })
}

// ── POST — ejecutar el traslado ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { patientId, emailReceptor, modalidad } = body as {
    patientId:     string
    emailReceptor: string
    modalidad:     'completo' | 'compartido'
  }
  if (!patientId || !emailReceptor || (modalidad !== 'completo' && modalidad !== 'compartido')) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const admin = createAdminClient()
  const r = await validar(supabase, admin, user.id, patientId, emailReceptor)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })

  const { tpOrigen, receptor } = r.v
  const receptorId = receptor.id

  // ── 1. Copiar todo el expediente (sin tocar todavía los vínculos) ──────────
  const copias = {
    sesiones:      await copiarFilas(admin, 'therapist_session_notes', user.id, receptorId, patientId,
                     f => `${f.session_number}|${f.session_date}`),
    analisis:      await copiarFilas(admin, 'analyses', user.id, receptorId, patientId,
                     f => `${f.created_at}|${f.title}`),
    // Una fila por (terapeuta, paciente): si el receptor ya tiene la suya, se respeta
    expediente:    await copiarFilas(admin, 'patient_expediente', user.id, receptorId, patientId, () => 'unica'),
    derivaciones:  await copiarFilas(admin, 'patient_derivaciones_cierres', user.id, receptorId, patientId, () => 'unica'),
    cuestionarios: await copiarFilas(admin, 'patient_questionnaires', user.id, receptorId, patientId,
                     f => `${f.questionnaire_type}|${f.assigned_at}`),
  }

  const errores = Object.values(copias).map(c => c.error).filter(Boolean) as string[]
  if (errores.length > 0) {
    console.error('[transferir-paciente] Error al copiar:', errores)
    logApiAccess(supabase, user.id, RUTA, 'POST', {
      patient_id: patientId, receptor_id: receptorId, modalidad, resultado: 'error_copia', errores,
    })
    return NextResponse.json({
      error: 'No se pudo copiar todo el expediente, así que el paciente NO se transfirió y sigue en tu lista. '
        + 'Puedes intentarlo de nuevo (no se duplicará lo que ya se copió). Detalle: ' + errores.join(' · '),
    }, { status: 500 })
  }

  // ── 2. Vínculo del receptor con los datos clínicos del vínculo de origen ───
  const { data: tpReceptor } = await admin
    .from('therapist_patients')
    .select('*')
    .eq('therapist_id', receptorId)
    .eq('patient_id', patientId)
    .maybeSingle()

  const vinculo: Fila = { therapist_id: receptorId, patient_id: patientId, is_active: true, status: 'active' }
  for (const campo of CAMPOS_VINCULO) {
    const valorOrigen = tpOrigen[campo]
    if (valorOrigen === undefined || valorOrigen === null) continue
    // Si el receptor ya atendía activamente al paciente, no se pisan sus datos
    if (tpReceptor?.is_active && tpReceptor[campo] !== null && tpReceptor[campo] !== undefined) continue
    vinculo[campo] = valorOrigen
  }

  const { error: vinculoError } = await admin
    .from('therapist_patients')
    .upsert(vinculo, { onConflict: 'therapist_id,patient_id' })
  if (vinculoError) {
    logApiAccess(supabase, user.id, RUTA, 'POST', {
      patient_id: patientId, receptor_id: receptorId, modalidad, resultado: 'error_vinculo', error: vinculoError.message,
    })
    return NextResponse.json({
      error: 'El expediente se copió, pero no se pudo crear el vínculo con el receptor. El paciente sigue en tu lista; inténtalo de nuevo. Detalle: '
        + vinculoError.message,
    }, { status: 500 })
  }

  // ── 3. Traslado completo: archivar el vínculo de origen ─────────────────────
  if (modalidad === 'completo') {
    const { error: archivarError } = await admin
      .from('therapist_patients')
      .update({ is_active: false, status: 'archived' })
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
    if (archivarError) {
      logApiAccess(supabase, user.id, RUTA, 'POST', {
        patient_id: patientId, receptor_id: receptorId, modalidad, resultado: 'error_archivar', error: archivarError.message,
      })
      return NextResponse.json({
        error: 'El receptor ya tiene al paciente, pero no se pudo quitar de tu lista: ' + archivarError.message
          + '. Por ahora quedó como traslado compartido; inténtalo de nuevo como traslado completo.',
      }, { status: 500 })
    }
  }

  const copiado = Object.fromEntries(Object.entries(copias).map(([k, c]) => [k, c.copiadas]))
  logApiAccess(supabase, user.id, RUTA, 'POST', {
    patient_id: patientId, receptor_id: receptorId, modalidad, resultado: 'ok', copiado,
  })

  revalidatePath('/therapist/patients')
  revalidatePath('/therapist/transferir-paciente')

  return NextResponse.json({
    ok: true,
    modalidad,
    copiado,
    mensaje: modalidad === 'completo'
      ? 'Traslado completo realizado. El paciente ya no aparece en tu lista activa.'
      : 'Traslado compartido realizado. Ambos terapeutas tienen acceso al paciente.',
  })
}
