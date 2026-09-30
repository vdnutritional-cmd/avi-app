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
  buildReportHeader,
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
      imprimirReporteAtencion({ ...data, terapeutaNombre, logoUrl })
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

// ── Tipos de la respuesta del API ────────────────────────────
interface SesionResumen {
  fecha: string; numero: number
  intervencion: string; acuerdo: string; seguimiento: string
}
interface FactorGrupo { esquema: string; items: string[] }
interface ItemFecha   { fecha: string; texto: string }

interface ReporteAtencionData {
  paciente_nombre:            string
  terapeuta_nombre:           string
  tipo_caso:                  string
  problematica:               string
  motivo_subyacente:          string
  motivo_consulta:            string
  emociones:                  ItemFecha[]
  recursos:                   ItemFecha[]
  factores_riesgo:            FactorGrupo[]
  factores_proteccion:        FactorGrupo[]
  sesiones_resumenes:         SesionResumen[]
  derivacion_tipos:           string[]
  atencion_especializada:     string
  atencion_especializada_cual: string
  total_sesiones:             number
  // Meta para el encabezado
  terapeutaNombre:            string
  logoUrl:                    string | null
}

// ── Función de impresión: Reporte de la Atención (9 secciones) ─
function imprimirReporteAtencion(data: ReporteAtencionData) {
  const {
    paciente_nombre, tipo_caso, problematica, motivo_subyacente, motivo_consulta,
    emociones, recursos, factores_riesgo, factores_proteccion,
    sesiones_resumenes, derivacion_tipos, atencion_especializada,
    atencion_especializada_cual, total_sesiones,
    terapeutaNombre, logoUrl,
  } = data

  const encabezado = buildReportHeader({
    terapeutaNombre,
    logoUrl,
    side: logoUrl ? 'logo' : 'name',
  })

  // Helper: lista de items por fecha
  const listaFechas = (items: ItemFecha[]) =>
    items.length === 0
      ? '<p class="empty">Sin datos registrados en el periodo.</p>'
      : items.map(i =>
          `<div class="fecha-item">
             <div class="fecha-label">${i.fecha}</div>
             <div class="fecha-texto">${i.texto.replace(/\n/g, '<br>')}</div>
           </div>`
        ).join('')

  // Helper: factores de riesgo/protección
  const factoresHtml = (grupos: FactorGrupo[]) =>
    grupos.length === 0
      ? '<p class="empty">Sin factores registrados.</p>'
      : grupos.map(g =>
          `<div class="factor-schema">${g.esquema}</div>
           <ul class="factor-list">${g.items.map(f => `<li>${f}</li>`).join('')}</ul>`
        ).join('')

  // Helper: resúmenes de sesiones por campo
  const resumenFecha = (campo: keyof SesionResumen) =>
    sesiones_resumenes.length === 0
      ? '<p class="empty">Sin sesiones en el periodo.</p>'
      : sesiones_resumenes.map(s => `
          <div class="fecha-item">
            <div class="fecha-label">Sesión ${s.numero} · ${s.fecha}</div>
            <div class="fecha-texto">${((s[campo] as string) || '—').replace(/\n/g, '<br>')}</div>
          </div>`
        ).join('')

  // Sección 9 — Derivación
  const derivStr = derivacion_tipos.length > 0 ? derivacion_tipos.join(', ') : 'n/a'
  const atEspStr = atencion_especializada === 'SI' && atencion_especializada_cual
    ? `Sí — ${atencion_especializada_cual}`
    : atencion_especializada === 'SI' ? 'Sí' : 'No aplica'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Reporte de la Atención — ${paciente_nombre}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    @page { margin:2.2cm 2.5cm; }
    body { font-family:'Georgia','Times New Roman',serif; font-size:10.5pt; color:#1a1a1a; line-height:1.6; }

    /* Encabezado */
    .doc-title { text-align:center; border-bottom:2pt solid #2d3a8c; border-top:0.5pt solid #2d3a8c;
                 padding:10pt 0; margin-bottom:14pt; }
    .doc-title h1 { font-size:14pt; letter-spacing:0.5pt; color:#2d3a8c; text-transform:uppercase; }
    .doc-title .sub { font-size:10pt; color:#5060a4; font-style:italic; margin-top:2pt; }
    .meta { display:flex; justify-content:space-between; margin-bottom:18pt; font-size:9.5pt;
            color:#444; background:#f4f6fb; padding:6pt 10pt; border-radius:4pt; }
    .meta strong { color:#1a1a1a; }

    /* Secciones */
    .section { margin-bottom:16pt; }
    .section-title { font-size:10.5pt; font-weight:bold; color:#2d3a8c; text-transform:uppercase;
                     letter-spacing:0.4pt; border-bottom:1pt solid #b0bbd4;
                     padding-bottom:4pt; margin-bottom:10pt; }
    .section-title .num { font-size:9pt; font-weight:normal; margin-right:4pt; opacity:0.7; }
    .section-body { font-size:10pt; line-height:1.65; color:#1a1a1a; white-space:pre-wrap; }
    .empty { color:#999; font-style:italic; font-size:9.5pt; }

    /* Items por fecha */
    .fecha-item { margin-bottom:10pt; padding-left:8pt; border-left:2pt solid #c8d0e8; }
    .fecha-label { font-size:9pt; font-weight:bold; color:#2d3a8c; margin-bottom:2pt; }
    .fecha-texto { font-size:10pt; color:#1a1a1a; line-height:1.6; }

    /* Factores */
    .factor-schema { font-size:9.5pt; font-weight:bold; color:#2d3a8c; margin:6pt 0 3pt; }
    .factor-list   { list-style:disc; padding-left:18pt; font-size:10pt; margin-bottom:6pt; }

    /* Derivación */
    .deriv-row { display:flex; gap:12pt; margin-bottom:6pt; }
    .deriv-label { font-weight:bold; color:#333; min-width:140pt; font-size:10pt; }
    .deriv-val { font-size:10pt; color:#1a1a1a; }

    /* Firma */
    .firma-section { margin-top:28pt; border-top:1pt solid #ccc; padding-top:14pt;
                     display:grid; grid-template-columns:1fr 1fr; gap:30pt; }
    .firma-item { text-align:center; }
    .firma-linea { border-top:1pt solid #333; padding-top:5pt; font-size:9.5pt; color:#444; }
    .firma-name { margin-top:4pt; font-size:9.5pt; font-weight:bold; color:#1a1a1a; }
    .firma-label { font-size:10pt; font-weight:bold; color:#333; margin-bottom:20pt; }

    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
    }
  </style>
</head>
<body>

  <div class="no-print" style="text-align:right;padding:10pt 0 14pt;">
    <button onclick="window.print()"
      style="padding:8pt 18pt;background:#2d3a8c;color:white;border:none;border-radius:8pt;font-size:10pt;cursor:pointer;">
      🖨 Imprimir / Guardar PDF
    </button>
  </div>

  <!-- Encabezado formal (fecha + logo/nombre + "Reporte impreso por") -->
  ${encabezado}

  <!-- Título del documento -->
  <div class="doc-title">
    <h1>Reporte de la Atención</h1>
    <div class="sub">Reporte terapéutico integral</div>
  </div>

  <!-- Meta -->
  <div class="meta">
    <div><strong>Asesorado:</strong> ${paciente_nombre}</div>
    <div><strong>Total sesiones en el periodo:</strong> ${total_sesiones}</div>
  </div>

  <!-- 1. Motivo de consulta -->
  <div class="section">
    <div class="section-title"><span class="num">1.</span> Motivo de Consulta</div>
    ${tipo_caso ? `<div class="section-body"><strong>Tipo de caso:</strong> ${tipo_caso}</div>` : ''}
    ${problematica ? `<div class="section-body" style="margin-top:4pt;"><strong>Problemática:</strong> ${problematica.replace(/\n/g, '<br>')}</div>` : ''}
    ${motivo_subyacente ? `<div class="section-body" style="margin-top:4pt;"><strong>Motivo de consulta subyacente:</strong> ${motivo_subyacente.replace(/\n/g, '<br>')}</div>` : ''}
    ${!tipo_caso && !problematica && !motivo_subyacente ? '<p class="empty">Sin información registrada.</p>' : ''}
  </div>

  <!-- 2. Situación principal -->
  <div class="section">
    <div class="section-title"><span class="num">2.</span> Situación Principal</div>
    ${motivo_consulta
      ? `<div class="section-body">${motivo_consulta.replace(/\n/g, '<br>')}</div>`
      : '<p class="empty">Sin registrar.</p>'}
  </div>

  <!-- 3. Emociones identificadas -->
  <div class="section">
    <div class="section-title"><span class="num">3.</span> Emociones Identificadas</div>
    ${listaFechas(emociones)}
  </div>

  <!-- 4. Recursos personales -->
  <div class="section">
    <div class="section-title"><span class="num">4.</span> Recursos Personales del Paciente</div>
    ${listaFechas(recursos)}
  </div>

  <!-- 5. Factores de riesgo y protección -->
  <div class="section">
    <div class="section-title"><span class="num">5.</span> Factores de Riesgo y Protección</div>
    <div style="margin-bottom:8pt;">
      <div style="font-size:9pt;font-weight:bold;color:#444;text-transform:uppercase;letter-spacing:0.3pt;margin-bottom:4pt;">
        Factores de riesgo
      </div>
      ${factoresHtml(factores_riesgo)}
    </div>
    <div>
      <div style="font-size:9pt;font-weight:bold;color:#444;text-transform:uppercase;letter-spacing:0.3pt;margin-bottom:4pt;">
        Factores de protección
      </div>
      ${factoresHtml(factores_proteccion)}
    </div>
  </div>

  <!-- 6. Intervención realizada -->
  <div class="section">
    <div class="section-title"><span class="num">6.</span> Intervención Realizada</div>
    ${resumenFecha('intervencion')}
  </div>

  <!-- 7. Acuerdos -->
  <div class="section">
    <div class="section-title"><span class="num">7.</span> Acuerdos</div>
    ${resumenFecha('acuerdo')}
  </div>

  <!-- 8. Seguimiento -->
  <div class="section">
    <div class="section-title"><span class="num">8.</span> Seguimiento</div>
    ${resumenFecha('seguimiento')}
  </div>

  <!-- 9. Derivación y Atención especializada -->
  <div class="section">
    <div class="section-title"><span class="num">9.</span> Derivación y Atención Especializada</div>
    <div class="deriv-row">
      <span class="deriv-label">Derivación:</span>
      <span class="deriv-val">${derivStr}</span>
    </div>
    <div class="deriv-row">
      <span class="deriv-label">Atención especializada:</span>
      <span class="deriv-val">${atEspStr}</span>
    </div>
  </div>

  <!-- Firma -->
  <div class="firma-section">
    <div class="firma-item">
      <div class="firma-label">Elabora</div>
      <div class="firma-linea">
        <div class="firma-name">${terapeutaNombre}</div>
        <div style="font-size:8.5pt;color:#666;">Nombre y firma del Terapeuta</div>
      </div>
    </div>
    <div class="firma-item">
      <div class="firma-label">VoBo</div>
      <div class="firma-linea">
        <div class="firma-name">&nbsp;</div>
        <div style="font-size:8.5pt;color:#666;">Nombre y firma</div>
      </div>
    </div>
  </div>

</body>
</html>`

  printHtmlViaIframe(html)
}
