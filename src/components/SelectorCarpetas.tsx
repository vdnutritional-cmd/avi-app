'use client'

// Filtro por carpetas de los reportes estadísticos (7 nov 2026):
//   - CentrosAtención de las empresas (Reporte General y por <Pro>; parámetro `centros`)
//   - SubCarpetas del terapeuta (Mi estadística y Mis Asesorías; parámetro `subcarpetas`)
// Varias a la vez; ninguna marcada = todas. "Sin …" = las personas que no están en ninguna.
// Cambia solo su parámetro de la URL (y regresa la persona a "todas") y conserva los demás filtros.
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

export interface OpcionCarpeta { id: string; nombre: string; /** desactivado: se ve en gris */ inactivo?: boolean }

export default function SelectorCarpetas({ titulo, parametro, opciones, seleccion, etiquetaSin, mostrarSin = true }: {
  titulo: string
  parametro: 'centros' | 'subcarpetas'
  opciones: OpcionCarpeta[]
  seleccion: string[]
  /** "Sin CentroAtención" / "Sin SubCarpeta" (valor 'sin') */
  etiquetaSin: string
  mostrarSin?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Marcado al instante (no espera la respuesta del servidor)
  const [local, setLocal] = useState<string[]>(seleccion)
  const clave = seleccion.join(',')
  useEffect(() => { setLocal(clave ? clave.split(',') : []) }, [clave])

  // Mientras carga: el contenido del reporte se atenúa (igual que SelectorPeriodo)
  useEffect(() => {
    document.documentElement.toggleAttribute('data-reporte-cargando', isPending)
    return () => document.documentElement.removeAttribute('data-reporte-cargando')
  }, [isPending])

  function ir(nueva: string[]) {
    setLocal(nueva)
    const sp = new URLSearchParams(searchParams.toString())
    if (nueva.length) sp.set(parametro, nueva.join(',')); else sp.delete(parametro)
    if (sp.has('pid')) sp.set('pid', 'all')
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }

  const toggle = (id: string) => ir(local.includes(id) ? local.filter(x => x !== id) : [...local, id])
  const todas = [...opciones, ...(mostrarSin ? [{ id: 'sin', nombre: etiquetaSin }] : [])]
  const chip = (activo: boolean, inactivo?: boolean) =>
    `px-3 py-1.5 text-sm rounded-xl border transition-colors ${
      activo ? 'bg-primary-600 border-primary-600 text-white font-medium'
        : inactivo ? 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`

  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block">{titulo}</label>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => local.length && ir([])} className={chip(local.length === 0)}>Todos</button>
        {todas.map(o => (
          <button key={o.id} onClick={() => toggle(o.id)} className={chip(local.includes(o.id), 'inactivo' in o && o.inactivo)}>
            📁 {o.nombre}
          </button>
        ))}
        {isPending && (
          <span className="flex items-center gap-2 text-sm text-primary-600">
            <span className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            Actualizando…
          </span>
        )}
      </div>
    </div>
  )
}
