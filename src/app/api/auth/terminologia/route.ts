import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTerminologiaPaciente, getTerminologiaTerapeuta } from '@/lib/terminologia-paciente'

/**
 * GET /api/auth/terminologia
 * Palabra de quien tiene sesión, para páginas públicas como Planes y precios
 * (Inventario de Terminología, página 11).
 * → { terminologia }: persona → la suya (su empresa; sin empresa, "Cómo me nombran");
 *   terapeuta → la de su menú. Sin sesión u otro rol → null.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ terminologia: null })

  const admin = createAdminClient()
  const { data: perfil } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()

  if (perfil?.role === 'patient') {
    return NextResponse.json({ terminologia: await getTerminologiaPaciente(admin, user.id) })
  }
  if (perfil?.role === 'therapist') {
    return NextResponse.json({ terminologia: await getTerminologiaTerapeuta(admin, user.id) })
  }
  return NextResponse.json({ terminologia: null })
}
