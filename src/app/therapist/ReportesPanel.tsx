'use client'

// ─────────────────────────────────────────────────────────────
// ReportesPanel — Panel flotante de Reportes Terapéuticos
// Bottom sheet en móvil · Drawer derecho en desktop
// Se abre via window.dispatchEvent(new CustomEvent('avi:openReportes'))
// Se cierra al hacer clic fuera del panel (backdrop)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import {
  imprimirNotaInicialDesdeReportes,
  imprimirSesionesDesdeReportes,
  imprimirAnalisisDesdeReportes,
  printHtmlViaIframe,
} from './patients/[patientId]/print-utils'

interface Empresa  { id: string; nombre: string; logo_url: string | null }
interface Paciente { id: string; nombre: string }

interface Props {
  tier:            string | null
  terapeutaNombre: string
}

export default function ReportesPanel({ tier, terapeutaNombre }: Props) {
  // ── Estado principal ──────────────────────────────────────────
  const [isOpen,    setIsOpen]    = useState(false)
  const [loaded,    setLoaded]    = useState(false)
  const [empresas,  setEmpresas]  = useState<Empresa[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])

  // ── Selecciones ───────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [pid,     setPid]     = useState('')

  // ── Acordeón ─────────────────────────────────────────────────
  const [openEsencial, setOpenEsencial] = useState(true)

  // ── Sesiones ──────────────────────────────────────────────────
  const [sessionOpt, setSessionOpt] = useState('all')
  const [sesiones,   setSesiones]   = useState<{ id: string; label: string; date: string }[]>([])
  const [loadingSes, setLoadingSes] = useState(false)

  // ── Análisis ──────────────────────────────────────────────────
  const [analisisOpt,    setAnalisisOpt]    = useState('')
  const [analisisFechas, setAnalisisFechas] = useState<{ id: string; label: string }[]>([])
  const [loadingAnal,    setLoadingAnal]    = useState(false)

  // ── Reporte de la Atención ────────────────────────────────────
  const [raOpt,     setRaOpt]     = useState('all') // 'all' o session id
  const [loadingRA, setLoadingRA] = useState(false)
  const [errorRA,   setErrorRA]   = useState('')

  // ── Escuchar evento para abrir ────────────────────────────────
  useEffect(() => {
    const handler = () => setIsOpen(true)
    window.addEventListener('avi:openReportes', handler)
    return () => window.removeEventListener('avi:openReportes', handler)
  }, [])

  // ── Cargar datos la primera vez que se abre ───────────────────
  useEffect(() => {
    if (!isOpen || loaded) return
    fetch('/api/therapist/reportes-init')
      .then(r => r.json())
      .then(data => {
        const emp: Empresa[] = data.empresas ?? []
        setEmpresas(emp)
        setPacientes(data.pacientesActivos ?? [])
        const conLogo = emp.filter(e => e.logo_url)
        setLogoUrl(conLogo[0]?.logo_url ?? null)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [isOpen, loaded])

  // ── Cerrar ────────────────────────────────────────────────────
  const close = useCallback(() => setIsOpen(false), [])

  // ── Cambio de paciente — carga sesiones y análisis ────────────
  async function handlePacienteChange(p: string) {
    setPid(p)
    setSessionOpt('all')
    setAnalisisOpt('')
    setRaOpt('all')
    setSesiones([])
    setAnalisisFechas([])
    setErrorRA('')
    if (!p) return

    setLoadingSes(true)
    try {
      const res  = await fetch(`/api/therapist/sesiones-lista?pid=${p}`)
      const data = await res.json()
      setSesiones((data.sesiones ?? []).map((s: { id: string; number: number; date: string }) => ({
        id: String(s.id),
        date: s.date,
        label: `Sesión ${s.number} — ${new Date(s.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      })))
    } catch { setSesiones([]) }
    setLoadingSes(false)

    setLoadingAnal(true)
    try {
      const res  = await fetch(`/api/therapist/analisis-lista?pid=${p}`)
      const data = await res.json()
      setAnalisisFechas((data.analisis ?? []).map((a: { id: string; fecha: string }) => ({
        id: a.id,
        label: new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
      })))
    } catch { setAnalisisFechas([]) }
    setLoadingAnal(false)
  }

  // ── Acciones de impresión ─────────────────────────────────────
  async function printNotaInicial() {
    if (!pid) return
    await imprimirNotaInicialDesdeReportes(pid)
  }

  async function printSesiones() {
    if (!pid) return
    await imprimirSesionesDesdeReportes(pid, sessionOpt === 'all' ? undefined : sessionOpt)
  }

  async function printAnalisis() {
    if (!pid || !analisisOpt) return
    await imprimirAnalisisDesdeReportes(pid, analisisOpt)
  }

  async function generarReporteAtencion() {
    if (!pid) { setErrorRA('Selecciona un paciente primero.'); return }
    if (sesiones.length === 0) { setErrorRA('Este paciente no tiene sesiones registradas.'); return }
    // Derivar rango de fechas desde el dropdown de sesiones
    let dateFrom: string
    let dateTo: string
    if (raOpt === 'all') {
      dateFrom = sesiones[0].date
      dateTo   = sesiones[sesiones.length - 1].date
    } else {
      const s = sesiones.find(x => x.id === raOpt)
      if (!s) { setErrorRA('Sesión no encontrada.'); return }
      dateFrom = s.date
      dateTo   = s.date
    }
    setLoadingRA(true); setErrorRA('')
    try {
      const res  = await fetch('/api/therapist/reporte-atencion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: pid, date_from: dateFrom, date_to: dateTo, patient_status: 'activos' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      imprimirReporteAtencion({ ...data, terapeutaNombre, logoUrl, dateFrom, dateTo })
    } catch (e: unknown) {
      setErrorRA(e instanceof Error ? e.message : 'Error al generar el reporte.')
    } finally { setLoadingRA(false) }
  }

  // ── Empresas con logo ─────────────────────────────────────────
  const empresasConLogo = empresas.filter(e => e.logo_url)

  // ── No renderizar si cerrado ──────────────────────────────────
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop — clic fuera cierra el panel */}
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={close}
        aria-hidden="true"
      />

      {/* Panel — bottom sheet en móvil, drawer derecho en desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reportes terapéuticos"
        className="fixed z-[51] bg-white overflow-y-auto
                   bottom-0 left-0 right-0 rounded-t-3xl max-h-[88vh]
                   md:bottom-auto md:top-0 md:left-auto md:right-0
                   md:h-screen md:w-[22rem] md:rounded-none md:rounded-l-2xl
                   shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle drag (solo móvil) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-gray-900">🖨️ Reportes terapéuticos</h2>
          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-xl hover:bg-gray-100"
            aria-label="Cerrar panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5 pb-10">

          {/* ── Selector de logo (solo si 2+ empresas con logo) ── */}
          {empresasConLogo.length > 1 && (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Encabezado del reporte
              </label>
              <select
                value={logoUrl ?? '__nombre__'}
                onChange={e => setLogoUrl(e.target.value === '__nombre__' ? null : e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                {empresasConLogo.map(e => (
                  <option key={e.id} value={e.logo_url!}>{e.nombre} (logo)</option>
                ))}
                <option value="__nombre__">{terapeutaNombre} (nombre)</option>
              </select>
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Vista previa del logo" className="h-7 max-w-[100px] object-contain" />
              )}
            </div>
          )}

          {/* ── Selector de paciente (solo activos) ─────────────── */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Paciente
            </label>
            <select
              value={pid}
              onChange={e => handlePacienteChange(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="">— Elige un paciente —</option>
              {pacientes.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 leading-relaxed">
              Solo pacientes activos. Para imprimir reportes de un paciente inactivo, primero deberás «Desbloquearlo».
            </p>
          </div>

          {/* ── AVI-Esencial accordion ───────────────────────────── */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpenEsencial(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-purple-50 hover:bg-purple-100 transition-colors"
            >
              <span className="text-sm font-semibold text-purple-800">📄 Reportes AVI-Esencial</span>
              <svg
                className={`w-4 h-4 text-purple-600 transition-transform duration-200 ${openEsencial ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {openEsencial && (
              <div className="divide-y divide-gray-100">

                {/* E5a — Nota Inicial */}
                <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-800 font-medium">Nota Inicial</p>
                    <p className="text-xs text-gray-400">Primera consulta del paciente</p>
                  </div>
                  <PrintBtn onClick={printNotaInicial} disabled={!pid} />
                </div>

                {/* E5b — Sesiones presenciales */}
                <div className="px-4 py-3.5 space-y-2.5">
                  <p className="text-sm text-gray-800 font-medium">Sesiones presenciales</p>
                  <div className="flex gap-2 items-center">
                    <select
                      value={sessionOpt}
                      onChange={e => setSessionOpt(e.target.value)}
                      disabled={loadingSes || !pid}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
                    >
                      <option value="all">Todas las sesiones</option>
                      {sesiones.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                    <PrintBtn onClick={printSesiones} disabled={!pid} />
                  </div>
                </div>

                {/* E5c — Análisis clínico */}
                <div className="px-4 py-3.5 space-y-2.5">
                  <p className="text-sm text-gray-800 font-medium">Análisis clínico y Propuesta técnica</p>
                  <div className="flex gap-2 items-center">
                    <select
                      value={analisisOpt}
                      onChange={e => setAnalisisOpt(e.target.value)}
                      disabled={loadingAnal || !pid}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
                    >
                      <option value="">— Selecciona un análisis —</option>
                      {analisisFechas.map(a => (
                        <option key={a.id} value={a.id}>{a.label}</option>
                      ))}
                    </select>
                    <PrintBtn onClick={printAnalisis} disabled={!pid || !analisisOpt} />
                  </div>
                  {pid && !loadingAnal && analisisFechas.length === 0 && (
                    <p className="text-xs text-gray-400">Sin análisis generados para este paciente.</p>
                  )}
                </div>

                {/* E6 — Reporte de la Atención */}
                <div className="px-4 py-3.5 space-y-2.5">
                  <p className="text-sm text-gray-800 font-medium">Reporte de la Atención</p>
                  <div className="flex gap-2 items-center">
                    <select
                      value={raOpt}
                      onChange={e => { setRaOpt(e.target.value); setErrorRA('') }}
                      disabled={loadingSes || !pid || sesiones.length === 0}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
                    >
                      <option value="all">Todas las sesiones</option>
                      {sesiones.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={generarReporteAtencion}
                      disabled={loadingRA || !pid || sesiones.length === 0}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-700
                                 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100
                                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                      {loadingRA ? (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                      )}
                      {loadingRA ? 'Generando…' : 'Imprimir'}
                    </button>
                  </div>
                  {errorRA && <p className="text-xs text-red-500">{errorRA}</p>}
                  {pid && !loadingSes && sesiones.length === 0 && (
                    <p className="text-xs text-gray-400">Este paciente no tiene sesiones registradas.</p>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* ── AVI-CLÍNICO placeholder (pendiente) ─────────────── */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 bg-gray-50 opacity-60">
              <span className="text-sm font-semibold text-gray-500">🔒 Reportes AVI-CLÍNICO</span>
              <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                {tier === 'clinico' ? 'Próximamente' : 'Plan Clínico'}
              </span>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ── Botón de impresión ────────────────────────────────────────
function PrintBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-700
                 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100
                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      Imprimir
    </button>
  )
}

// ── Función de impresión: Reporte de la Atención ──────────────
function imprimirReporteAtencion(data: {
  s6: string; s7: string; s8: string
  pacientes: { nombre: string; motivo: string; total_sesiones: number; fechas: string[] }[]
  terapeutaNombre: string; logoUrl: string | null
  dateFrom: string; dateTo: string
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

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Reporte de la Atención</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Helvetica Neue',Arial,sans-serif; font-size:10.5pt; color:#222; padding:36px 44px; line-height:1.6; }
    .header { display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #ddd; padding-bottom:10px; margin-bottom:6px; }
    .sub-header { font-size:8.5pt; color:#888; margin-bottom:20px; }
    h1 { font-size:16pt; font-weight:700; margin-bottom:2px; }
    h2 { font-size:11pt; font-weight:600; color:#5b21b6; margin:22px 0 8px; border-bottom:1px solid #ede9fe; padding-bottom:4px; }
    p { margin-bottom:10px; }
    .firma-block { margin-top:48px; border-top:1px solid #ddd; padding-top:16px; }
    @media print { body { padding:20px; } }
  </style></head><body>
  <div class="header">
    <div>
      <h1>Reporte de la Atención</h1>
      <div style="font-size:9pt;color:#666;">Del ${fmtDate(dateFrom)} al ${fmtDate(dateTo)}</div>
    </div>
    <div style="text-align:right;">${rightContent}</div>
  </div>
  <div class="sub-header">${date} · Reporte impreso por: <strong>${terapeutaNombre}</strong></div>
  <h2>1. Datos del / los asesorado(s)</h2>${pacientesHtml}
  <h2>2. Número de sesiones atendidas</h2>
  <p>Total de sesiones en el periodo: <strong>${pacientes.reduce((a, p) => a + p.total_sesiones, 0)}</strong></p>
  <h2>3. Resumen de las sesiones</h2><p>${s6.replace(/\n/g, '<br/>')}</p>
  <h2>4. Análisis del proceso terapéutico</h2><p>${s7.replace(/\n/g, '<br/>')}</p>
  <h2>5. Conclusiones y recomendaciones</h2><p>${s8.replace(/\n/g, '<br/>')}</p>
  <div class="firma-block">
    <div style="display:inline-block;border-bottom:1px solid #444;width:220px;padding-bottom:4px;font-size:9.5pt;">${terapeutaNombre}</div>
    <div style="font-size:8.5pt;color:#666;margin-top:4px;">Nombre y firma del Terapeuta</div>
  </div>
  </body></html>`

  printHtmlViaIframe(html)
}
