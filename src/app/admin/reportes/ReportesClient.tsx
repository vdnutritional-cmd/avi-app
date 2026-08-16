'use client'

import { useState, useMemo } from 'react'
import type { TerapeutaData, VinculoData, EmpresaData } from './page'

type Props = {
  terapeutas: TerapeutaData[]
  vinculos: VinculoData[]
  empresas: EmpresaData[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(date: Date) {
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

function printReport(id: number) {
  document.body.setAttribute('data-printing', String(id))
  window.print()
  setTimeout(() => document.body.removeAttribute('data-printing'), 800)
}

// ── Shared UI atoms ────────────────────────────────────────────────────────────

function PrintHeader({ title }: { title: string }) {
  return (
    <div className="hidden print:block mb-4 pb-3 border-b border-gray-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="print-avi-title font-bold text-purple-700 tracking-tight">AVI</p>
          <p className="print-avi-sub text-gray-400">Acompañamiento Virtual Integral</p>
        </div>
        <div className="text-right">
          <p className="print-report-title font-semibold text-gray-700">{title}</p>
          <p className="text-gray-400">Generado: {fmtDate(new Date())}</p>
        </div>
      </div>
    </div>
  )
}

function PrintBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-1.5 rounded-xl transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
      </svg>
      Imprimir
    </button>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100 ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

function Td({ children, right, muted }: { children: React.ReactNode; right?: boolean; muted?: boolean }) {
  return (
    <td className={`px-4 py-2.5 text-sm ${right ? 'text-right' : ''} ${muted ? 'text-gray-400' : 'text-gray-700'}`}>
      {children}
    </td>
  )
}

// ── EmpresaBlock (acordeón) ────────────────────────────────────────────────────

function EmpresaBlock({
  nombre,
  terapeutasList,
  totalPacientes,
  isOpen,
  onToggle,
}: {
  nombre: string
  terapeutasList: TerapeutaData[]
  totalPacientes: number
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header — siempre visible, clickeable */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ChevronIcon open={isOpen} />
          <p className="font-semibold text-gray-800 text-sm">{nombre}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0 ml-4">
          <span>
            <span className="font-semibold text-gray-600">{terapeutasList.length}</span>{' '}
            terapeuta{terapeutasList.length !== 1 ? 's' : ''}
          </span>
          <span>·</span>
          <span>
            <span className="font-semibold text-gray-600">{totalPacientes}</span>{' '}
            paciente{totalPacientes !== 1 ? 's' : ''}
          </span>
        </div>
      </button>

      {/* Contenido colapsable */}
      {isOpen && (
        <div className="border-t border-gray-100">
          {terapeutasList.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Terapeuta</Th>
                  <Th>Correo</Th>
                  <Th>WhatsApp</Th>
                  <Th right>Pac. activos</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {terapeutasList.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <Td>{t.full_name}</Td>
                    <Td muted>{t.email}</Td>
                    <Td muted>{t.whatsapp_phone ?? '—'}</Td>
                    <Td right>{t.pacientes_activos}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-4 text-sm text-gray-400">Sin terapeutas asociados.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── TerapeutaBlock (acordeón) ──────────────────────────────────────────────────

function TerapeutaBlock({
  terapeuta,
  vinculos,
  isOpen,
  onToggle,
}: {
  terapeuta: TerapeutaData
  vinculos: VinculoData[]
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header — solo nombre, igual que EmpresaBlock */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ChevronIcon open={isOpen} />
          <p className="font-semibold text-gray-800 text-sm">{terapeuta.full_name}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0 ml-4">
          <span>
            <span className="font-semibold text-gray-600">{terapeuta.pacientes_activos}</span>{' '}
            paciente{terapeuta.pacientes_activos !== 1 ? 's' : ''}
          </span>
        </div>
      </button>

      {/* Contenido colapsable — toda la info del terapeuta + pacientes */}
      {isOpen && (
        <div className="border-t border-gray-100">
          {/* Ficha del terapeuta */}
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500">
                {terapeuta.email}
                {terapeuta.whatsapp_phone ? ` · ${terapeuta.whatsapp_phone}` : ''}
              </p>
              {terapeuta.empresas.length > 0 && (
                <p className="text-xs text-purple-500 mt-0.5">
                  {terapeuta.empresas.map(e => e.nombre).join(' · ')}
                </p>
              )}
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="text-lg font-bold text-gray-700">{terapeuta.pacientes_activos}</p>
              <p className="text-xs text-gray-400">pacientes activos</p>
            </div>
          </div>
          {/* Lista de pacientes */}
          {vinculos.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Paciente</Th>
                  <Th>Correo</Th>
                  <Th>Empresa CONVENIO</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vinculos.map((v, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <Td>{v.patient_name || '—'}</Td>
                    <Td muted>{v.patient_email || '—'}</Td>
                    <Td muted>{v.empresa_nombre ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-4 text-sm text-gray-400">Sin pacientes activos.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ReportesClient({ terapeutas, vinculos, empresas }: Props) {
  const [activeTab, setActiveTab] = useState(1)

  // Reporte 2: qué empresas están expandidas
  const [expandedEmpresas, setExpandedEmpresas] = useState<Set<string>>(new Set())

  // Reporte 3: qué terapeutas están expandidos
  const [expandedTerapeutas, setExpandedTerapeutas] = useState<Set<string>>(new Set())

  // Reporte 4: búsqueda y paciente seleccionado
  const [search, setSearch] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)

  const generatedDate = useMemo(() => fmtDate(new Date()), [])

  // Vinculos por terapeuta
  const vinculosByTherapist = useMemo(() => {
    const map = new Map<string, VinculoData[]>()
    for (const v of vinculos) {
      if (!map.has(v.therapist_id)) map.set(v.therapist_id, [])
      map.get(v.therapist_id)!.push(v)
    }
    return map
  }, [vinculos])

  // Mapa de terapeutas
  const terapeutaMap = useMemo(() => {
    const map = new Map<string, TerapeutaData>()
    for (const t of terapeutas) map.set(t.id, t)
    return map
  }, [terapeutas])

  // Toggle empresa
  function toggleEmpresa(id: string) {
    setExpandedEmpresas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Toggle terapeuta
  function toggleTerapeuta(id: string) {
    setExpandedTerapeutas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Expandir / colapsar todos (reporte 2)
  const allEmpresaIds = [...empresas.map(e => e.id), '__sin_convenio__']
  const allEmpresasOpen = allEmpresaIds.every(id => expandedEmpresas.has(id))
  function toggleAllEmpresas() {
    setExpandedEmpresas(allEmpresasOpen ? new Set() : new Set(allEmpresaIds))
  }

  // Expandir / colapsar todos (reporte 3)
  const allTerapeutaIds = terapeutas.map(t => t.id)
  const allTerapeutasOpen = allTerapeutaIds.length > 0 && allTerapeutaIds.every(id => expandedTerapeutas.has(id))
  function toggleAllTerapeutas() {
    setExpandedTerapeutas(allTerapeutasOpen ? new Set() : new Set(allTerapeutaIds))
  }

  // Stats por empresa
  function getEmpresaStats(empresaId: string) {
    if (empresaId === '__sin_convenio__') {
      const terapeutasList = terapeutas.filter(t => t.empresas.length === 0)
      const total = new Set(vinculos.filter(v => v.empresa_id === null).map(v => v.patient_id)).size
      return { terapeutasList, totalPacientes: total }
    }
    const terapeutasList = terapeutas.filter(t => t.empresas.some(e => e.id === empresaId))
    const total = new Set(vinculos.filter(v => v.empresa_id === empresaId).map(v => v.patient_id)).size
    return { terapeutasList, totalPacientes: total }
  }

  // Reporte 4: resultados de búsqueda
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    const matchingPatients = new Set<string>()
    for (const v of vinculos) {
      if (v.patient_name.toLowerCase().includes(q) || v.patient_email.toLowerCase().includes(q)) {
        matchingPatients.add(v.patient_id)
      }
    }
    return Array.from(matchingPatients).map(patientId => {
      const pv = vinculos.filter(v => v.patient_id === patientId)
      const first = pv[0]
      return {
        patient_id: patientId,
        patient_name: first.patient_name,
        patient_email: first.patient_email,
        relaciones: pv.map(v => ({
          therapist_name: terapeutaMap.get(v.therapist_id)?.full_name ?? '—',
          therapist_email: terapeutaMap.get(v.therapist_id)?.email ?? '—',
          empresa_nombre: v.empresa_nombre,
        })),
      }
    })
  }, [search, vinculos, terapeutaMap])

  // Al cambiar la búsqueda, limpiar selección
  function handleSearch(value: string) {
    setSearch(value)
    setSelectedPatientId(null)
  }

  const selectedPatient = selectedPatientId
    ? searchResults.find(p => p.patient_id === selectedPatientId) ?? null
    : null

  const tabs = [
    { id: 1, label: 'Terapeutas' },
    { id: 2, label: 'Por empresa' },
    { id: 3, label: 'Por terapeuta' },
    { id: 4, label: 'Búsqueda de paciente' },
  ]

  return (
    <>
      {/* ── Print CSS ───────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .report-section { display: none !important; }
          body[data-printing="1"] .report-section[data-id="1"] { display: block !important; }
          body[data-printing="2"] .report-section[data-id="2"] { display: block !important; }
          body[data-printing="3"] .report-section[data-id="3"] { display: block !important; }
          body[data-printing="4"] .report-section[data-id="4"] { display: block !important; }

          /* Tamaño base para todo el reporte impreso */
          .report-section * { font-size: 9px !important; line-height: 1.4 !important; }

          /* Encabezado AVI (PrintHeader) — un poco más grande */
          .report-section .print-avi-title { font-size: 14px !important; font-weight: 700; }
          .report-section .print-avi-sub   { font-size: 8px !important; }
          .report-section .print-report-title { font-size: 10px !important; font-weight: 600; }

          /* Tablas */
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #e5e7eb; padding: 4px 8px !important; text-align: left; }
          th { background: #f9fafb; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }

          /* Acordeones: quitar bordes redondeados y sombras */
          .report-section [class*="rounded"] { border-radius: 0 !important; }
          .report-section button { display: block !important; width: 100%; text-align: left; }
        }
      `}</style>

      {/* ── Screen header ───────────────────────────────────────────────────── */}
      <div className="no-print">
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-400 mt-1">Información consolidada · {generatedDate}</p>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="no-print mt-6 border-b border-gray-200 flex gap-0.5 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          REPORTE 1 — TERAPEUTAS
      ══════════════════════════════════════════════════════════════════════ */}
      <div className={`report-section mt-6 ${activeTab === 1 ? '' : 'hidden'}`} data-id="1">
        <PrintHeader title="Reporte 1 — Terapeutas" />
        <div className="no-print flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Terapeutas registrados</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {terapeutas.length} terapeutas · {terapeutas.reduce((a, t) => a + t.pacientes_activos, 0)} pacientes activos
            </p>
          </div>
          <PrintBtn onClick={() => printReport(1)} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr>
                <Th>Terapeuta</Th>
                <Th>Correo</Th>
                <Th>WhatsApp</Th>
                <Th>Empresas CONVENIO</Th>
                <Th right>Pac. activos</Th>
                <Th right>Cupo</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {terapeutas.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <Td>{t.full_name}</Td>
                  <Td muted>{t.email}</Td>
                  <Td muted>{t.whatsapp_phone ?? '—'}</Td>
                  <Td muted>{t.empresas.length > 0 ? t.empresas.map(e => e.nombre).join(', ') : '—'}</Td>
                  <Td right>{t.pacientes_activos}</Td>
                  <Td right>{t.patient_slots || '—'}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={4} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-800 text-right">
                  {terapeutas.reduce((a, t) => a + t.pacientes_activos, 0)}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-500 text-right">
                  {terapeutas.reduce((a, t) => a + (t.patient_slots || 0), 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          REPORTE 2 — POR EMPRESA (acordeón)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className={`report-section mt-6 ${activeTab === 2 ? '' : 'hidden'}`} data-id="2">
        <PrintHeader title="Reporte 2 — Por empresa" />
        <div className="no-print flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Por empresa en CONVENIO</h2>
            <p className="text-xs text-gray-400 mt-0.5">Toca una empresa para ver su detalle</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAllEmpresas}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              {allEmpresasOpen ? 'Colapsar todos' : 'Expandir todos'}
            </button>
            <PrintBtn onClick={() => printReport(2)} />
          </div>
        </div>
        <div className="space-y-2">
          {[...empresas, { id: '__sin_convenio__', nombre: 'Sin convenio' }].map(emp => {
            const { terapeutasList, totalPacientes } = getEmpresaStats(emp.id)
            return (
              <EmpresaBlock
                key={emp.id}
                nombre={emp.nombre}
                terapeutasList={terapeutasList}
                totalPacientes={totalPacientes}
                isOpen={expandedEmpresas.has(emp.id)}
                onToggle={() => toggleEmpresa(emp.id)}
              />
            )
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          REPORTE 3 — POR TERAPEUTA (acordeón)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className={`report-section mt-6 ${activeTab === 3 ? '' : 'hidden'}`} data-id="3">
        <PrintHeader title="Reporte 3 — Por terapeuta" />
        <div className="no-print flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Por terapeuta</h2>
            <p className="text-xs text-gray-400 mt-0.5">Toca un terapeuta para ver sus pacientes</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAllTerapeutas}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              {allTerapeutasOpen ? 'Colapsar todos' : 'Expandir todos'}
            </button>
            <PrintBtn onClick={() => printReport(3)} />
          </div>
        </div>
        <div className="space-y-2">
          {terapeutas.map(t => (
            <TerapeutaBlock
              key={t.id}
              terapeuta={t}
              vinculos={vinculosByTherapist.get(t.id) ?? []}
              isOpen={expandedTerapeutas.has(t.id)}
              onToggle={() => toggleTerapeuta(t.id)}
            />
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          REPORTE 4 — BÚSQUEDA DE PACIENTE
      ══════════════════════════════════════════════════════════════════════ */}
      <div className={`report-section mt-6 ${activeTab === 4 ? '' : 'hidden'}`} data-id="4">
        <PrintHeader title="Reporte 4 — Búsqueda de paciente" />
        <div className="no-print flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Búsqueda de paciente</h2>
            <p className="text-xs text-gray-400 mt-0.5">Escribe nombre o correo para buscar</p>
          </div>
          {selectedPatient && <PrintBtn onClick={() => printReport(4)} />}
        </div>

        {/* Search input */}
        <div className="no-print mb-5">
          <div className="relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Nombre o correo (parcial o completo)..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 text-gray-700"
            />
            {search && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Estado vacío */}
        {search.trim().length === 0 && (
          <div className="text-center py-16 text-gray-200">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
            </svg>
            <p className="text-sm text-gray-300">Escribe para buscar un paciente</p>
          </div>
        )}

        {search.trim().length > 0 && search.trim().length < 2 && (
          <p className="text-sm text-gray-400">Escribe al menos 2 caracteres...</p>
        )}

        {search.trim().length >= 2 && searchResults.length === 0 && (
          <p className="text-sm text-gray-400">Sin resultados para &ldquo;{search.trim()}&rdquo;.</p>
        )}

        {/* Lista de resultados + detalle */}
        {searchResults.length > 0 && (
          <div className="flex gap-4 items-start">

            {/* Lista de pacientes encontrados */}
            <div className="w-64 shrink-0 space-y-1 no-print">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide px-1 mb-2">
                {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
              </p>
              {searchResults.map(p => (
                <button
                  key={p.patient_id}
                  onClick={() => setSelectedPatientId(
                    selectedPatientId === p.patient_id ? null : p.patient_id
                  )}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    selectedPatientId === p.patient_id
                      ? 'bg-purple-50 border-purple-200 shadow-sm'
                      : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <p className={`text-sm font-medium truncate ${selectedPatientId === p.patient_id ? 'text-purple-800' : 'text-gray-800'}`}>
                    {p.patient_name || '—'}
                  </p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{p.patient_email}</p>
                </button>
              ))}
            </div>

            {/* Detalle del paciente seleccionado */}
            <div className="flex-1">
              {selectedPatient ? (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                    <p className="font-semibold text-gray-800">{selectedPatient.patient_name || '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedPatient.patient_email}</p>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <Th>Terapeuta</Th>
                        <Th>Correo terapeuta</Th>
                        <Th>Empresa CONVENIO</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {selectedPatient.relaciones.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <Td>{r.therapist_name}</Td>
                          <Td muted>{r.therapist_email}</Td>
                          <Td muted>{r.empresa_nombre ?? '—'}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Print view: mostrar todos los resultados */
                <div className="hidden print:block space-y-4">
                  {searchResults.map(patient => (
                    <div key={patient.patient_id} className="mb-4">
                      <p className="font-semibold text-gray-800 mb-1">{patient.patient_name || '—'}</p>
                      <p className="text-xs text-gray-500 mb-2">{patient.patient_email}</p>
                      <table className="w-full">
                        <thead>
                          <tr>
                            <Th>Terapeuta</Th>
                            <Th>Correo terapeuta</Th>
                            <Th>Empresa CONVENIO</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {patient.relaciones.map((r, i) => (
                            <tr key={i}>
                              <Td>{r.therapist_name}</Td>
                              <Td muted>{r.therapist_email}</Td>
                              <Td muted>{r.empresa_nombre ?? '—'}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}

              {!selectedPatient && (
                <div className="no-print flex items-center justify-center h-32 text-gray-300">
                  <p className="text-sm">← Selecciona un paciente</p>
                </div>
              )}

              {/* Print: si hay seleccionado, solo imprime ese */}
              {selectedPatient && (
                <div className="hidden print:block">
                  {/* ya se renderiza en la tabla de arriba */}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
