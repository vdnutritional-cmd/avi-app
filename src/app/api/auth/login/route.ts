import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15

/**
 * POST /api/auth/login
 * NOM-024 — Rate limiting: bloquea tras MAX_ATTEMPTS intentos fallidos en WINDOW_MINUTES minutos.
 * Registra cada intento (éxito y fallo) en public.auth_attempts via service_role.
 */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Correo y contraseña son requeridos' }, { status: 400 })
  }

  // IP para auditoría (puede estar detrás de un proxy)
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const admin = createAdminClient()

  // ── 1. Verificar rate limit ──────────────────────────────────────────────
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

  const { count, error: countError } = await admin
    .from('auth_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('email', email.toLowerCase())
    .eq('success', false)
    .gte('created_at', windowStart)

  if (countError) {
    console.error('[login] Error consultando auth_attempts:', countError)
    // En caso de error al consultar, no bloqueamos — fail-open para no bloquear usuarios legítimos
  }

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    return NextResponse.json(
      {
        error: `Cuenta bloqueada temporalmente por seguridad. Demasiados intentos fallidos. Intenta de nuevo en ${WINDOW_MINUTES} minutos o usa "¿Olvidaste tu contraseña?".`,
        blocked: true,
      },
      { status: 429 }
    )
  }

  // ── 2. Intentar autenticación ────────────────────────────────────────────
  const supabase = await createClient()
  const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

  const success = !authError && !!data?.user

  // ── 3. Registrar intento en audit log ───────────────────────────────────
  const { error: insertError } = await admin.from('auth_attempts').insert({
    email: email.toLowerCase(),
    ip_address: ip,
    success,
  })

  if (insertError) {
    console.error('[login] Error registrando auth_attempt:', insertError)
    // No-op — no bloqueamos el flujo por fallos de auditoría
  }

  // ── 4. Responder ─────────────────────────────────────────────────────────
  if (!success) {
    // Calcular cuántos intentos quedan antes del bloqueo
    const remaining = MAX_ATTEMPTS - ((count ?? 0) + 1)
    const warningMsg =
      remaining <= 2 && remaining > 0
        ? ` (${remaining} intento${remaining === 1 ? '' : 's'} restante${remaining === 1 ? '' : 's'} antes del bloqueo)`
        : ''

    return NextResponse.json(
      { error: `Correo o contraseña incorrectos${warningMsg}` },
      { status: 401 }
    )
  }

  // Obtener rol para redirección
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  return NextResponse.json({ role: profile?.role ?? 'patient' }, { status: 200 })
}
