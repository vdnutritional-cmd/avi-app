// /institucional/alta-baja — Administración › Alta/Baja de <Pros>
// Persona Institucional User o Superuser (N2/N1): da de alta y de baja a los
// terapeutas de las empresas donde tiene ese nivel (sustituye a "Baja de Terapeutas").
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { NIVELES_CONFIGURACION } from '@/lib/niveles-institucionales'
import { terminos } from '@/lib/terminologia'
import { getTerminologiaTerapeuta } from '@/lib/terminologia-paciente'
import { cargarAltaBaja, type EmpresaAdministrada } from './cargar-alta-baja'
import AltaBajaPros from './AltaBajaPros'

export const dynamic = 'force-dynamic'

export default async function AltaBajaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: registros } = await admin
    .from('convenio_personas_institucionales')
    .select('empresa_id, convenio_empresas(nombre, is_active)')
    .eq('therapist_id', user.id)
    .eq('is_active', true)
    .in('nivel', NIVELES_CONFIGURACION)

  const empresas: EmpresaAdministrada[] = []
  for (const r of registros ?? []) {
    const e = (Array.isArray(r.convenio_empresas) ? r.convenio_empresas[0] : r.convenio_empresas) as { nombre: string; is_active: boolean } | null
    if (e?.is_active && !empresas.some(x => x.id === r.empresa_id)) empresas.push({ id: r.empresa_id as string, nombre: e.nombre })
  }
  empresas.sort((a, b) => a.nombre.localeCompare(b.nombre))

  const [pros, terminologia] = await Promise.all([
    cargarAltaBaja(admin, empresas),
    getTerminologiaTerapeuta(admin, user.id),
  ])
  const w = terminos(terminologia)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-700">Alta/Baja de {w.Pros}</h1>
        <p className="text-sm text-gray-500 mt-1">Los {w.pros} que participan en tus empresas en CONVENIO.</p>
      </div>
      {empresas.length === 0
        ? <p className="text-sm text-gray-500 text-center py-8">No tienes permiso para esta sección (requiere nivel User o Superuser).</p>
        : <AltaBajaPros empresas={empresas} pros={pros} w={w} />}
    </div>
  )
}
