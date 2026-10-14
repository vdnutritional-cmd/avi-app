import Link from 'next/link'
import { Suspense } from 'react'
import SelectorEmpresasAVI from './SelectorEmpresasAVI'
import { palabraDeEmpresas, type EmpresaAVI } from './empresas-avi'
import { terminos } from '@/lib/terminologia'

// Encabezado común: título, pestañas (conservan empresas y mes) y selector de empresas.
const SECCIONES = [
  { href: '/admin/institucional',                   label: 'Panel de Control' },
  { href: '/admin/institucional/reporte-general',   label: 'Reporte General' },
  { href: '/admin/institucional/reporte-terapeuta', label: 'Reporte por Terapeuta' },
  { href: '/admin/institucional/configuracion',     label: 'Configuración Admin' },
  { href: '/admin/institucional/alta-baja',         label: 'Alta/Baja de <Pros>' },
] as const

export default function EncabezadoAVI({ actual, empresas, selectedIds, mes }: {
  actual: (typeof SECCIONES)[number]['href']
  empresas: EmpresaAVI[]
  selectedIds: string[]
  mes?: string
}) {
  // En los reportes "Sin empresa" no aplica: se desmarca y queda en gris; al
  // regresar al Panel llega desmarcada (los reportes ya la quitan de selectedIds)
  const enReporte = actual !== '/admin/institucional'
  const sp = new URLSearchParams({ empresaIds: selectedIds.join(',') })
  if (mes) sp.set('mes', mes)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-primary-700">AVI Administración</h1>
        <p className="text-sm text-gray-500 mt-1">
          Lo mismo que ve una Persona Institucional Superuser, para todas las Empresas en Convenio.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {SECCIONES.map(s => (
          <Link
            key={s.href}
            href={`${s.href}?${sp.toString()}`}
            className={`text-sm px-4 py-2 rounded-xl border transition-colors ${
              s.href === actual
                ? 'bg-primary-600 border-primary-600 text-white font-semibold'
                : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-700'
            }`}
          >
            {s.label.replace('<Pros>', terminos(palabraDeEmpresas(empresas)).Pros)}
          </Link>
        ))}
      </nav>

      <Suspense>
        <SelectorEmpresasAVI
          empresas={empresas.map(e => ({ id: e.id, nombre: e.nombre }))}
          selectedIds={selectedIds}
          sinEmpresaDisponible={!enReporte}
        />
      </Suspense>
    </div>
  )
}
