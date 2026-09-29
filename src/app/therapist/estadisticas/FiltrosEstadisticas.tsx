'use client'

import { useRouter } from 'next/navigation'

interface Props {
  tipo: 'activos' | 'inactivos' | 'total'
  pid: string
  mes: string
  pacientes: { id: string; nombre: string }[]
}

export default function FiltrosEstadisticas({ tipo, pid, mes, pacientes }: Props) {
  const router = useRouter()

  function navTo(overrides: Record<string, string>) {
    const params = new URLSearchParams({ mes, tipo, pid, ...overrides })
    router.push(`/therapist/estadisticas?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Toggle Activos / Inactivos / Total */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => navTo({ tipo: 'activos', pid: 'all' })}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tipo === 'activos'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Activos
        </button>
        <button
          onClick={() => navTo({ tipo: 'inactivos', pid: 'all' })}
          className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
            tipo === 'inactivos'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Inactivos
        </button>
        <button
          onClick={() => navTo({ tipo: 'total', pid: 'all' })}
          className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
            tipo === 'total'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Total
        </button>
      </div>

      {/* Dropdown de paciente */}
      <select
        value={pid}
        onChange={e => navTo({ pid: e.target.value })}
        className="text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-700
                   bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 min-w-[200px]"
      >
        <option value="all">Total pacientes</option>
        {pacientes.map(p => (
          <option key={p.id} value={p.id}>{p.nombre}</option>
        ))}
      </select>
    </div>
  )
}
