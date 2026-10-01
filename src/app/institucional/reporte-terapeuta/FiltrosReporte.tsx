'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

interface Empresa { id: string; nombre: string }
interface Terapeuta { id: string; nombre: string; email: string }

interface FiltrosReporteProps {
  basePath: string              // '/institucional/reporte-terapeuta'
  showTerapeutaFilter: boolean  // false para reporte-general
  empresas: Empresa[]
  terapeutas: Terapeuta[]       // vacío si no hay empresa seleccionada
  empresaId: string
  terapeutaId: string           // 'all' o un uuid
  tipo: string
  pid: string
  mes: string
  pacientes: { id: string; nombre: string }[]
}

export default function FiltrosReporte({
  basePath, showTerapeutaFilter,
  empresas, terapeutas,
  empresaId, terapeutaId, tipo, pid, mes,
  pacientes,
}: FiltrosReporteProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function nav(params: Record<string, string>) {
    const sp = new URLSearchParams({ empresaId, terapeutaId, tipo, pid, mes, ...params })
    startTransition(() => router.push(`${basePath}?${sp.toString()}`))
  }

  function onEmpresa(val: string) {
    // Al cambiar empresa, resetear terapeuta y paciente
    const sp = new URLSearchParams({ empresaId: val, terapeutaId: 'all', tipo, pid: 'all', mes })
    startTransition(() => router.push(`${basePath}?${sp.toString()}`))
  }

  function onTerapeuta(val: string) {
    // Al cambiar terapeuta, resetear paciente
    const sp = new URLSearchParams({ empresaId, terapeutaId: val, tipo, pid: 'all', mes })
    startTransition(() => router.push(`${basePath}?${sp.toString()}`))
  }

  const selectClass = "text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 min-w-[180px]"

  return (
    <div className="space-y-3">
      {/* Fila 1: Empresa + Terapeuta */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Empresa a analizar</label>
          <select
            value={empresaId}
            onChange={e => onEmpresa(e.target.value)}
            className={selectClass}
          >
            <option value="">— Selecciona empresa —</option>
            {empresas.map(e => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </div>

        {showTerapeutaFilter && empresaId && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Terapeuta</label>
            <select
              value={terapeutaId}
              onChange={e => onTerapeuta(e.target.value)}
              className={selectClass}
            >
              <option value="all">Total terapeutas</option>
              {terapeutas.map(t => (
                <option key={t.id} value={t.id}>{t.nombre || t.email}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Fila 2: Tipo + Paciente (solo si hay empresa seleccionada) */}
      {empresaId && (
        <div className="flex flex-wrap gap-3 items-end">
          {/* Toggle tipo */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Estatus pacientes</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white text-sm">
              {(['activos', 'inactivos', 'total'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => nav({ tipo: t, pid: 'all' })}
                  className={`px-3 py-2 capitalize transition-colors ${
                    tipo === t
                      ? 'bg-primary-600 text-white font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t === 'total' ? 'activos + inactivos' : t}
                </button>
              ))}
            </div>
          </div>

          {/* Dropdown paciente */}
          {pacientes.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Paciente</label>
              <select
                value={pid}
                onChange={e => nav({ pid: e.target.value })}
                className={selectClass}
              >
                <option value="all">Total pacientes</option>
                {pacientes.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
