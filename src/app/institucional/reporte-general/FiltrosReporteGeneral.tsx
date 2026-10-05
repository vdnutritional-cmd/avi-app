'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

interface Empresa { id: string; nombre: string }

interface Props {
  basePath: string
  empresas: Empresa[]
  empresaIdsSelected: string[]
  tipo: string
  pid: string
  mes: string
  pacientes: { id: string; nombre: string }[]
}

export default function FiltrosReporteGeneral({
  basePath, empresas, empresaIdsSelected, tipo, pid, mes, pacientes,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Estado local para feedback inmediato — se sincroniza cuando el servidor responde
  const [localSelected, setLocalSelected] = useState<string[]>(empresaIdsSelected)
  useEffect(() => { setLocalSelected(empresaIdsSelected) }, [empresaIdsSelected])

  const now = new Date()
  const defaultMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const mesSafe = /^\d{4}-\d{2}$/.test(mes) ? mes : defaultMes

  function nav(params: Record<string, string>) {
    const sp = new URLSearchParams({
      empresaIds: localSelected.join(','),
      tipo, pid, mes: mesSafe,
      ...params,
    })
    startTransition(() => router.push(`${basePath}?${sp.toString()}`))
  }

  function toggleEmpresa(id: string) {
    const set = new Set(localSelected)
    set.has(id) ? set.delete(id) : set.add(id)
    const newIds = [...set]
    setLocalSelected(newIds)                          // ← feedback visual inmediato
    const sp = new URLSearchParams({
      empresaIds: newIds.join(','),
      tipo, pid: 'all', mes: mesSafe,
    })
    startTransition(() => router.push(`${basePath}?${sp.toString()}`))
  }

  function toggleAll() {
    const allSel = empresas.every(e => localSelected.includes(e.id))
    const newIds = allSel ? [] : empresas.map(e => e.id)
    setLocalSelected(newIds)                          // ← feedback visual inmediato
    const sp = new URLSearchParams({
      empresaIds: newIds.join(','),
      tipo, pid: 'all', mes: mesSafe,
    })
    startTransition(() => router.push(`${basePath}?${sp.toString()}`))
  }

  const hasSelection = localSelected.length > 0
  const allSelected  = empresas.length > 0 && empresas.every(e => localSelected.includes(e.id))

  const selectClass = "text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 min-w-[180px]"

  return (
    <div className="space-y-4">

      {/* ── Checkboxes de empresa ── */}
      <div>
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-2">
          Empresa(s) a analizar
        </label>

        {/* Seleccionar todas — solo si hay más de una */}
        {empresas.length > 1 && (
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-50 border border-primary-100 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="accent-primary-600 w-4 h-4 shrink-0"
            />
            <span className="text-sm font-semibold text-primary-700">Seleccionar todas</span>
          </label>
        )}

        {/* Grid 2 cols en móvil, 3 en desktop */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {empresas.map(e => {
            const selected = localSelected.includes(e.id)
            return (
              <label
                key={e.id}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                  selected
                    ? 'bg-primary-50 border-primary-200 text-primary-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleEmpresa(e.id)}
                  className="accent-primary-600 w-4 h-4 shrink-0"
                />
                <span className="text-sm font-medium leading-tight">{e.nombre}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* ── Filtros secundarios: tipo + paciente (solo si hay selección) ── */}
      {hasSelection && (
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
                    tipo === t ? 'bg-primary-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-50'
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
