import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Callback de autenticación de Supabase.
 * Supabase redirige aquí después de confirmar el email.
 * Intercambia el código por una sesión y redirige al panel correcto.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirect') ?? null

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=no-code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] Error intercambiando código:', error.message)
    return NextResponse.redirect(`${origin}/auth/login?error=callback-failed`)
  }

  // Obtener rol del usuario para redirigir correctamente
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Si hay una ruta específica de redirect, usarla (solo si el rol permite)
  if (redirectTo) {
    const isTherapist = profile?.role === 'therapist'
    const isPatient = profile?.role === 'patient'
    if (
      (isTherapist && redirectTo.startsWith('/therapist')) ||
      (isPatient && redirectTo.startsWith('/patient'))
    ) {
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  const destination = profile?.role === 'therapist'
    ? '/therapist/dashboard'
    : '/patient/chat'

  return NextResponse.redirect(`${origin}${destination}`)
}
