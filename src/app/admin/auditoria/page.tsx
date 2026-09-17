import { createClient } from '@/lib/supabase/server'
import AuditoriaClient from './AuditoriaClient'

export const dynamic = 'force-dynamic'

export default async function AuditoriaPage() {
  const supabase = await createClient()

  // Cargar primeros 500 registros — el cliente filtra y exporta
  const { data: logs } = await supabase
    .from('audit_log')
    .select('id, usuario_id, operacion, tabla, registro_id, datos_antes, datos_despues, created_at, profiles!audit_log_usuario_id_fkey(email, role)')
    .order('created_at', { ascending: false })
    .limit(500)

  return <AuditoriaClient logs={logs ?? []} />
}
