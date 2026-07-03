import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware de AVI
 * ─────────────────
 * 1. Refresca la sesión de Supabase en cada request
 * 2. Redirige a /login si no hay sesión
 * 3. Separa por rol: terapeuta → /therapist, paciente → /patient
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: no agregar lógica entre createServerClient y getUser()
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // ── Rutas públicas (sin sesión requerida) ──────────────────────────────────
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/install') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')

  if (isPublicRoute) {
    // Si ya tiene sesión y visita una ruta de auth, redirigir al panel correcto
    if (user && (pathname === '/' || pathname.startsWith('/auth'))) {
      return await redirectByRole(supabase, user.id, request)
    }
    return supabaseResponse
  }

  // ── Sin sesión → login ────────────────────────────────────────────────────
  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Protección por rol ────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  // Paciente intentando entrar a zona de terapeuta
  if (pathname.startsWith('/therapist') && role !== 'therapist') {
    return NextResponse.redirect(new URL('/patient/chat', request.url))
  }

  // Terapeuta intentando entrar a zona de paciente
  if (pathname.startsWith('/patient') && role !== 'patient') {
    return NextResponse.redirect(new URL('/therapist/dashboard', request.url))
  }

  return supabaseResponse
}

/** Redirige al panel correcto según el rol del usuario */
async function redirectByRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  request: NextRequest
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const destination = profile?.role === 'therapist'
    ? '/therapist/dashboard'
    : '/patient/chat'

  return NextResponse.redirect(new URL(destination, request.url))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
