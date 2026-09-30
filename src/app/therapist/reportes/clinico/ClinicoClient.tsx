'use client'

// ─────────────────────────────────────────────────────────────
// ClinicoClient — Reportes AVI-CLÍNICO (E7)
// ─────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Empresa  { id: string; nombre: string; logo_url: string | null }
interface Paciente { id: string; nombre: string; activo: boolean }

interface Props {
  terapeutaNombre: string
  tier:            string | null
  empresas:        Empresa[]
  pacientes:       Paciente[]
}

const REPORTES_CLINICO = [
  'Historia Clínica Original',
  'Historia Clínica Actualizada',
  'Reporte Valorativo',
  'Integración y Plan de Intervención',
  'Bitácora de Asesoría',
  'Reporte de Proceso',
  'Entrevista Inicial',
]

export default function ClinicoClient({ terapeutaNombre, tier, empresas, pacientes }: Props) {
  const router = useRouter()
  const esClinico = tier === 'clinico'

  const empresasConLogo = empresas.filter(e => e.logo_url)
  const [logoUrl, setLogoUrl] = useState<string | null>(empresasConLogo[0]?.logo_url ?? null)
  const [pid, setPid] = useState('')

  // ── Gate: no tiene AVI Clínico ────────────────────────────────
  if (!esClinico) {
    return (
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes AVI-CLÍNICO</h1>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-10 text-center space-y-4">
          <p className="text-4xl">🔒</p>
          <p className="text-base font-semibold text-gray-700">Plan AVI Clínico requerido</p>
          <p className="text-sm text-gray-400">
            Los reportes clínicos avanzados están disponibles únicamente en el plan AVI Clínico.
          </p>
          <Link href="/pricing"
            className="inline-block mt-2 text-sm text-purple-600 hover:text-purple-800 font-medium underline">
            Ver planes →
          </Link>
        </div>
      </div>
    )
  }

  // ── Vista clínico ─────────────────────────────────────────────
  return (
    <div className="max-w-3xl space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes AVI-CLÍNICO</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Reportes clínicos avanzados. Se generan desde la pestaña <strong>Impresiones</strong> de cada paciente.
        </p>
      </div>

      {/* Selector de logo */}
      {empresasConLogo.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600 shrink-0">Encabezado del reporte:</span>
          <select
            value={logoUrl ?? '__nombre__'}
            onChange={e => setLogoUrl(e.target.value === '__nombre__' ? null : e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            {empresasConLogo.map(e => (
              <option key={e.id} value={e.logo_url!}>{e.nombre} (logo)</option>
            ))}
            <option value="__nombre__">{terapeutaNombre} (nombre)</option>
          </select>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="preview" className="h-8 max-w-[80px] object-contain shrink-0" />
          )}
        </div>
      )}

      {/* Selector de paciente */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
        <label className="block text-sm font-semibold text-gray-700">Selecciona un paciente</label>
        <select
          value={pid}
          onChange={e => setPid(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          <option value="">— Elige un paciente —</option>
          <optgroup label="Activos">
            {pacientes.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </optgroup>
          <optgroup label="Inactivos">
            {pacientes.filter(p => !p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </optgroup>
        </select>
      </div>

      {/* Lista de reportes */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Reportes disponibles</h2>

        {!pid ? (
          <p className="text-sm text-gray-400 italic">Selecciona un paciente para acceder a sus reportes.</p>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Haz clic en el reporte que deseas generar. Se abrirá la pestaña{' '}
              <strong>Impresiones</strong> del paciente.
            </p>
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-50">
              {REPORTES_CLINICO.map((r, i) => (
                <button
                  key={i}
                  onClick={() => router.push(`/therapist/patients/${pid}?tab=impresiones`)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-purple-50 transition-colors text-left"
                >
                  <span className="text-sm text-gray-700">{r}</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

    </div>
  )
}
