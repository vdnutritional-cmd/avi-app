import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEnfoquesPermitidos } from '@/lib/enfoques-permitidos'
import { MAX_ENFOQUES, enfoquesDePerfil, esEnfoque, perfilDeEnfoques } from '@/lib/enfoques'

/**
 * Configuración › Enfoque terapéutico del terapeuta (27 oct 2026).
 *   GET  → { perfil, permitidos, motivo, empresas, graciaHasta }: lo que puede ver y elegir (src/lib/enfoques-permitidos.ts)
 *   POST { enfoques: ['famsis','trec'] } → guarda si son 1 o 2 y todos están permitidos
 * El guardado pasa por aquí para que la regla de las empresas no se pueda saltar desde el navegador.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: perfil }, permitidos] = await Promise.all([
    admin.from('profiles').select('therapy_profile').eq('id', user.id).single(),
    getEnfoquesPermitidos(admin, user.id),
  ])
  return NextResponse.json({
    perfil: perfil?.therapy_profile ?? null,
    permitidos: permitidos.enfoques,
    motivo: permitidos.motivo,
    empresas: permitidos.empresas,
    graciaHasta: permitidos.graciaHasta ?? null,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { enfoques } = await req.json().catch(() => ({}))
  const seleccion = Array.isArray(enfoques) ? [...new Set(enfoques)] : []
  if (seleccion.length === 0) return NextResponse.json({ error: 'Selecciona al menos un enfoque terapéutico.' }, { status: 400 })
  if (seleccion.length > MAX_ENFOQUES) return NextResponse.json({ error: `Máximo ${MAX_ENFOQUES} enfoques terapéuticos.` }, { status: 400 })
  if (!seleccion.every(esEnfoque)) return NextResponse.json({ error: 'Enfoque no válido.' }, { status: 400 })

  const admin = createAdminClient()
  const { enfoques: permitidos } = await getEnfoquesPermitidos(admin, user.id)
  if (!seleccion.every(id => permitidos.includes(id))) {
    return NextResponse.json({ error: 'Ese enfoque no está autorizado para ti. Recarga la página.' }, { status: 403 })
  }

  const perfil = perfilDeEnfoques(seleccion)
  const { error } = await admin.from('profiles').update({ therapy_profile: perfil }).eq('id', user.id)
  if (error) return NextResponse.json({ error: 'Error al guardar. Intenta de nuevo.' }, { status: 500 })
  return NextResponse.json({ ok: true, perfil, enfoques: enfoquesDePerfil(perfil) })
}
