'use client'

import { useState } from 'react'

interface TerapeutaRow {
  nombre: string
  email:  string
  pacientesActivos: number
}

export default function TerapeutasAcordeon({ terapeutas }: { terapeutas: TerapeutaRow[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header acordeón */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4
                   hover:bg-gray-50 transition-colors"
      >
        <h3 className="font-semibold text-gray-700 text-sm">Terapeutas de la empresa</h3>
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
            No hay terapeutas registrados en esta empresa todavía.
          </p>
        ) : (
          <table className="w-full text-sm border-t border-gray-50">
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
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full
                                     bg-primary-50 text-primary-700 font-bold text-sm">
                      {t.pacientesActivos}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  )
}
