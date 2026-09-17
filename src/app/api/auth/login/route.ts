import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15

/**
 * POST /api/auth/login
 * NOM-024 — Rate limiting: bloquea tras MAX_ATTEMPTS intentos fallidos en WINDOW_MINUTES minutos.
 * Registra cada intento (éxito y fallo) en public.auth_attempts via service_role.
 * El bloque de rate limiting es fail-open: si el admin client no está disponible,
 * el login funciona igualmente (nunca bloquea por fallo de infraestructura).
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Correo y contraseña son requeridos' }, { status: 400 })
    }

    // IP para auditoría (puede estar detrás de un proxy)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'

    // ── 1. Rate limiting (fail-open si admin client no disponible) ───────────
    let attemptCount = 0
    let admin: ReturnType<typeof createAdminClient> | null = null

    try {
      admin = createAdminClient()
      const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()
      const { count } = await admin
        .from('auth_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('email', email.toLowerCase())
        .eq('success', false)
        .gte('created_at', windowStart)
      attemptCount = count ?? 0
    } catch (e) {
      console.error('[login] Rate limiting no disponible (fail-open):', e)
      // No bloqueamos — continuamos con el login normal
    }

    if (attemptCount >= MAX_ATTEMPTS) {
      return NextResponse.json(
        {
          error: `Cuenta bloqueada temporalmente por seguridad. Demasiados intentos fallidos. Intenta de nuevo en ${WINDOW_MINUTES} minutos o usa "¿Olvidaste tu contraseña?".`,
          blocked: true,
        },
        { status: 429 }
      )
    }

    // ── 2. Autenticación ─────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    const success = !authError && !!data?.user

    // ── 3. Registrar intento en audit log (fire-and-forget) ──────────────────
    if (admin) {
      void admin.from('auth_attempts').insert({
        email: email.toLowerCase(),
        ip_address: ip,
        success,
      })
    }

    // ── 4. Responder ─────────────────────────────────────────────────────────
    if (!success) {
      const remaining = MAX_ATTEMPTS - (attemptCount + 1)
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

    // Verificar si el usuario tiene MFA activo
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const needsMfa = aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2'

    return NextResponse.json(
      { role: profile?.role ?? 'patient', needsMfa: needsMfa ?? false },
      { status: 200 }
    )
  } catch (e) {
    console.error('[login] Error inesperado:', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
