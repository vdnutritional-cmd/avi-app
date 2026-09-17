import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15

/**
 * POST /api/auth/login
 * NOM-024-SSA3-2012 — autenticación con rate limiting y registro de intentos.
 *
 * Prerequisitos en Vercel (Settings → Environment Variables):
 *   SUPABASE_SERVICE_ROLE_KEY  — requerida para rate limiting y registro de intentos
 *
 * Prerequisitos en Supabase (SQL Editor):
 *   tabla public.auth_attempts  — ver supabase/migrations/20260917_nom024_auth_attempts.sql
 */
export async function POST(req: NextRequest) {
  // ── Validar variables de entorno requeridas ──────────────────────────────
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      '[login] CRÍTICO: variables de entorno faltantes en Vercel.',
      'SUPABASE_URL:', !!process.env.SUPABASE_URL,
      'SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    return NextResponse.json(
      { error: 'Error de configuración del servidor. Contacta al administrador.' },
      { status: 503 }
    )
  }

  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Correo y contraseña son requeridos' }, { status: 400 })
    }

    // IP para auditoría
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
      // La tabla auth_attempts no existe o hay un error de infraestructura.
      // Esto no debe ocurrir en producción — ver migración 20260917_nom024_auth_attempts.sql
      console.error('[login] ERROR: No se pudo consultar auth_attempts. ¿La migración 20260917_nom024_auth_attempts.sql se aplicó en Supabase?', countError.message)
      return NextResponse.json(
        { error: 'Error de infraestructura de seguridad. Contacta al administrador.' },
        { status: 503 }
      )
    }

    const attemptCount = count ?? 0

    if (attemptCount >= MAX_ATTEMPTS) {
      return NextResponse.json(
        {
          error: `Cuenta bloqueada temporalmente. Demasiados intentos fallidos. Intenta de nuevo en ${WINDOW_MINUTES} minutos o usa "¿Olvidaste tu contraseña?".`,
          blocked: true,
        },
        { status: 429 }
      )
    }

    // ── 2. Autenticación ─────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    const success = !authError && !!data?.user

    // ── 3. Registrar intento en audit log ────────────────────────────────────
    const { error: insertError } = await admin.from('auth_attempts').insert({
      email: email.toLowerCase(),
      ip_address: ip,
      success,
    })
    if (insertError) {
      console.error('[login] No se pudo registrar auth_attempt:', insertError.message)
      // Registramos el error pero no bloqueamos el flujo de autenticación
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
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      console.error('[login] No se pudo obtener perfil del usuario:', profileError.message)
    }

    // Verificar si el usuario tiene MFA activo
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const needsMfa = aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2'

    return NextResponse.json(
      { role: profile?.role ?? 'patient', needsMfa: needsMfa ?? false },
      { status: 200 }
    )
  } catch (e) {
    console.error('[login] Excepción no manejada:', e)
    return NextResponse.json(
      { error: 'Error interno del servidor. Revisa los logs de Vercel Functions.' },
      { status: 500 }
    )
  }
}
