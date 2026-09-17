import { NextResponse, type NextRequest } from 'next/server'

/**
 * Proxy mínimo de diagnóstico — pasa todos los requests sin lógica de auth.
 * TODO: restaurar lógica completa de Supabase + rol una vez confirmado el fix.
 */
export function proxy(request: NextRequest) {
  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
