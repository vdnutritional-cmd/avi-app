// ─────────────────────────────────────────────────────────────
// ¿Puede este usuario administrar esta empresa en CONVENIO?
// Sí: el superadmin (SaaS Controller › AVI Administración) o una Persona
// Institucional activa con nivel User o Superuser (N2/N1) EN ESA empresa.
// Lo usan Configuración Admin y Alta/Baja de <Pros>. Solo servidor.
// ─────────────────────────────────────────────────────────────
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NIVELES_CONFIGURACION } from '@/lib/niveles-institucionales'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'pepe.vargas.papa@gmail.com'

export async function autorizarEmpresa(empresaId: unknown) {
  if (typeof empresaId !== 'string' || !empresaId) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (user.email === ADMIN_EMAIL) return { supabase, user }

  const { data } = await createAdminClient()
    .from('convenio_personas_institucionales')
    .select('id')
    .eq('therapist_id', user.id)
    .eq('empresa_id', empresaId)
    .eq('is_active', true)
    .in('nivel', NIVELES_CONFIGURACION)
    .limit(1)
  return data && data.length > 0 ? { supabase, user } : null
}
