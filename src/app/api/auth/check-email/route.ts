// ─────────────────────────────────────────────────────────────
// POST /api/auth/check-email  { email }
// Registro de terapeuta: indica si el correo ya tiene una cuenta en AVI,
// para no "aceptar" un registro duplicado (Supabase signUp no lo avisa).
// Solo responde si existe y si es terapeuta — nada más.
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarCuentaPorEmail } from '@/lib/registro-email'

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({ email: '' }))
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Correo requerido' }, { status: 400 })
  }

  const cuenta = await buscarCuentaPorEmail(createAdminClient(), email)
  return NextResponse.json({
    exists: !!cuenta,
    esTerapeuta: cuenta?.role === 'therapist',
  })
}
