import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/logout
 * Cierra la sesión del usuario en el servidor — invalida el token en Supabase
 * y borra las cookies de sesión. No depende del cliente de browser.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error('[logout] Error al cerrar sesión:', e)
    // Aunque falle el signOut en Supabase, redirigimos al login —
    // las cookies expiradas causan que el layout redirija de todos modos.
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
