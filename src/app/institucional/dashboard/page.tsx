import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface TerapeutaRow {
  nombre: string
  email: string
  pacientesActivos: number
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

  // Obtener datos del PI (persona institucional)
  const { data: pi } = await admin
    .from('convenio_personas_institucionales')
    .select('nivel, opera_como_terapeuta, empresa_id, convenio_empresas(nombre)')
    .eq('therapist_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!pi) redirect('/therapist/dashboard')

  const nivel = pi.nivel as 'N1' | 'N2' | 'N3'
  const empresaId = pi.empresa_id as string
  const empresaNombre = (pi.convenio_empresas as { nombre?: string } | null)?.nombre ?? 'Empresa'

  // ── Cargar terapeutas de la empresa ──────────────────────────────────────────
  const { data: empresaRels } = await admin
    .from('therapist_empresa')
    .select('therapist_id, profiles(full_name, email)')
    .eq('empresa_id', empresaId)

  // Para cada terapeuta, contar pacientes activos
  const terapeutas: TerapeutaRow[] = await Promise.all(
    (empresaRels ?? []).map(async (rel) => {
      const p = rel.profiles as { full_name?: string; email?: string } | null
      const therapistId = rel.therapist_id as string

      const { count } = await admin
        .from('therapist_patients')
        .select('*', { count: 'exact', head: true })
        .eq('therapist_id', therapistId)
        .eq('empresa_id', empresaId)
        .eq('is_active', true)

      return {
        nombre: p?.full_name ?? 'Sin nombre',
        email:  p?.email    ?? '',
        pacientesActivos: count ?? 0,
      }
    })
  )

  const totalPacientes = terapeutas.reduce((s, t) => s + t.pacientesActivos, 0)

  const canN1N2 = nivel === 'N1' || nivel === 'N2'

  return (
    <div className="space-y-6">

      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Panel Institucional</h1>
        <p className="text-sm text-gray-500 mt-1">
          {empresaNombre} · {terapeutas.length} terapeuta{terapeutas.length !== 1 ? 's' : ''} · {totalPacientes} paciente{totalPacientes !== 1 ? 's' : ''} activo{totalPacientes !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Sección 1: Lista de terapeutas con pacientes activos (todos los niveles) ── */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-700 text-sm">Terapeutas de la empresa</h2>
        </div>
        {terapeutas.length === 0 ? (
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
              {terapeutas.map((t, i) => (
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

      {/* ── Sección 2: Estadística institucional (N1/N2); bloqueada para N3 ── */}
      {canN1N2 ? (
        <SeccionProxima
          titulo="Estadística institucional general"
          descripcion="Resumen estadístico de sesiones, avances y diagnósticos de todos los asesorados de la empresa."
        />
      ) : (
        <SeccionBloqueada titulo="Estadística institucional general" />
      )}

      {/* ── Sección 3: Reporte por terapeuta (N1/N2); bloqueada para N3 ── */}
      {canN1N2 ? (
        <SeccionProxima
          titulo="Reporte por terapeuta"
          descripcion="Reporte individual de desempeño y atención por cada terapeuta de la empresa."
        />
      ) : (
        <SeccionBloqueada titulo="Reporte por terapeuta" />
      )}

      {/* ── Sección 4: Reporte Institucional General (N1 únicamente) ── */}
      {nivel === 'N1' ? (
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
