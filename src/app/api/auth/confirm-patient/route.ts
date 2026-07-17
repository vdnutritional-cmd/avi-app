import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/auth/confirm-patient
 * Crea al paciente COMPLETAMENTE server-side:
 *   1. Crea el usuario en Supabase Auth con email ya confirmado (HTTP directo, sin SDK)
 *   2. Marca el código de autorización como usado
 *   3. Vincula al paciente con su terapeuta en therapist_patients
 *
 * Motivo: auth.admin SDK methods fallan en Vercel serverless.
 * Solución: llamada HTTP directa a la API de Supabase Auth Admin.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, codeId, therapistId } = await req.json()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // 1. Crear usuario con email ya confirmado — HTTP directo a Supabase Auth Admin API
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: 'patient' },
      }),
    })

    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}))
      console.error('[confirm-patient] Error al crear usuario:', errBody)
      // Si el usuario ya existe, tratar como éxito parcial
      if (createRes.status !== 422) {
        return NextResponse.json({ error: errBody.msg ?? 'Error al crear cuenta' }, { status: 500 })
      }
    }

    const userData = await createRes.json().catch(() => null)
    const userId = userData?.id

    if (!userId) {
      // Intentar obtener el userId si el usuario ya existía
      const supabase = createAdminClient()
      const { data: existingUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()
      if (!existingUsers?.id) {
        return NextResponse.json({ error: 'No se pudo obtener el ID del usuario' }, { status: 500 })
      }
    }

    const finalUserId = userId ?? null
    if (!finalUserId) {
      return NextResponse.json({ error: 'ID de usuario no disponible' }, { status: 500 })
    }

    const supabase = createAdminClient()

    // 2. Marcar código como usado
    if (codeId) {
      const { error: codeError } = await supabase
        .from('authorization_codes')
        .update({ used_by: finalUserId, used_at: new Date().toISOString(), is_active: false })
        .eq('id', codeId)
      if (codeError) console.error('[confirm-patient] Error al actualizar código:', codeError)
    }

    // 3. Vincular paciente con terapeuta
    if (therapistId) {
      const { error: linkError } = await supabase
        .from('therapist_patients')
        .insert({ therapist_id: therapistId, patient_id: finalUserId, authorization_code_id: codeId ?? null })
      if (linkError) console.error('[confirm-patient] Error al vincular terapeuta-paciente:', linkError)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[confirm-patient] Error inesperado:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
