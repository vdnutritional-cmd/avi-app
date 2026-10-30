import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AsignacionClient from './AsignacionClient'
import { terminos } from '@/lib/terminologia'
import { getTerminologiaTerapeuta } from '@/lib/terminologia-paciente'

export default async function AsignacionInstitucionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'therapist') redirect('/patient/chat')

  const admin = createAdminClient()

  // Empresas a las que pertenece el terapeuta
  const { data: empresaRels } = await admin
    .from('therapist_empresa')
    .select('empresa_id, convenio_empresas(nombre)')
    .eq('therapist_id', user.id)

  const empresas = (empresaRels ?? []).map(r => ({
    id: r.empresa_id as string,
    nombre: (r.convenio_empresas as { nombre?: string } | null)?.nombre ?? 'Empresa',
  }))

  // Si no pertenece a ninguna empresa, no tiene nada que hacer aquí
  if (empresas.length === 0) redirect('/therapist/patients')

  // Todos los pacientes activos del terapeuta.
  // Usamos profiles!patient_id para resolver la ambigüedad: therapist_patients
  // tiene dos FKs a profiles (therapist_id y patient_id).
  const { data: pacientesRels } = await admin
    .from('therapist_patients')
    .select('patient_id, empresa_id, profiles!patient_id(full_name, email)')
    .eq('therapist_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const pacientes = (pacientesRels ?? []).map(r => {
    const p = r.profiles as { full_name?: string; email?: string } | null
    return {
      patient_id: r.patient_id as string,
      nombre: p?.full_name ?? 'Sin nombre',
      email: p?.email ?? '',
      empresa_id: r.empresa_id as string | null,
    }
  })

  // Empresas de sus pacientes a las que el terapeuta no pertenece (p. ej. llegaron por un traslado).
  // Se muestran tal cual: antes la lista decía "Sin asignar" aunque la persona tuviera empresa.
  const propias = new Set(empresas.map(e => e.id))
  const ajenasIds = [...new Set(pacientes.map(p => p.empresa_id).filter((id): id is string => !!id && !propias.has(id)))]
  const { data: ajenas } = ajenasIds.length
    ? await admin.from('convenio_empresas').select('id, nombre').in('id', ajenasIds)
    : { data: [] }
  const otrasEmpresas = Object.fromEntries((ajenas ?? []).map(e => [e.id as string, (e.nombre as string) ?? 'Empresa']))

  // Palabras de las pantallas generales del terapeuta (Inventario de Terminología, página 4)
  const w = terminos(await getTerminologiaTerapeuta(admin, user.id))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Asignación a Institución</h1>
        <p className="text-sm text-gray-500 mt-1">
          Asigna o cambia la empresa institucional de cada {w.user}. El cambio se guarda automáticamente.
        </p>
      </div>

      <AsignacionClient pacientes={pacientes} empresas={empresas} otrasEmpresas={otrasEmpresas} w={w} />
    </div>
  )
}
