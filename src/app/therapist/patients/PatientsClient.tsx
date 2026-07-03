'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Patient {
  id: string
  full_name: string | null
  email: string | null
}

export default function PatientsClient({
  patients,
  total,
}: {
  patients: Patient[]
  total: number
}) {
  const [query, setQuery] = useState('')

  const filtered = patients.filter(p => {
    const q = query.toLowerCase()
    return (
      (p.full_name ?? '').toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <div className="pt-2 pb-1">
        <h1 className="text-xl font-semibold text-gray-800">Mis pacientes</h1>
        <p className="text-sm text-gray-400">
          {total} paciente{total !== 1 ? 's' : ''} activo{total !== 1 ? 's' : ''}
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

      {/* Resultados */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          {query ? `Sin resultados para "${query}"` : 'Sin pacientes'}
        </div>
      ) : (
        filtered.map(p => (
          <Link
            key={p.id}
            href={`/therapist/patients/${p.id}`}
            className="block bg-white rounded-2xl border border-gray-100 px-5 py-4
                       hover:border-primary-200 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">{p.full_name ?? 'Sin nombre'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.email}</p>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
