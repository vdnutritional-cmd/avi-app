// /therapist/subcarpetas — Mis <users> › Crear SubCarpeta (7 nov 2026, src/lib/subcarpetas.ts)
// Cualquier terapeuta: crea, renombra y elimina sus SubCarpetas (privadas, un nivel) y pone en ellas a sus personas.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { terminos } from '@/lib/terminologia'
import { getTerminologiaTerapeuta } from '@/lib/terminologia-paciente'
import { cargarSubcarpetas } from '@/lib/subcarpetas'
import SubcarpetasClient from './SubcarpetasClient'

export const dynamic = 'force-dynamic'

export default async function SubcarpetasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const [{ data: relaciones }, subcarpetas, terminologia] = await Promise.all([
    admin.from('therapist_patients')
      .select('patient_id, subcarpeta_id, is_active, profiles!patient_id(full_name, email)')
      .eq('therapist_id', user.id)
      .neq('status', 'archived'),
    cargarSubcarpetas(admin, user.id),
    getTerminologiaTerapeuta(admin, user.id),
  ])
  const w = terminos(terminologia)

  const personas = (relaciones ?? []).map(r => {
    const p = r.profiles as unknown as { full_name?: string; email?: string } | null
    return {
      id: r.patient_id as string,
      nombre: p?.full_name || p?.email || 'Sin nombre',
      email: p?.email ?? '',
      activo: r.is_active as boolean,
      subcarpeta_id: (r.subcarpeta_id as string | null) ?? null,
    }
  }).sort((a, b) => a.nombre.localeCompare(b.nombre))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">SubCarpetas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ordena a tus {w.users} en SubCarpetas con el nombre que quieras. Solo tú las ves.
          Mis {w.Users}, Mi estadística, Mis {w.Servs} y Reportes terapéuticos se pueden ver por SubCarpeta.
        </p>
      </div>
      <SubcarpetasClient subcarpetas={subcarpetas} personas={personas} w={w} />
    </div>
  )
}
