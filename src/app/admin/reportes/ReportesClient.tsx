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

// ── Sub-components ─────────────────────────────────────────────────────────────

function PrintHeader({ title }: { title: string }) {
  return (
    <div className="hidden print:block mb-6 pb-4 border-b border-gray-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-purple-700 tracking-tight">AVI</p>
          <p className="text-xs text-gray-400">Acompañamiento Virtual Integral</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-700">{title}</p>
          <p className="text-xs text-gray-400">Generado: {fmtDate(new Date())}</p>
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

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-4 no-print">
      <div>
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100 ${right ? 'text-right' : 'text-left'}`}
    >
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

// ── EmpresaBlock (used in Report 2) ───────────────────────────────────────────

function EmpresaBlock({
  nombre,
  terapeutasList,
  totalPacientes,
}: {
  nombre: string
  terapeutasList: TerapeutaData[]
  totalPacientes: number
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <p className="font-semibold text-gray-800 text-sm">{nombre}</p>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            <span className="font-semibold text-gray-700">{terapeutasList.length}</span>{' '}
            terapeuta{terapeutasList.length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-200">·</span>
          <span>
            <span className="font-semibold text-gray-700">{totalPacientes}</span>{' '}
            paciente{totalPacientes !== 1 ? 's' : ''} asociado{totalPacientes !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
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
  )
}

// ── TerapeutaBlock (used in Report 3) ─────────────────────────────────────────

function TerapeutaBlock({
  terapeuta,
  vinculos,
}: {
  terapeuta: TerapeutaData
  vinculos: VinculoData[]
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-800">{terapeuta.full_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {terapeuta.email}
            {terapeuta.whatsapp_phone ? ` · ${terapeuta.whatsapp_phone}` : ''}
          </p>
          {terapeuta.empresas.length > 0 && (
            <p className="text-xs text-purple-600 mt-1">
              {terapeuta.empresas.map(e => e.nombre).join(' · ')}
            </p>
          )}
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-2xl font-bold text-gray-800">{terapeuta.pacientes_activos}</p>
          <p className="text-xs text-gray-400">pacientes activos</p>
        </div>
      </div>
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
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ReportesClient({ terapeutas, vinculos, empresas }: Props) {
  const [activeTab, setActiveTab]           = useState(1)
  const [empresaFilter, setEmpresaFilter]   = useState('__todos__')
  const [terapeutaFilter, setTerapeutaFilter] = useState('__todos__')
  const [search, setSearch]                 = useState('')

  const generatedDate = useMemo(() => fmtDate(new Date()), [])

  // Vinculos grouped by therapist (for report 3)
  const vinculosByTherapist = useMemo(() => {
    const map = new Map<string, VinculoData[]>()
    for (const v of vinculos) {
      if (!map.has(v.therapist_id)) map.set(v.therapist_id, [])
      map.get(v.therapist_id)!.push(v)
    }
    return map
  }, [vinculos])

  // Therapist map (for report 4 lookup)
  const terapeutaMap = useMemo(() => {
    const map = new Map<string, TerapeutaData>()
    for (const t of terapeutas) map.set(t.id, t)
    return map
  }, [terapeutas])

  // Report 2: get stats for a given empresa id (or '__sin_convenio__')
  function getEmpresaStats(empresaId: string): { terapeutasList: TerapeutaData[]; totalPacientes: number } {
    if (empresaId === '__sin_convenio__') {
      const terapeutasList = terapeutas.filter(t => t.empresas.length === 0)
      const pacientesSet = new Set(vinculos.filter(v => v.empresa_id === null).map(v => v.patient_id))
      return { terapeutasList, totalPacientes: pacientesSet.size }
    }
    const terapeutasList = terapeutas.filter(t => t.empresas.some(e => e.id === empresaId))
    const pacientesSet = new Set(vinculos.filter(v => v.empresa_id === empresaId).map(v => v.patient_id))
    return { terapeutasList, totalPacientes: pacientesSet.size }
  }

  // Report 4: search results
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
      const patientVinculos = vinculos.filter(v => v.patient_id === patientId)
      const first = patientVinculos[0]
      return {
        patient_id: patientId,
        patient_name: first.patient_name,
        patient_email: first.patient_email,
        relaciones: patientVinculos.map(v => ({
          therapist_name: terapeutaMap.get(v.therapist_id)?.full_name ?? '—',
          therapist_email: terapeutaMap.get(v.therapist_id)?.email ?? '—',
          empresa_nombre: v.empresa_nombre,
        })),
      }
    })
  }, [search, vinculos, terapeutaMap])

  const tabs = [
    { id: 1, label: 'Terapeutas' },
    { id: 2, label: 'Por empresa' },
    { id: 3, label: 'Por terapeuta' },
    { id: 4, label: 'Búsqueda de paciente' },
  ]

  // Report 3 title for print
  const r3PrintTitle = terapeutaFilter === '__todos__'
    ? 'Reporte 3 — Por terapeuta (Todos)'
    : `Reporte 3 — ${terapeutas.find(t => t.id === terapeutaFilter)?.full_name ?? ''}`

  // Report 2 title for print
  const r2PrintTitle =
    empresaFilter === '__todos__'
      ? 'Reporte 2 — Por empresa (Todos)'
      : empresaFilter === '__sin_convenio__'
        ? 'Reporte 2 — Sin convenio'
        : `Reporte 2 — ${empresas.find(e => e.id === empresaFilter)?.nombre ?? ''}`

  return (
    <>
      {/* ── Print CSS ─────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .report-section { display: none !important; }
          body[data-printing="1"] .report-section[data-id="1"] { display: block !important; }
          body[data-printing="2"] .report-section[data-id="2"] { display: block !important; }
          body[data-printing="3"] .report-section[data-id="3"] { display: block !important; }
          body[data-printing="4"] .report-section[data-id="4"] { display: block !important; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          th, td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; }
          th { background: #f9fafb; font-weight: 600; color: #6b7280; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
        }
      `}</style>

      {/* ── Screen header ─────────────────────────────────────────────────── */}
      <div className="no-print">
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-400 mt-1">Información consolidada · {generatedDate}</p>
      </div>

      {/* ── Tab navigation ────────────────────────────────────────────────── */}
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
        <SectionHeader
          title="Terapeutas registrados"
          subtitle={`${terapeutas.length} terapeutas · ${terapeutas.reduce((a, t) => a + t.pacientes_activos, 0)} pacientes activos en total`}
          right={<PrintBtn onClick={() => printReport(1)} />}
        />
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
                  <Td muted>
                    {t.empresas.length > 0
                      ? t.empresas.map(e => e.nombre).join(', ')
                      : '—'}
                  </Td>
                  <Td right>{t.pacientes_activos}</Td>
                  <Td right>{t.patient_slots || '—'}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={4} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Total
                </td>
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
          REPORTE 2 — POR EMPRESA
      ══════════════════════════════════════════════════════════════════════ */}
      <div className={`report-section mt-6 ${activeTab === 2 ? '' : 'hidden'}`} data-id="2">
        <PrintHeader title={r2PrintTitle} />
        <SectionHeader
          title="Por empresa en CONVENIO"
          right={
            <>
              <select
                value={empresaFilter}
                onChange={e => setEmpresaFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-200 bg-white"
              >
                <option value="__todos__">Todos</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
                <option value="__sin_convenio__">Sin convenio</option>
              </select>
              <PrintBtn onClick={() => printReport(2)} />
            </>
          }
        />
        <div className="space-y-4">
          {empresaFilter === '__todos__' ? (
            [...empresas, { id: '__sin_convenio__', nombre: 'Sin convenio' }].map(emp => {
              const { terapeutasList, totalPacientes } = getEmpresaStats(emp.id)
              return (
                <EmpresaBlock
                  key={emp.id}
                  nombre={emp.nombre}
                  terapeutasList={terapeutasList}
                  totalPacientes={totalPacientes}
                />
              )
            })
          ) : (
            (() => {
              const nombre =
                empresaFilter === '__sin_convenio__'
                  ? 'Sin convenio'
                  : empresas.find(e => e.id === empresaFilter)?.nombre ?? ''
              const { terapeutasList, totalPacientes } = getEmpresaStats(empresaFilter)
              return (
                <EmpresaBlock nombre={nombre} terapeutasList={terapeutasList} totalPacientes={totalPacientes} />
              )
            })()
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          REPORTE 3 — POR TERAPEUTA
      ══════════════════════════════════════════════════════════════════════ */}
      <div className={`report-section mt-6 ${activeTab === 3 ? '' : 'hidden'}`} data-id="3">
        <PrintHeader title={r3PrintTitle} />
        <SectionHeader
          title="Por terapeuta"
          right={
            <>
              <select
                value={terapeutaFilter}
                onChange={e => setTerapeutaFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-200 bg-white"
              >
                <option value="__todos__">Todos</option>
                {terapeutas.map(t => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
              <PrintBtn onClick={() => printReport(3)} />
            </>
          }
        />
        <div className="space-y-4">
          {(terapeutaFilter === '__todos__'
            ? terapeutas
            : terapeutas.filter(t => t.id === terapeutaFilter)
          ).map(t => (
            <TerapeutaBlock
              key={t.id}
              terapeuta={t}
              vinculos={vinculosByTherapist.get(t.id) ?? []}
            />
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          REPORTE 4 — BÚSQUEDA DE PACIENTE
      ══════════════════════════════════════════════════════════════════════ */}
      <div className={`report-section mt-6 ${activeTab === 4 ? '' : 'hidden'}`} data-id="4">
        <PrintHeader title="Reporte 4 — Búsqueda de paciente" />
        <SectionHeader
          title="Búsqueda de paciente"
          right={searchResults.length > 0 ? <PrintBtn onClick={() => printReport(4)} /> : undefined}
        />

        <div className="no-print mb-5">
          <div className="relative max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nombre o correo (parcial o completo)..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 text-gray-700"
            />
          </div>
        </div>

        {search.trim().length > 0 && search.trim().length < 2 && (
          <p className="text-sm text-gray-400">Escribe al menos 2 caracteres...</p>
        )}

        {search.trim().length >= 2 && searchResults.length === 0 && (
          <p className="text-sm text-gray-400">Sin resultados para &ldquo;{search.trim()}&rdquo;.</p>
        )}

        {searchResults.length > 0 && (
          <div className="space-y-4">
            {searchResults.map(patient => (
              <div key={patient.patient_id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="font-semibold text-gray-800 text-sm">{patient.patient_name || '—'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{patient.patient_email}</p>
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
                    {patient.relaciones.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
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

        {search.trim().length === 0 && (
          <div className="text-center py-16 text-gray-300">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
            </svg>
            <p className="text-sm">Escribe para buscar un paciente</p>
          </div>
        )}
      </div>
    </>
  )
}
