// Vista del Panel Institucional — la misma para Administración Institucional
// (Persona Institucional) y Administración Institucional AVI (superadmin), para
// que el Administrador AVI vea exactamente lo que ven las Personas Institucionales.
import Link from 'next/link'
import TerapeutasAcordeon from './TerapeutasAcordeon'
import type { TerapeutaRow } from './cargar-panel'

export interface EmpresaBlock {
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

// ── Vista ─────────────────────────────────────────────────────────────────────
export default function PanelInstitucionalVista({ empresaBlocks, permisos, hrefReporteGeneral, hrefReporteTerapeuta, antesDeReportes }: {
  empresaBlocks: EmpresaBlock[]
  /** Solo Administración Institucional AVI: bloques extra antes de las tarjetas de reportes */
  antesDeReportes?: React.ReactNode
  permisos: { reporteGeneral: boolean; reporteTerapeuta: boolean }
  hrefReporteGeneral: string
  hrefReporteTerapeuta: string
}) {
  return (
    <div className="space-y-8">

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-primary-700">AVI - Panel Institucional</h1>
          {empresaBlocks.length > 1 && (
            <p className="text-sm text-gray-500 mt-1">
              Tienes acceso a {empresaBlocks.length} empresas en convenio
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
            {empresaBlocks.length > 1 && (
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

      {antesDeReportes}

      {/* ── Reportes (según nivel) ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Reporte Institucional General (N1 y N2) */}
        {permisos.reporteGeneral ? (
          <SeccionActiva
            titulo="Reporte Institucional General"
            descripcion="Estadística agregada de todos los terapeutas de la empresa: sesiones, derivaciones y satisfacción."
            href={hrefReporteGeneral}
          />
        ) : (
          <SeccionBloqueada titulo="Reporte Institucional General" />
        )}

        {/* Reporte por terapeuta (solo N1) */}
        {permisos.reporteTerapeuta ? (
          <SeccionActiva
            titulo="Reporte por terapeuta"
            descripcion="Estadística de sesiones, motivos, derivaciones y satisfacción por terapeuta y empresa."
            href={hrefReporteTerapeuta}
          />
        ) : (
          <SeccionBloqueada titulo="Reporte por terapeuta" />
        )}
      </div>

    </div>
  )
}
