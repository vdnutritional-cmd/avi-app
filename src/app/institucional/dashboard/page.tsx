import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TerapeutasAcordeon from './TerapeutasAcordeon'
import { permisosPI } from '@/lib/niveles-institucionales'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface PacienteItem { id: string; nombre: string }

interface TerapeutaRow {
  therapistId: string
  nombre: string
  email: string
  telefono: string
  empresa: string
  /** true si ya NO está en therapist_empresa pero aún tiene pacientes activos */
  isHuerfano: boolean
  pacientes: PacienteItem[]
  pacientesActivos: number
}

interface EmpresaBlock {
  empresaId: string
  empresaNombre: string
  empresaLogoUrl: string | null
  nivel: 'N1' | 'N2' | 'N3'
  terapeutas: TerapeutaRow[]
}

// ── Componentes UI simples ─────────────────────────────────────────────────────
function SeccionBloqueada({ titulo }: { titulo: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 opacity-60 select-none">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-500 text-sm">{titulo}</h3>
        <span className="text-xs bg-gray-200 text-gray-500 px-2 py-1 rounded-full font-medium">
          Próximamente
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Esta sección no está disponible para tu nivel de acceso.
      </p>
    </div>
  )
}


function SeccionActiva({ titulo, descripcion, href }: { titulo: string; descripcion: string; href: string }) {
  return (
    <Link
      href={href}
      className="group bg-white border border-primary-100 rounded-2xl p-5 hover:border-primary-300 hover:shadow-sm transition-all block"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-700 text-sm group-hover:text-primary-700 transition-colors">{titulo}</h3>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{descripcion}</p>
        </div>
        <span className="shrink-0 text-primary-400 group-hover:text-primary-600 transition-colors text-lg mt-0.5">→</span>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
        <span className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full font-medium">Disponible</span>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-white bg-primary-600 px-4 py-1.5 rounded-lg shadow-sm transition-colors group-hover:bg-primary-700">
          Ver reporte <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default async function InstitucionalDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  // Fetch todos los registros institucionales activos.
  // .maybeSingle() falla cuando hay más de una fila; usamos array.
  const { data: piRecords } = await admin
    .from('convenio_personas_institucionales')
    .select('nivel, opera_como_terapeuta, empresa_id, convenio_empresas(nombre, logo_url)')
    .eq('therapist_id', user.id)
    .eq('is_active', true)

  if (!piRecords || piRecords.length === 0) redirect('/therapist/dashboard')

  // ── Teléfonos desde user_metadata ─────────────────────────────────────────
  const { data: authUsersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const whatsappMap = new Map<string, string>()
  for (const u of authUsersData?.users ?? []) {
    const phone = u.user_metadata?.whatsapp_phone
    if (phone) whatsappMap.set(u.id, String(phone))
  }

  // ── Cargar terapeutas y pacientes por empresa ──────────────────────────────
  const empresaBlocks: EmpresaBlock[] = await Promise.all(
    piRecords.map(async (pi) => {
      const empresaId = pi.empresa_id as string
      const empresaData = pi.convenio_empresas as { nombre?: string; logo_url?: string | null } | null
      const empresaNombre  = empresaData?.nombre   ?? 'Empresa'
      const empresaLogoUrl = empresaData?.logo_url ?? null
      const nivel = pi.nivel as 'N1' | 'N2' | 'N3'

      // Fuente 1: terapeutas registrados en therapist_empresa para esta empresa
      const { data: empresaRels } = await admin
        .from('therapist_empresa')
        .select('therapist_id, profiles!therapist_id(full_name, email, is_active)')
        .eq('empresa_id', empresaId)

      // Fuente 2: PIs con opera_como_terapeuta=true (pueden ser terapeutas activos
      // de la empresa que aún no están en therapist_empresa)
      const { data: piTerapeutas } = await admin
        .from('convenio_personas_institucionales')
        .select('therapist_id, profiles!therapist_id(full_name, email, is_active)')
        .eq('empresa_id', empresaId)
        .eq('opera_como_terapeuta', true)
        .eq('is_active', true)

      // Ids que vienen de therapist_empresa (Fuente 1) — para detectar huérfanos
      const empresaRelIds = new Set((empresaRels ?? []).map(r => r.therapist_id as string))

      // Unión deduplicada por therapist_id — excluir perfiles desactivados (is_active=false)
      type TerapeutaEntry = { therapist_id: string; profiles: { full_name?: string; email?: string; is_active?: boolean } | null }
      const therapistMap = new Map<string, TerapeutaEntry>()
      for (const r of [...(empresaRels ?? []), ...(piTerapeutas ?? [])]) {
        const prof = r.profiles as { full_name?: string; email?: string; is_active?: boolean } | null
        if (prof?.is_active === false) continue  // terapeuta desactivado por admin
        if (!therapistMap.has(r.therapist_id as string)) {
          therapistMap.set(r.therapist_id as string, {
            therapist_id: r.therapist_id as string,
            profiles: prof,
          })
        }
      }

      // Fetch pacientes activos (con nombre) por terapeuta + empresa
      const terapeutas: TerapeutaRow[] = await Promise.all(
        Array.from(therapistMap.values()).map(async (t) => {
          const p = t.profiles as { full_name?: string; email?: string } | null
          const { data: tpRows } = await admin
            .from('therapist_patients')
            .select('patient_id, profiles!therapist_patients_patient_id_fkey(full_name, email)')
            .eq('therapist_id', t.therapist_id)
            .eq('empresa_id', empresaId)
            .eq('is_active', true)

          const pacientes: PacienteItem[] = (tpRows ?? []).map((row: any) => {
            const pp = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
            return {
              id:     row.patient_id as string,
              nombre: pp?.full_name ?? pp?.email ?? row.patient_id,
            }
          })

          const isHuerfano = !empresaRelIds.has(t.therapist_id) && pacientes.length > 0

          return {
            therapistId:      t.therapist_id,
            nombre:           p?.full_name ?? 'Sin nombre',
            email:            p?.email     ?? '',
            telefono:         whatsappMap.get(t.therapist_id) ?? '',
            empresa:          empresaNombre,
            isHuerfano,
            pacientes,
            pacientesActivos: pacientes.length,
          }
        })
      )

      return { empresaId, empresaNombre, empresaLogoUrl, nivel, terapeutas }
    })
  )

  // Permisos por nivel (src/lib/niveles-institucionales.ts): N2+ Reporte General, N1 Reporte por Terapeuta
  const permisos = permisosPI(piRecords.map(r => r.nivel as string))

  return (
    <div className="space-y-8">

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-primary-700">AVI - Panel Institucional</h1>
          {piRecords.length > 1 && (
            <p className="text-sm text-gray-500 mt-1">
              Tienes acceso a {piRecords.length} empresas en convenio
            </p>
          )}
        </div>
        {/* Logos de empresa(s) — arriba a la derecha */}
        <div className="flex items-center gap-3 shrink-0">
          {empresaBlocks.map(b => b.empresaLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={b.empresaId}
              src={b.empresaLogoUrl}
              alt={b.empresaNombre}
              className="h-10 max-w-[120px] object-contain"
            />
          ))}
        </div>
      </div>

      {/* ── Bloque por empresa ─────────────────────────────────────────────── */}
      {empresaBlocks.map((bloque) => {
        const total = bloque.terapeutas.reduce((s, t) => s + t.pacientesActivos, 0)
        return (
          <section key={bloque.empresaId} className="space-y-4">
            {/* Encabezado de empresa — solo si hay más de una */}
            {piRecords.length > 1 && (
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-primary-700">{bloque.empresaNombre}</h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  bloque.nivel === 'N1' ? 'bg-green-100 text-green-700' :
                  bloque.nivel === 'N2' ? 'bg-blue-100 text-blue-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {bloque.nivel}
                </span>
              </div>
            )}

            {/* Tarjetas de resumen */}
            <div className="flex gap-6 md:w-2/3 md:mx-auto">
              {/* Verde — Terapeutas */}
              <div className="flex-1 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex flex-col items-center justify-center gap-0.5">
                <span className="text-3xl font-bold text-green-700 leading-none">
                  {bloque.terapeutas.length}
                </span>
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide mt-1">
                  Terapeutas
                </span>
              </div>
              {/* Morado — Pacientes activos */}
              <div className="flex-1 bg-primary-50 border border-primary-200 rounded-2xl px-4 py-3 flex flex-col items-center justify-center gap-0.5">
                <span className="text-3xl font-bold text-primary-700 leading-none">
                  {total}
                </span>
                <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide mt-1">
                  Pacientes activos
                </span>
              </div>
            </div>

          </section>
        )
      })}

      {/* ── Acordeón unificado de terapeutas (todas las empresas) ─────────────── */}
      {(() => {
        const allTerapeutas = empresaBlocks.flatMap(b => b.terapeutas)
        return allTerapeutas.length > 0
          ? <TerapeutasAcordeon terapeutas={allTerapeutas} />
          : null
      })()}

      {/* ── Reportes (según nivel) ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Reporte Institucional General (N1 y N2) */}
        {permisos.reporteGeneral ? (
          <SeccionActiva
            titulo="Reporte Institucional General"
            descripcion="Estadística agregada de todos los terapeutas de la empresa: sesiones, derivaciones y satisfacción."
            href="/institucional/reporte-general"
          />
        ) : (
          <SeccionBloqueada titulo="Reporte Institucional General" />
        )}

        {/* Reporte por terapeuta (solo N1) */}
        {permisos.reporteTerapeuta ? (
          <SeccionActiva
            titulo="Reporte por terapeuta"
            descripcion="Estadística de sesiones, motivos, derivaciones y satisfacción por terapeuta y empresa."
            href="/institucional/reporte-terapeuta"
          />
        ) : (
          <SeccionBloqueada titulo="Reporte por terapeuta" />
        )}
      </div>

    </div>
  )
}
