import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/registro-consultorio
 * Registra un paciente nuevo usando el token del terapeuta.
 * Crea la cuenta, el perfil, la vinculación therapist_patients
 * y el registro de patient_expediente con Datos Generales en un solo paso.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, email, password, datosGenerales } = body

  if (!token || !email || !password || !datosGenerales?.asesorado_nombre) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── 1. Validar token y obtener terapeuta ──────────────────────────────────
  const { data: therapistProfile, error: tokenErr } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('registro_token', token)
    .eq('role', 'therapist')
    .single()

  if (tokenErr || !therapistProfile) {
    return NextResponse.json(
      { error: 'El código de registro no es válido o ha expirado.' },
      { status: 404 }
    )
  }

  // ── 2. Crear usuario en Supabase Auth ─────────────────────────────────────
  const { data: authData, error: signUpErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,   // Auto-confirmado — registro presencial
    user_metadata: {
      full_name: datosGenerales.asesorado_nombre,
      role: 'patient',
      whatsapp_phone: datosGenerales.contacto_telefono ?? '',
    },
  })

  if (signUpErr || !authData?.user) {
    const msg = signUpErr?.message?.includes('already')
      ? 'Este correo ya tiene una cuenta en AVI. Inicia sesión directamente.'
      : (signUpErr?.message ?? 'Error al crear la cuenta')
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const patientId = authData.user.id

  // ── 3. Crear perfil del paciente ──────────────────────────────────────────
  await admin.from('profiles').upsert({
    id: patientId,
    full_name: datosGenerales.asesorado_nombre,
    email,
    role: 'patient',
    whatsapp_phone: datosGenerales.contacto_telefono ?? '',
  })

  // ── 4. Vincular paciente con terapeuta ────────────────────────────────────
  await admin.from('therapist_patients').insert({
    therapist_id: therapistProfile.id,
    patient_id:   patientId,
    status:       'active',
    is_active:    true,
  })

  // ── 5. Crear expediente con Datos Generales ───────────────────────────────
  await admin.from('patient_expediente').upsert({
    patient_id:   patientId,
    therapist_id: therapistProfile.id,
    // Asesorado
    asesorado_nombre:           datosGenerales.asesorado_nombre          ?? '',
    asesorado_sexo:             datosGenerales.asesorado_sexo            ?? '',
    asesorado_edad:             datosGenerales.asesorado_edad            ?? '',
    asesorado_fecha_nacimiento: datosGenerales.asesorado_fecha_nacimiento ?? '',
    asesorado_lugar_nacimiento: datosGenerales.asesorado_lugar_nacimiento ?? '',
    asesorado_estado_civil:     datosGenerales.asesorado_estado_civil    ?? '',
    asesorado_escolaridad:      datosGenerales.asesorado_escolaridad     ?? '',
    asesorado_ocupacion:        datosGenerales.asesorado_ocupacion       ?? '',
    asesorado_religion:         datosGenerales.asesorado_religion        ?? '',
    asesorado_parroquia:        datosGenerales.asesorado_parroquia       ?? '',
    // Contacto
    contacto_telefono:          datosGenerales.contacto_telefono         ?? '',
    contacto_domicilio:         datosGenerales.contacto_domicilio        ?? '',
    // Pareja
    pareja_nombre:              datosGenerales.pareja_nombre             ?? '',
    pareja_sexo:                datosGenerales.pareja_sexo               ?? '',
    pareja_edad:                datosGenerales.pareja_edad               ?? '',
    pareja_fecha_nacimiento:    datosGenerales.pareja_fecha_nacimiento   ?? '',
    // Hijos
    hijos:                      datosGenerales.hijos                     ?? [],
    // Salud
    salud_padece_enfermedad:    datosGenerales.salud_padece_enfermedad   ?? '',
    salud_ayuda_psicologica:    datosGenerales.salud_ayuda_psicologica   ?? '',
    salud_ayuda_tiempo:         datosGenerales.salud_ayuda_tiempo        ?? '',
    salud_medicamentos:         datosGenerales.salud_medicamentos        ?? '',
    salud_medicamentos_cual:    datosGenerales.salud_medicamentos_cual   ?? '',
  }, { onConflict: 'patient_id,therapist_id' })

  // ── 6. Auto-login del paciente ────────────────────────────────────────────
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })

  if (signInErr) {
    return NextResponse.json(
      { ok: true, autoLogin: false, therapistName: therapistProfile.full_name },
      { status: 200 }
    )
  }

  return NextResponse.json(
    { ok: true, autoLogin: true, therapistName: therapistProfile.full_name },
    { status: 200 }
  )
}

/**
 * GET /api/auth/registro-consultorio?t=TOKEN
 * Valida el token y devuelve el nombre del terapeuta.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('full_name')
    .eq('registro_token', token)
    .eq('role', 'therapist')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
  }

  return NextResponse.json({ therapistName: data.full_name })
}
