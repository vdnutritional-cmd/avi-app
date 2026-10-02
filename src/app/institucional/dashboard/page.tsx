import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TerapeutasAcordeon from './TerapeutasAcordeon'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface TerapeutaRow {
  nombre: string
  email: string
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
        <span className="text-xs text-primary-500 font-medium group-hover:underline">Ver reporte</span>
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

  // Nivel más alto entre todas las empresas (para gating de secciones globales)
  const NIVEL_ORDER: Record<string, number> = { N1: 1, N2: 2, N3: 3 }
  const topNivel = piRecords.reduce((best, r) =>
    NIVEL_ORDER[r.nivel] < NIVEL_ORDER[best] ? r.nivel : best,
    piRecords[0].nivel
  ) as 'N1' | 'N2' | 'N3'

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
        .select('therapist_id, profiles!therapist_id(full_name, email)')
        .eq('empresa_id', empresaId)

      // Fuente 2: PIs con opera_como_terapeuta=true (pueden ser terapeutas activos
      // de la empresa que aún no están en therapist_empresa)
      const { data: piTerapeutas } = await admin
        .from('convenio_personas_institucionales')
        .select('therapist_id, profiles!therapist_id(full_name, email)')
        .eq('empresa_id', empresaId)
        .eq('opera_como_terapeuta', true)
        .eq('is_active', true)

      // Unión deduplicada por therapist_id
      type TerapeutaEntry = { therapist_id: string; profiles: { full_name?: string; email?: string } | null }
      const therapistMap = new Map<string, TerapeutaEntry>()
      for (const r of [...(empresaRels ?? []), ...(piTerapeutas ?? [])]) {
        if (!therapistMap.has(r.therapist_id as string)) {
          therapistMap.set(r.therapist_id as string, {
            therapist_id: r.therapist_id as string,
            profiles: r.profiles as { full_name?: string; email?: string } | null,
          })
        }
      }

      // Contar pacientes activos por terapeuta filtrando por empresa_id
      const terapeutas: TerapeutaRow[] = await Promise.all(
        Array.from(therapistMap.values()).map(async (t) => {
          const p = t.profiles
          const { count } = await admin
            .from('therapist_patients')
            .select('*', { count: 'exact', head: true })
            .eq('therapist_id', t.therapist_id)
            .eq('empresa_id', empresaId)
            .eq('is_active', true)
          return {
            nombre: p?.full_name ?? 'Sin nombre',
            email:  p?.email    ?? '',
            pacientesActivos: count ?? 0,
          }
        })
      )

      return { empresaId, empresaNombre, empresaLogoUrl, nivel, terapeutas }
    })
  )

  const canN1N2 = topNivel === 'N1' || topNivel === 'N2'

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
            <div className="flex gap-3 md:w-2/3 md:mx-auto">
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

            {/* Acordeón de terapeutas */}
            <TerapeutasAcordeon terapeutas={bloque.terapeutas} />
          </section>
        )
      })}

      {/* ── Reportes (N1/N2) ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Reporte Institucional General (N1 únicamente) */}
        {topNivel === 'N1' ? (
          <SeccionActiva
            titulo="Reporte Institucional General"
            descripcion="Estadística agregada de todos los terapeutas de la empresa: sesiones, derivaciones y satisfacción."
            href="/institucional/reporte-general"
          />
        ) : (
          <SeccionBloqueada titulo="Reporte Institucional General" />
        )}

        {/* Reporte por terapeuta */}
        {canN1N2 ? (
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
