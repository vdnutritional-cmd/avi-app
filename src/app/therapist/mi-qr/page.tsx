import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MiQRClient from './MiQRClient'

export default async function MiQRPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, registro_token')
    .eq('id', user.id)
    .single()

  if (!profile?.registro_token) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
        No se pudo obtener tu código de registro. Contacta a soporte.
      </div>
    )
  }

  return (
    <MiQRClient
      therapistName={profile.full_name ?? ''}
      token={profile.registro_token}
    />
  )
}
