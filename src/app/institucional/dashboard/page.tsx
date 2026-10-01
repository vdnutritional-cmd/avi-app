import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface TerapeutaRow {
  nombre: string
  email: string
  pacientesActivos: number
}

interface EmpresaBlock {
  empresaId: string
  empresaNombre: string
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

function SeccionProxima({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 text-sm">{titulo}</h3>
        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full font-medium">
          Próximamente
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-2">{descripcion}</p>
      <button
        disabled
        className="mt-4 w-full py-2 bg-gray-100 text-gray-400 text-sm rounded-xl cursor-not-allowed font-medium"
      >
        Disponible próximamente
      </button>
    </div>
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
    .select('nivel, opera_como_terapeuta, empresa_id, convenio_empresas(nombre)')
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
      const empresaNombre = (pi.convenio_empresas as { nombre?: string } | null)?.nombre ?? 'Empresa'
      const nivel = pi.nivel as 'N1' | 'N2' | 'N3'

      // Consultamos therapist_patients directamente por empresa_id.
      // Esto incluye todos los terapeutas que tienen pacientes asignados a esta empresa,
      // independientemente de si están en therapist_empresa o no.
      const { data: patientRows } = await admin
        .from('therapist_patients')
        .select('therapist_id, profiles!therapist_id(full_name, email)')
        .eq('empresa_id', empresaId)
        .eq('is_active', true)

      // Agrupar por terapeuta y contar
      const therapistMap = new Map<string, { nombre: string; email: string; count: number }>()
      for (const row of patientRows ?? []) {
        const tid = row.therapist_id as string
        const p = row.profiles as { full_name?: string; email?: string } | null
        const existing = therapistMap.get(tid)
        if (existing) {
          existing.count++
        } else {
          therapistMap.set(tid, {
            nombre: p?.full_name ?? 'Sin nombre',
            email:  p?.email    ?? '',
            count: 1,
          })
        }
      }

      const terapeutas: TerapeutaRow[] = Array.from(therapistMap.values()).map(t => ({
        nombre: t.nombre,
        email:  t.email,
        pacientesActivos: t.count,
      }))

      return { empresaId, empresaNombre, nivel, terapeutas }
    })
  )

  const canN1N2 = topNivel === 'N1' || topNivel === 'N2'

  return (
    <div className="space-y-8">

      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Panel Institucional</h1>
        {piRecords.length > 1 && (
          <p className="text-sm text-gray-500 mt-1">
            Tienes acceso a {piRecords.length} empresas en convenio
          </p>
        )}
      </div>

      {/* ── Bloque por empresa ─────────────────────────────────────────────── */}
      {empresaBlocks.map((bloque) => {
        const total = bloque.terapeutas.reduce((s, t) => s + t.pacientesActivos, 0)
        return (
          <section key={bloque.empresaId} className="space-y-4">
            {/* Encabezado de empresa — solo si hay más de una */}
            {piRecords.length > 1 && (
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-700">{bloque.empresaNombre}</h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  bloque.nivel === 'N1' ? 'bg-green-100 text-green-700' :
                  bloque.nivel === 'N2' ? 'bg-blue-100 text-blue-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {bloque.nivel}
                </span>
              </div>
            )}

            {/* Resumen */}
            <p className="text-sm text-gray-500">
              {bloque.terapeutas.length} terapeuta{bloque.terapeutas.length !== 1 ? 's' : ''} · {total} paciente{total !== 1 ? 's' : ''} activo{total !== 1 ? 's' : ''}
            </p>

            {/* Tabla de terapeutas */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h3 className="font-semibold text-gray-700 text-sm">Terapeutas de la empresa</h3>
              </div>
              {bloque.terapeutas.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">
                  No hay terapeutas registrados en esta empresa todavía.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Terapeuta</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Correo</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pac. activos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bloque.terapeutas.map((t, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-800">{t.nombre}</td>
                        <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell">{t.email}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-50 text-primary-700 font-bold text-sm">
                            {t.pacientesActivos}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )
      })}

      {/* ── Secciones gateadas por nivel más alto (aplican a todas las empresas) ── */}

      {/* Estadística institucional (N1/N2) */}
      {canN1N2 ? (
        <SeccionProxima
          titulo="Estadística institucional general"
          descripcion="Resumen estadístico de sesiones, avances y diagnósticos de todos los asesorados de la empresa."
        />
      ) : (
        <SeccionBloqueada titulo="Estadística institucional general" />
      )}

      {/* Reporte por terapeuta (N1/N2) */}
      {canN1N2 ? (
        <SeccionProxima
          titulo="Reporte por terapeuta"
          descripcion="Reporte individual de desempeño y atención por cada terapeuta de la empresa."
        />
      ) : (
        <SeccionBloqueada titulo="Reporte por terapeuta" />
      )}

      {/* Reporte Institucional General (N1 únicamente) */}
      {topNivel === 'N1' ? (
        <SeccionProxima
          titulo="Reporte Institucional General"
          descripcion="Reporte ejecutivo completo de la empresa: tendencias, estadísticas agregadas y análisis de bienestar."
        />
      ) : (
        <SeccionBloqueada titulo="Reporte Institucional General" />
      )}

    </div>
  )
}
