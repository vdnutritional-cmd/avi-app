'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

// Selector común de empresas de Administración Institucional AVI.
// Al cambiar empresas se conservan mes y estatus; terapeuta y paciente se reinician.

interface Empresa { id: string; nombre: string }

export default function SelectorEmpresasAVI({ empresas, selectedIds }: { empresas: Empresa[]; selectedIds: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Feedback inmediato; se sincroniza cuando responde el servidor
  const [local, setLocal] = useState<string[]>(selectedIds)
  useEffect(() => { setLocal(selectedIds) }, [selectedIds])

  // Mientras carga: el contenido se atenúa (mismo atributo que los filtros de los reportes)
  useEffect(() => {
    document.documentElement.toggleAttribute('data-reporte-cargando', isPending)
    return () => document.documentElement.removeAttribute('data-reporte-cargando')
  }, [isPending])

  function ir(ids: string[]) {
    setLocal(ids)
    const sp = new URLSearchParams({ empresaIds: ids.join(',') })
    const mes = searchParams.get('mes');   if (mes) sp.set('mes', mes)
    const tipo = searchParams.get('tipo'); if (tipo) sp.set('tipo', tipo)
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }

  const todas = empresas.length > 0 && empresas.every(e => local.includes(e.id))

  function toggle(id: string) {
    ir(local.includes(id) ? local.filter(x => x !== id) : [...local, id])
  }

  return (
    <div className="bg-white border border-primary-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Empresas en Convenio</p>
        {isPending && (
          <span className="flex items-center gap-2 text-sm text-primary-600">
            <span className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            Actualizando…
          </span>
        )}
      </div>

      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-50 border border-primary-100 cursor-pointer">
        <input
          type="checkbox"
          checked={todas}
          onChange={() => ir(todas ? [] : empresas.map(e => e.id))}
          className="accent-primary-600 w-4 h-4 shrink-0"
        />
        <span className="text-sm font-semibold text-primary-700">Todas las empresas</span>
      </label>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {empresas.map(e => {
          const sel = local.includes(e.id)
          return (
            <label
              key={e.id}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                sel
                  ? 'bg-primary-50 border-primary-200 text-primary-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input type="checkbox" checked={sel} onChange={() => toggle(e.id)} className="accent-primary-600 w-4 h-4 shrink-0" />
              <span className="text-sm font-medium leading-tight">{e.nombre}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
