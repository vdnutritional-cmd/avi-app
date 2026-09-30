'use client'

// ─────────────────────────────────────────────────────────────
// ReportesClient — Reportes Terapéuticos (E5, E6, E7)
// Sprint 10 (Cambio XII)
// ─────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  imprimirNotaInicialDesdeReportes,
  imprimirSesionesDesdeReportes,
  imprimirAnalisisDesdeReportes,
} from '../patients/[patientId]/print-utils'

// ── Tipos ─────────────────────────────────────────────────────
interface Paciente {
  id:     string
  nombre: string
  activo: boolean
}

interface Props {
  terapeutaNombre: string
  tier:            string | null
  logoUrl:         string | null
  pacientes:       Paciente[]
}

// ── Reportes AVI-CLÍNICO (E7) ─────────────────────────────────
const REPORTES_CLINICO = [
  { label: 'Historia Clínica Original',         tab: 'impresiones' },
  { label: 'Historia Clínica Actualizada',       tab: 'impresiones' },
  { label: 'Reporte Valorativo',                 tab: 'impresiones' },
  { label: 'Integración y Plan de Intervención', tab: 'impresiones' },
  { label: 'Bitácora de Asesoría',               tab: 'impresiones' },
  { label: 'Reporte de Proceso',                 tab: 'impresiones' },
  { label: 'Entrevista Inicial',                 tab: 'impresiones' },
]

// ── Componente principal ───────────────────────────────────────
export default function ReportesClient({ terapeutaNombre, tier, logoUrl, pacientes }: Props) {
  const router  = useRouter()
  const esClinico = tier === 'clinico'

  // Selector de paciente compartido
  const [pidSeleccionado, setPidSeleccionado] = useState<string>('')

  // Estado Sesiones (E5)
  const [sessionOpt, setSessionOpt] = useState<string>('all')
  const [sesiones,   setSesiones]   = useState<{ id: string; label: string }[]>([])
  const [loadingSes, setLoadingSes] = useState(false)

  // Estado Análisis (E5)
  const [analisisOpt,    setAnalisisOpt]    = useState<string>('')
  const [analisisFechas, setAnalisisFechas] = useState<{ id: string; label: string }[]>([])
  const [loadingAnal,    setLoadingAnal]    = useState(false)

  // Estado Reporte de la Atención (E6)
  const [rStatus,       setRStatus]       = useState<'activos' | 'inactivos'>('activos')
  const [rDateFrom,     setRDateFrom]     = useState('')
  const [rDateTo,       setRDateTo]       = useState('')
  const [rPid,          setRPid]          = useState<string>('all')
  const [loadingRA,     setLoadingRA]     = useState(false)
  const [errorRA,       setErrorRA]       = useState('')

  // ── Cargar sesiones para dropdown (al seleccionar paciente / cambiar) ────────
  async function cargarSesiones(pid: string) {
    if (!pid) { setSesiones([]); return }
    setLoadingSes(true)
    try {
      const res  = await fetch(`/api/therapist/sesiones-lista?pid=${pid}`)
      const data = await res.json()
      setSesiones((data.sesiones ?? []).map((s: { number: number; date: string; id: string }) => ({
        id: String(s.id),
        label: `Sesión ${s.number} — ${new Date(s.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      })))
    } catch { setSesiones([]) }
    setLoadingSes(false)
  }

  // ── Cargar fechas de análisis ────────────────────────────────────────────────
  async function cargarAnalisis(pid: string) {
    if (!pid) { setAnalisisFechas([]); return }
    setLoadingAnal(true)
    try {
      const res  = await fetch(`/api/therapist/analisis-lista?pid=${pid}`)
      const data = await res.json()
      setAnalisisFechas((data.analisis ?? []).map((a: { id: string; fecha: string }) => ({
        id: a.id,
        label: new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
      })))
    } catch { setAnalisisFechas([]) }
    setLoadingAnal(false)
  }

  // ── Al seleccionar paciente ──────────────────────────────────────────────────
  function handlePacienteChange(pid: string) {
    setPidSeleccionado(pid)
    setSessionOpt('all')
    setAnalisisOpt('')
    cargarSesiones(pid)
    cargarAnalisis(pid)
  }

  // ── Imprimir Nota Inicial (E5a) ──────────────────────────────────────────────
  async function printNotaInicial() {
    if (!pidSeleccionado) return
    await imprimirNotaInicialDesdeReportes(pidSeleccionado)
  }

  // ── Imprimir Sesiones (E5b) ──────────────────────────────────────────────────
  async function printSesiones() {
    if (!pidSeleccionado) return
    const sid = sessionOpt === 'all' ? undefined : sessionOpt
    await imprimirSesionesDesdeReportes(pidSeleccionado, sid)
  }

  // ── Imprimir Análisis (E5c) ──────────────────────────────────────────────────
  async function printAnalisis() {
    if (!pidSeleccionado || !analisisOpt) return
    await imprimirAnalisisDesdeReportes(pidSeleccionado, analisisOpt)
  }

  // ── Generar Reporte de la Atención (E6) ─────────────────────────────────────
  async function generarReporteAtencion() {
    if (!rDateFrom || !rDateTo) {
      setErrorRA('Selecciona el rango de fechas.')
      return
    }
    setLoadingRA(true)
    setErrorRA('')
    try {
      const res  = await fetch('/api/therapist/reporte-atencion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id:     rPid,
          date_from:      rDateFrom,
          date_to:        rDateTo,
          patient_status: rStatus,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      imprimirReporteAtencion({ ...data, terapeutaNombre, logoUrl, dateFrom: rDateFrom, dateTo: rDateTo })
    } catch (e: unknown) {
      setErrorRA(e instanceof Error ? e.message : 'Error al generar el reporte.')
    } finally {
      setLoadingRA(false)
    }
  }

  // ── Navegar a Impresiones del paciente (E7) ──────────────────────────────────
  function irAImpresiones() {
    if (!pidSeleccionado) return
    router.push(`/therapist/patients/${pidSeleccionado}?tab=impresiones`)
  }

  // ── JSX ───────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl space-y-10">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes terapéuticos</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Genera e imprime reportes clínicos para tus pacientes.
        </p>
      </div>

      {/* ─── Selector de paciente compartido ──────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
        <label className="block text-sm font-semibold text-gray-700">Selecciona un paciente</label>
        <select
          value={pidSeleccionado}
          onChange={e => handlePacienteChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          <option value="">— Elige un paciente —</option>
          <optgroup label="Activos">
            {pacientes.filter(p => p.activo).map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </optgroup>
          <optgroup label="Inactivos">
            {pacientes.filter(p => !p.activo).map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* ─── Reportes AVI Esencial (E5) ───────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Reportes AVI Esencial
        </h2>

        {!pidSeleccionado && (
          <p className="text-sm text-gray-400 italic">Selecciona un paciente para ver los reportes disponibles.</p>
        )}

        {pidSeleccionado && (
          <div className="space-y-3">

            {/* E5a — Nota Inicial */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">Nota Inicial</p>
                <p className="text-xs text-gray-400 mt-0.5">Imprime la nota de primera consulta del paciente.</p>
              </div>
              <PrintBtn onClick={printNotaInicial} label="Imprimir" />
            </div>

            {/* E5b — Sesiones */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-800">Sesiones presenciales</p>
              <div className="flex gap-3 items-center">
                <select
                  value={sessionOpt}
                  onChange={e => setSessionOpt(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  disabled={loadingSes}
                >
                  <option value="all">Todas las sesiones</option>
                  {sesiones.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <PrintBtn onClick={printSesiones} label="Imprimir" />
              </div>
            </div>

            {/* E5c — Análisis */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-800">Análisis Consúltame</p>
              <div className="flex gap-3 items-center">
                <select
                  value={analisisOpt}
                  onChange={e => setAnalisisOpt(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  disabled={loadingAnal}
                >
                  <option value="">— Selecciona un análisis —</option>
                  {analisisFechas.map(a => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
                <PrintBtn onClick={printAnalisis} label="Imprimir" disabled={!analisisOpt} />
              </div>
              {analisisFechas.length === 0 && !loadingAnal && (
                <p className="text-xs text-gray-400">Este paciente no tiene análisis generados.</p>
              )}
            </div>

          </div>
        )}
      </section>

      {/* ─── Reporte de la Atención (E6) ──────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Reporte de la Atención
        </h2>

        <div className="bg-white border border-purple-100 rounded-2xl p-6 space-y-5">
          <p className="text-sm text-gray-500">
            Genera un reporte completo con resumen de sesiones y análisis clínico
            (IA). Puedes seleccionar un paciente individual o consolidado.
          </p>

          {/* Parámetros */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Estado de pacientes</label>
              <div className="flex border border-gray-200 rounded-xl overflow-hidden divide-x divide-gray-200 text-sm">
                {(['activos', 'inactivos'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setRStatus(opt)}
                    className={`flex-1 py-2 font-medium transition-colors ${
                      rStatus === opt ? 'bg-purple-700 text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Paciente</label>
              <select
                value={rPid}
                onChange={e => setRPid(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                <option value="all">Todos los pacientes</option>
                {pacientes.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Desde</label>
              <input
                type="date"
                value={rDateFrom}
                onChange={e => setRDateFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Hasta</label>
              <input
                type="date"
                value={rDateTo}
                onChange={e => setRDateTo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
          </div>

          {errorRA && <p className="text-red-500 text-xs">{errorRA}</p>}

          <button
            onClick={generarReporteAtencion}
            disabled={loadingRA || !rDateFrom || !rDateTo}
            className="w-full bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loadingRA ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Generando (IA)…
              </>
            ) : (
              <>🖨️ Generar e imprimir reporte</>
            )}
          </button>
        </div>
      </section>

      {/* ─── Reportes AVI-CLÍNICO (E7) ────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Reportes AVI-CLÍNICO
        </h2>

        {!esClinico ? (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center space-y-2">
            <p className="text-2xl">🔒</p>
            <p className="text-sm font-semibold text-gray-700">Plan AVI Clínico requerido</p>
            <p className="text-xs text-gray-400">
              Actualiza tu plan para acceder a los reportes clínicos avanzados.
            </p>
            <a href="/pricing" className="inline-block mt-2 text-xs text-purple-600 hover:text-purple-800 font-medium underline">
              Ver planes →
            </a>
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">

            {/* Selector de paciente para clínico */}
            <div className="p-5 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-3">
                Los reportes clínicos se generan desde la pestaña <strong>Impresiones</strong> de cada paciente.
                Selecciona un paciente y haz clic en el reporte que deseas.
              </p>
              {!pidSeleccionado ? (
                <p className="text-xs text-gray-400 italic">Selecciona un paciente en el selector de arriba.</p>
              ) : (
                <button
                  onClick={irAImpresiones}
                  className="flex items-center gap-2 text-sm text-purple-700 font-medium hover:text-purple-900 transition-colors"
                >
                  <span>→</span>
                  <span>Ir a Impresiones del paciente seleccionado</span>
                </button>
              )}
            </div>

            {/* Lista de reportes disponibles */}
            <div className="divide-y divide-gray-50">
              {REPORTES_CLINICO.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-5 py-3 ${
                    pidSeleccionado
                      ? 'cursor-pointer hover:bg-purple-50 transition-colors'
                      : 'opacity-50 cursor-default'
                  }`}
                  onClick={() => {
                    if (!pidSeleccionado) return
                    router.push(`/therapist/patients/${pidSeleccionado}?tab=impresiones`)
                  }}
                >
                  <span className="text-sm text-gray-700">{r.label}</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

    </div>
  )
}

// ── Botón de impresión reutilizable ────────────────────────────
function PrintBtn({ onClick, label, disabled }: {
  onClick: () => void; label: string; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      {label}
    </button>
  )
}

// ── Función de impresión del Reporte de la Atención ────────────
function imprimirReporteAtencion(data: {
  s6: string; s7: string; s8: string
  pacientes: { nombre: string; motivo: string; total_sesiones: number; fechas: string[] }[]
  terapeutaNombre: string
  logoUrl:         string | null
  dateFrom:        string
  dateTo:          string
}) {
  const { s6, s7, s8, pacientes, terapeutaNombre, logoUrl, dateFrom, dateTo } = data

  const date    = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  const rightContent = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="height:48px;max-width:140px;object-fit:contain;" />`
    : `<span style="font-size:10pt;font-weight:600;">${terapeutaNombre}</span>`

  const pacientesHtml = pacientes.map(p => `
    <div style="margin-bottom:8px;padding:10px;background:#f9f5ff;border-radius:8px;">
      <strong>${p.nombre}</strong> — ${p.total_sesiones} sesión(es)<br/>
      <span style="font-size:9pt;color:#666;">Motivo: ${p.motivo || 'No especificado'}</span>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Reporte de la Atención</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt; color: #222; padding: 36px 44px; line-height: 1.6; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #ddd; padding-bottom: 10px; margin-bottom: 6px; }
    .sub-header { font-size: 8.5pt; color: #888; margin-bottom: 20px; }
    h1 { font-size: 16pt; font-weight: 700; margin-bottom: 2px; }
    h2 { font-size: 11pt; font-weight: 600; color: #5b21b6; margin: 22px 0 8px; border-bottom: 1px solid #ede9fe; padding-bottom: 4px; }
    p { margin-bottom: 10px; }
    .firma-block { margin-top: 48px; border-top: 1px solid #ddd; padding-top: 16px; }
    .firma-linea { display: inline-block; border-bottom: 1px solid #444; width: 220px; margin-right: 40px; padding-bottom: 4px; font-size: 9.5pt; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <h1>Reporte de la Atención</h1>
      <div style="font-size:9pt;color:#666;">Del ${fmtDate(dateFrom)} al ${fmtDate(dateTo)}</div>
    </div>
    ${rightContent}
  </div>
  <div class="sub-header">${date} · Reporte impreso por: <strong>${terapeutaNombre}</strong></div>

  <h2>1. Datos del / los asesorado(s)</h2>
  ${pacientesHtml}

  <h2>2. Número de sesiones atendidas</h2>
  <p>Total de sesiones en el periodo: <strong>${pacientes.reduce((a, p) => a + p.total_sesiones, 0)}</strong></p>

  <h2>3. Resumen de las sesiones</h2>
  <p>${s6.replace(/\n/g, '<br/>')}</p>

  <h2>4. Análisis del proceso terapéutico</h2>
  <p>${s7.replace(/\n/g, '<br/>')}</p>

  <h2>5. Conclusiones y recomendaciones</h2>
  <p>${s8.replace(/\n/g, '<br/>')}</p>

  <div class="firma-block">
    <div class="firma-linea">${terapeutaNombre}</div>
    <div style="font-size:8.5pt;color:#666;margin-top:4px;">Nombre y firma del Terapeuta</div>
  </div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Permite ventanas emergentes para imprimir.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
}
