import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logApiAccess } from '@/lib/audit/log-access'
import { procesarCierreSesion } from '@/lib/cerrar-sesion-avi'

// Cierre de sesión AVI: patrones + auto-análisis (lógica en src/lib/cerrar-sesion-avi.ts)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // NOM-024 — registro de acceso a ruta clínica
    logApiAccess(supabase, user.id, '/api/patterns', 'POST')

    const { sessionId } = await request.json()
    if (!sessionId) return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 })

    // Verificar que la sesión pertenece al usuario
    const { data: session } = await supabase
      .from('sessions')
      .select('id, patient_id, status')
      .eq('id', sessionId)
      .eq('patient_id', user.id)
      .single()

    if (!session) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
    if (session.status === 'completed') {
      return NextResponse.json({ error: 'Esta sesión ya fue procesada' }, { status: 400 })
    }

    const r = await procesarCierreSesion(supabase, sessionId, user.id)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ success: true, pattern: r.pattern })
  } catch (error) {
    console.error('Error en /api/patterns:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
