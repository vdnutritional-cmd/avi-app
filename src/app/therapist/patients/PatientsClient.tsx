'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Patient {
  id: string
  full_name: string | null
  email: string | null
  is_active: boolean
}

interface Props {
  activos: Patient[]
  bloqueados: Patient[]
  toggleAction: (formData: FormData) => Promise<void>
}

export default function PatientsClient({ activos, bloqueados, toggleAction }: Props) {
  const [query, setQuery] = useState('')

  const filtrar = (lista: Patient[]) => {
    const q = query.toLowerCase()
    return lista.filter(p =>
      (p.full_name ?? '').toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q)
    )
  }

  const activosFiltrados   = filtrar(activos)
  const bloqueadosFiltrados = filtrar(bloqueados)

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <div className="pt-2 pb-1">
        <h1 className="text-xl font-semibold text-gray-800">Mis pacientes</h1>
        <p className="text-sm text-gray-400">
          {activos.length} paciente{activos.length !== 1 ? 's' : ''} activo{activos.length !== 1 ? 's' : ''}
          {bloqueados.length > 0 && ` · ${bloqueados.length} bloqueado${bloqueados.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Buscador */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400
                     bg-white transition"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Activos ── */}
      {activosFiltrados.length === 0 && !query ? null : (
        <div className="space-y-2">
          {activosFiltrados.length === 0 && query ? (
            <p className="text-center py-4 text-sm text-gray-400">Sin resultados para &ldquo;{query}&rdquo;</p>
          ) : (
            activosFiltrados.map(p => (
              <div key={p.id}
                className="bg-white rounded-2xl border border-gray-100 px-5 py-4
                           hover:border-primary-200 hover:shadow-sm transition-all
                           flex items-center justify-between gap-3">
                <Link href={`/therapist/patients/${p.id}`} className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{p.full_name ?? 'Sin nombre'}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{p.email}</p>
                </Link>
                <form action={toggleAction}>
                  <input type="hidden" name="patientId"   value={p.id} />
                  <input type="hidden" name="nuevoEstado" value="false" />
                  <button type="submit"
                    onClick={e => {
                      if (!confirm(`¿Bloquear el acceso de ${p.full_name ?? p.email}?`)) e.preventDefault()
                    }}
                    className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5
                               hover:bg-red-50 transition-colors whitespace-nowrap">
                    🚫 Bloquear
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Bloqueados ── */}
      {bloqueadosFiltrados.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">
            Bloqueados
          </p>
          {bloqueadosFiltrados.map(p => (
            <div key={p.id}
              className="bg-gray-50 rounded-2xl border border-gray-100 px-5 py-4
                         flex items-center justify-between gap-3 opacity-70">
              <Link href={`/therapist/patients/${p.id}`} className="flex-1 min-w-0">
                <p className="font-medium text-gray-500 truncate">{p.full_name ?? 'Sin nombre'}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{p.email}</p>
              </Link>
              <form action={toggleAction}>
                <input type="hidden" name="patientId"   value={p.id} />
                <input type="hidden" name="nuevoEstado" value="true" />
                <button type="submit"
                  className="text-xs text-green-600 border border-green-200 rounded-lg px-3 py-1.5
                             hover:bg-green-50 transition-colors whitespace-nowrap">
                  ✓ Reactivar
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
