import { NextResponse, type NextRequest } from 'next/server'

/**
 * Proxy de Next.js 16 — pass-through intencional.
 *
 * La autenticación y protección de rutas se delega a los layouts de servidor:
 *   - src/app/therapist/layout.tsx  (Node.js runtime, usa @supabase/ssr)
 *   - src/app/patient/layout.tsx
 *   - src/app/admin/layout.tsx
 *
 * Motivo: @supabase/ssr usa APIs de Node.js (cookies) que no están disponibles
 * en el Edge Runtime de Vercel donde corre este proxy. Intentar usar
 * createServerClient aquí causa MIDDLEWARE_INVOCATION_FAILED silencioso.
 */
export function proxy(request: NextRequest) {
  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
