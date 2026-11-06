'use client'

// Selector de periodo de los reportes estadísticos (ver src/lib/periodo.ts):
// Mes · Año (acumulado) · Total (acumulado) · Fechas (inicio y fin).
// Cambia solo el parámetro `mes` de la URL y conserva los demás filtros.
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { hoyMX, resolverPeriodo, ultimoDia, type TipoPeriodo } from '@/lib/periodo'

const TIPOS: { tipo: TipoPeriodo; label: string }[] = [
  { tipo: 'mes',   label: 'Mes' },
  { tipo: 'anio',  label: 'Año' },
  { tipo: 'total', label: 'Total' },
  { tipo: 'rango', label: 'Fechas' },
]

export default function SelectorPeriodo({ valor }: { valor: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const periodo = resolverPeriodo(valor)
  const hoy = hoyMX()
  const [tipoLocal, setTipoLocal] = useState<TipoPeriodo>(periodo.tipo)
  const [desde, setDesde] = useState(periodo.tipo === 'total' ? `${hoy.slice(0, 4)}-01-01` : periodo.inicio)
  const [hasta, setHasta] = useState(periodo.tipo === 'total' ? hoy : ultimoDia(periodo))
  useEffect(() => { setTipoLocal(periodo.tipo) }, [periodo.tipo])

  // Mientras carga: el contenido de los reportes institucionales se atenúa
  useEffect(() => {
    document.documentElement.toggleAttribute('data-reporte-cargando', isPending)
    return () => document.documentElement.removeAttribute('data-reporte-cargando')
  }, [isPending])

  function ir(clave: string) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('mes', clave)
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }

  function elegirTipo(t: TipoPeriodo) {
    setTipoLocal(t)
    const anio = periodo.inicio.slice(0, 4)
    if (t === 'mes') ir(periodo.tipo === 'anio' && anio !== hoy.slice(0, 4) ? `${anio}-12` : periodo.tipo === 'mes' ? periodo.clave : hoy.slice(0, 7))
    else if (t === 'anio') ir(periodo.tipo === 'total' ? hoy.slice(0, 4) : anio)
    else if (t === 'total') ir('total')
    // Fechas: espera a que elija inicio y fin
  }

  const rangoValido = !!desde && !!hasta && desde <= hasta
  const btn = 'px-3 py-1.5 text-sm border rounded-xl transition-colors'
  const btnActivo = `${btn} border-gray-200 hover:bg-gray-50 text-gray-600`
  const btnInactivo = `${btn} border-gray-100 text-gray-300 cursor-default`
  const inputCls = 'text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex rounded-xl border border-gray-200 overflow-hidden divide-x divide-gray-200 bg-white">
        {TIPOS.map(({ tipo, label }) => (
          <button
            key={tipo}
            onClick={() => elegirTipo(tipo)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              tipoLocal === tipo ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(tipoLocal === 'mes' || tipoLocal === 'anio') && tipoLocal === periodo.tipo && (
        <div className="flex items-center gap-2">
          <button onClick={() => periodo.anterior && ir(periodo.anterior)} className={btnActivo}>← ant.</button>
          <span className="text-sm font-medium text-gray-700 capitalize min-w-[150px] text-center">{periodo.etiqueta}</span>
          <button
            onClick={() => periodo.siguiente && ir(periodo.siguiente)}
            disabled={!periodo.siguiente}
            className={periodo.siguiente ? btnActivo : btnInactivo}
          >
            sig. →
          </button>
        </div>
      )}

      {tipoLocal === 'total' && tipoLocal === periodo.tipo && (
        <span className="text-sm text-gray-500">Desde el primer registro hasta hoy</span>
      )}

      {tipoLocal === 'rango' && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-500">
            Del <input type="date" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)} className={inputCls} />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            al <input type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} className={inputCls} />
          </label>
          <button
            onClick={() => rangoValido && ir(`${desde}_${hasta}`)}
            disabled={!rangoValido}
            className="px-4 py-1.5 text-sm font-semibold rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-40"
          >
            Ver
          </button>
        </div>
      )}

      {isPending && (
        <span className="flex items-center gap-2 text-sm text-primary-600">
          <span className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          Actualizando…
        </span>
      )}
    </div>
  )
}
