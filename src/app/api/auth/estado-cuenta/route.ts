import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/auth/estado-cuenta
 * Header: Authorization: Bearer <access_token de Supabase>
 *
 * Para la app móvil AVI-TCA (inicia sesión directo con Supabase, sin pasar por
 * /api/auth/login). Misma regla que el login web:
 *   - Terapeuta desactivado (profiles.is_active=false) → no entra
 *   - Excepción: Persona Institucional activa → solo Administración Institucional
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [{ data: profile }, { data: piRows }] = await Promise.all([
    admin.from('profiles').select('role, is_active').eq('id', user.id).single(),
    admin.from('convenio_personas_institucionales')
      .select('id')
      .eq('therapist_id', user.id)
      .eq('is_active', true)
      .limit(1),
  ])

  const desactivado = profile?.role === 'therapist' && profile.is_active === false
  const institucional = (piRows?.length ?? 0) > 0

  return NextResponse.json({ desactivado, institucional })
}
