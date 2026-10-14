// Configuración › Cómo me nombran (profiles.terminologia)
// Palabras para las personas SIN empresa del terapeuta. La política completa está
// en src/lib/terminologia-paciente.ts. Se carga en el servidor para que abra al instante.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { normalizarTerminologia, TERMINOLOGIA_SIN_EMPRESA } from '@/lib/terminologia'
import ComoMeNombranForm from './ComoMeNombranForm'

export const dynamic = 'force-dynamic'

export default async function ComoMeNombranPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data } = await supabase.from('profiles').select('terminologia').eq('id', user.id).single()
  return <ComoMeNombranForm inicial={normalizarTerminologia(data?.terminologia ?? TERMINOLOGIA_SIN_EMPRESA)} userId={user.id} />
}
