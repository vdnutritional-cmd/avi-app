import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/auth/confirm-patient
 * Auto-confirma el email de un paciente recién registrado.
 * Los pacientes no necesitan confirmar su correo manualmente
 * (muchos son de bajos recursos y no tienen acceso fácil al correo).
 * Los terapeutas sí pasan por la confirmación normal de Supabase.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    })

    if (error) {
      console.error('[confirm-patient] Error al confirmar email:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[confirm-patient] Error inesperado:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
