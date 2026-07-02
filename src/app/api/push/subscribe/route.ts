import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'therapist') {
      return NextResponse.json({ error: 'Solo terapeutas pueden suscribirse' }, { status: 403 })
    }

    const body = await request.json()
    const { endpoint, keys } = body

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Subscription inválida' }, { status: 400 })
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { therapist_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        { onConflict: 'therapist_id,endpoint' }
      )

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error en /api/push/subscribe:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
