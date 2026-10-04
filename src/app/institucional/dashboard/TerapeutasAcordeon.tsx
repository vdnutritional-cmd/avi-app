'use client'

import { useState } from 'react'

interface PacienteItem { id: string; nombre: string }

interface TerapeutaRow {
  therapistId: string
  nombre: string
  email: string
  telefono: string
  empresa: string
  isHuerfano: boolean
  pacientes: PacienteItem[]
  pacientesActivos: number
}

export default function TerapeutasAcordeon({ terapeutas }: { terapeutas: TerapeutaRow[] }) {
  const [open, setOpen] = useState(false)
  // Filas expandidas por clave "empresa|index"
  const [openRows, setOpenRows] = useState<Set<string>>(new Set())

  const toggleRow = (key: string) =>
    setOpenRows(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // Group by empresa, sorted alphabetically
  const empresas = Array.from(new Set(terapeutas.map(t => t.empresa))).sort()
  const grouped = empresas.map(emp => ({
    empresa: emp,
    rows: terapeutas.filter(t => t.empresa === emp),
  }))

  const huerfanosTotal = terapeutas.filter(t => t.isHuerfano).length

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header acordeón principal */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4
                   hover:bg-gray-50 transition-colors"
      >
        <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
          Terapeutas registrados{' '}
          <span className="text-gray-400 font-normal">({terapeutas.length})</span>
          {huerfanosTotal > 0 && (
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
              ⚠️ {huerfanosTotal} requiere{huerfanosTotal > 1 ? 'n' : ''} atención
            </span>
          )}
        </h3>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Contenido colapsable */}
      {open && (
        terapeutas.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center border-t border-gray-50">
            No hay terapeutas registrados todavía.
          </p>
        ) : (
          <table className="w-full text-sm border-t border-gray-50">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-6"></th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Terapeuta</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Empresa</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Teléfono</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Correo</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pac. activos</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => (
                <>
                  {/* Subtítulo de empresa */}
                  <tr key={`heading-${group.empresa}`}>
                    <td
                      colSpan={6}
                      className="px-5 py-2 bg-primary-50 border-t border-primary-100"
                    >
                      <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">
                        {group.empresa}
                      </span>
                    </td>
                  </tr>

                  {/* Filas de terapeutas */}
                  {group.rows.map((t, i) => {
                    const rowKey = `${group.empresa}|${i}`
                    const isOpen = openRows.has(rowKey)
                    const hasDetail = t.pacientes.length > 0

                    return (
                      <>
                        {/* Fila principal del terapeuta */}
                        <tr
                          key={`row-${rowKey}`}
                          onClick={() => hasDetail && toggleRow(rowKey)}
                          className={`border-t border-gray-50 transition-colors
                            ${hasDetail ? 'cursor-pointer hover:bg-gray-50' : ''}
                            ${isOpen ? 'bg-gray-50' : ''}
                          `}
                        >
                          {/* Icono toggle */}
                          <td className="pl-3 pr-1 py-3.5 text-gray-400 w-6">
                            {hasDetail ? (
                              <svg
                                className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            ) : null}
                          </td>

                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">{t.nombre}</span>
                              {t.isHuerfano && (
                                <span className="inline-flex items-center bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                  ⚠️ Sin empresa activa
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-3.5 text-gray-500 hidden md:table-cell">{t.empresa}</td>
                          <td className="px-3 py-3.5 text-gray-500 hidden sm:table-cell">
                            {t.telefono || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-3.5 text-gray-500 hidden lg:table-cell">{t.email}</td>
                          <td className="px-3 py-3.5 text-right">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm
                              ${t.isHuerfano ? 'bg-red-100 text-red-700' : 'bg-primary-50 text-primary-700'}`}>
                              {t.pacientesActivos}
                            </span>
                          </td>
                        </tr>

                        {/* Fila de detalle expandible */}
                        {isOpen && (
                          <tr key={`detail-${rowKey}`} className="bg-gray-50 border-t border-gray-100">
                            <td colSpan={6} className="px-8 pb-4 pt-2">
                              {/* Alerta huérfano */}
                              {t.isHuerfano && (
                                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 leading-relaxed">
                                  <div className="font-bold mb-1">⚠️ Este terapeuta ya no opera con {t.empresa}</div>
                                  <div>
                                    Aún tiene <strong>{t.pacientes.length}</strong> paciente{t.pacientes.length !== 1 ? 's' : ''} activo{t.pacientes.length !== 1 ? 's' : ''} sin nuevo terapeuta asignado.
                                    Es necesario que el terapeuta inicie sesión en AVI y transfiera sus pacientes desde{' '}
                                    <strong>Registro de pacientes → Transferir paciente a otro terapeuta</strong>.
                                  </div>
                                  <div className="mt-2 text-red-700 text-xs">
                                    Contactar al terapeuta:{' '}
                                    {t.email && <span className="font-medium">{t.email}</span>}
                                    {t.telefono && <span className="font-medium"> · {t.telefono}</span>}
                                  </div>
                                </div>
                              )}

                              {/* Lista de pacientes */}
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Pacientes activos en {t.empresa}
                              </div>
                              <ul className="space-y-1">
                                {t.pacientes.map((pac) => (
                                  <li key={pac.id} className="flex items-center gap-2 text-sm text-gray-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0" />
                                    {pac.nombre}
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  )
}
