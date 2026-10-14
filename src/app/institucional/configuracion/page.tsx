// /institucional/configuracion — Administración › Configuración Admin
// Solo Personas Institucionales User o Superuser (N2/N1): configuran las empresas donde tienen ese nivel.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { NIVELES_CONFIGURACION } from '@/lib/niveles-institucionales'
import ConfiguracionEmpresas, { type EmpresaConfig } from './ConfiguracionEmpresas'

export const dynamic = 'force-dynamic'

export default async function ConfiguracionAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: registros } = await admin
    .from('convenio_personas_institucionales')
    .select('empresa_id')
    .eq('therapist_id', user.id)
    .eq('is_active', true)
    .in('nivel', NIVELES_CONFIGURACION)
  const empresaIds = [...new Set((registros ?? []).map(r => r.empresa_id as string))]

  const { data: empresas } = empresaIds.length
    ? await admin.from('convenio_empresas').select('id, nombre, terminologia, telefono, telefono_solicitudes, logo_url')
        .in('id', empresaIds).eq('is_active', true).order('nombre')
    : { data: [] }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-700">Configuración Admin</h1>
        <p className="text-sm text-gray-500 mt-1">
          Terminología, teléfono de contacto y logo de cada empresa a la que perteneces.
        </p>
      </div>
      {empresaIds.length === 0
        ? <p className="text-sm text-gray-500 text-center py-8">No tienes permiso para esta sección (requiere nivel User o Superuser).</p>
        : <ConfiguracionEmpresas empresas={(empresas ?? []) as EmpresaConfig[]} />}
    </div>
  )
}
