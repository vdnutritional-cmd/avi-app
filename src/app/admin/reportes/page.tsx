import { createAdminClient } from '@/lib/supabase/admin'
import { getAccesoTerapeuta } from '@/lib/acceso-paciente'
import ReportesClient from './ReportesClient'

export const dynamic = 'force-dynamic'

export type TerapeutaData = {
  id: string
  full_name: string
  email: string
  whatsapp_phone: string | null
  patient_slots: number
  empresas: { id: string; nombre: string }[]
  pacientes_activos: number
  is_active: boolean
}

export type VinculoData = {
  therapist_id: string
  patient_id: string
  patient_name: string
  patient_email: string
  empresa_id: string | null
  empresa_nombre: string | null
}

/** Estado del vínculo terapeuta–paciente (Búsqueda de paciente) */
export type EstadoVinculo = 'activo' | 'sin_cupo' | 'inactividad' | 'manual' | 'archivado'

/** Búsqueda de paciente: todos los vínculos (activos, bloqueados y archivados) */
export type VinculoBusqueda = VinculoData & { estado: EstadoVinculo }

export type EmpresaData = {
  id: string
  nombre: string
}

export default async function ReportesPage() {
  const admin = createAdminClient()

  // Fetch all data in parallel
  const [
    { data: terapeutasRaw },
    { data: pacientesRaw },
    { data: subscriptions },
    { data: therapistEmpresas },
    { data: todasEmpresas },
    { data: vinculosRaw },
    authResult,
  ] = await Promise.all([
    admin.from('profiles').select('id, full_name, email, is_active').eq('role', 'therapist').order('full_name'),
    admin.from('profiles').select('id, full_name, email').eq('role', 'patient'),
    admin.from('subscriptions').select('therapist_id, patient_slots, status'),
    admin.from('therapist_empresa').select('therapist_id, empresa_id, convenio_empresas(id, nombre)'),
    admin.from('convenio_empresas').select('id, nombre').order('nombre'),
    admin
      .from('therapist_patients')
      .select('therapist_id, patient_id, empresa_id, convenio_empresas(nombre)')
      .eq('is_active', true)
      .eq('status', 'active'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  // Búsqueda de paciente: también bloqueados y archivados
  const { data: todosVinculosRaw } = await admin
    .from('therapist_patients')
    .select('therapist_id, patient_id, empresa_id, is_active, status, convenio_empresas(nombre)')

  // whatsapp_phone from auth user_metadata
  const whatsappMap = new Map<string, string>()
  for (const u of authResult.data?.users ?? []) {
    const phone = u.user_metadata?.whatsapp_phone
    if (phone) whatsappMap.set(u.id, String(phone))
  }

  // Patient profiles map
  const patientMap = new Map<string, { full_name: string; email: string }>()
  for (const p of pacientesRaw ?? []) {
    patientMap.set(p.id, { full_name: p.full_name ?? '', email: p.email ?? '' })
  }

  // Therapist → empresas map
  const therapistEmpresaMap = new Map<string, { id: string; nombre: string }[]>()
  for (const te of therapistEmpresas ?? []) {
    const empresa = te.convenio_empresas as unknown as { id: string; nombre: string } | null
    if (!empresa) continue
    if (!therapistEmpresaMap.has(te.therapist_id)) therapistEmpresaMap.set(te.therapist_id, [])
    therapistEmpresaMap.get(te.therapist_id)!.push({ id: empresa.id, nombre: empresa.nombre })
  }

  // Subscription map
  const subMap = new Map<string, number>()
  for (const s of subscriptions ?? []) {
    subMap.set(s.therapist_id, s.patient_slots ?? 0)
  }

  // Active patient count per therapist
  const patientCountMap = new Map<string, number>()
  for (const v of vinculosRaw ?? []) {
    patientCountMap.set(v.therapist_id, (patientCountMap.get(v.therapist_id) ?? 0) + 1)
  }

  // Build terapeutas array
  const terapeutas: TerapeutaData[] = (terapeutasRaw ?? []).map(t => ({
    id: t.id,
    full_name: t.full_name ?? '',
    email: t.email ?? '',
    whatsapp_phone: whatsappMap.get(t.id) ?? null,
    patient_slots: subMap.get(t.id) ?? 0,
    empresas: therapistEmpresaMap.get(t.id) ?? [],
    pacientes_activos: patientCountMap.get(t.id) ?? 0,
    is_active: (t as any).is_active !== false,
  }))

  // Build vinculos array
  const vinculos: VinculoData[] = (vinculosRaw ?? []).map(v => {
    const empresa = v.convenio_empresas as unknown as { nombre: string } | null
    const patient = patientMap.get(v.patient_id)
    return {
      therapist_id: v.therapist_id,
      patient_id: v.patient_id,
      patient_name: patient?.full_name ?? '',
      patient_email: patient?.email ?? '',
      empresa_id: v.empresa_id as string | null,
      empresa_nombre: empresa?.nombre ?? null,
    }
  })

  // Bloqueo por falta de cupo/plan (independientes): se calcula, no se guarda
  const terapeutasConIndep = [...new Set((todosVinculosRaw ?? [])
    .filter(v => v.empresa_id === null && v.is_active && v.status !== 'archived')
    .map(v => v.therapist_id as string))]
  const permitidos = new Map<string, Set<string>>(
    await Promise.all(terapeutasConIndep.map(async id =>
      [id, (await getAccesoTerapeuta(admin, id)).indepPermitidos] as const))
  )

  const vinculosBusqueda: VinculoBusqueda[] = (todosVinculosRaw ?? []).map(v => {
    const empresa = v.convenio_empresas as unknown as { nombre: string } | null
    const patient = patientMap.get(v.patient_id)
    let estado: EstadoVinculo
    if (v.status === 'archived') estado = 'archivado'
    else if (!v.is_active) estado = v.status === 'inactive' ? 'inactividad' : 'manual'
    else if (v.empresa_id === null && !permitidos.get(v.therapist_id)?.has(v.patient_id)) estado = 'sin_cupo'
    else estado = 'activo'
    return {
      therapist_id: v.therapist_id,
      patient_id: v.patient_id,
      patient_name: patient?.full_name ?? '',
      patient_email: patient?.email ?? '',
      empresa_id: v.empresa_id as string | null,
      empresa_nombre: empresa?.nombre ?? null,
      estado,
    }
  })

  const empresas: EmpresaData[] = (todasEmpresas ?? []).map(e => ({ id: e.id, nombre: e.nombre }))

  return (
    <ReportesClient
      terapeutas={terapeutas}
      vinculos={vinculos}
      vinculosBusqueda={vinculosBusqueda}
      empresas={empresas}
    />
  )
}
