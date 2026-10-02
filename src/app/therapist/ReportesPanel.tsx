'use client'

// ─────────────────────────────────────────────────────────────
// ReportesPanel — Panel deslizante (solo móvil, md:hidden)
// Se abre via window.dispatchEvent(new CustomEvent('avi:openReportes'))
// Mismo esquema visual que AVI-Esencial / AVI-Clínico (Nav panel)
// En desktop el usuario navega a /therapist/reportes (ReportesPageClient)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { Lock } from 'lucide-react'
import {
  imprimirNotaInicialDesdeReportes,
  imprimirSesionesDesdeReportes,
  imprimirAnalisisDesdeReportes,
  imprimirHCOriginalDesdeReportes,
  imprimirHCActualizadaDesdeReportes,
  imprimirReporteValorativoDesdeReportes,
  imprimirIntegracionPlanDesdeReportes,
  imprimirReporteProcesoDesdeReportes,
  imprimirDatosGeneralesDesdeReportes,
} from './patients/[patientId]/print-utils'
import { imprimirReporteAtencion, type ReporteAtencionData } from './reportes/reporte-atencion-print'

// ── Tipos ─────────────────────────────────────────────────────
type ReportId =
  | 'datos-generales' | 'nota-inicial' | 'sesiones' | 'analisis' | 'reporte-atencion'
  | 'hc-original' | 'hc-actualizada' | 'valorativo' | 'integracion' | 'proceso'

interface Empresa  { id: string; nombre: string; logo_url: string | null }
interface Paciente { id: string; nombre: string }

interface Props {
  tier:            string | null
  terapeutaNombre: string
}

// ── Catálogos ─────────────────────────────────────────────────
const ESENCIAL_ITEMS: { id: ReportId; label: string }[] = [
  { id: 'datos-generales',  label: 'Datos Generales' },
  { id: 'nota-inicial',     label: 'Nota Inicial' },
  { id: 'sesiones',         label: 'Sesiones presenciales' },
  { id: 'analisis',         label: 'Análisis clínico y Propuesta técnica' },
  { id: 'reporte-atencion', label: 'Reporte de la Atención' },
]

const CLINICO_ITEMS: { id: ReportId; label: string }[] = [
  { id: 'hc-original',    label: 'Historia Clínica — Original' },
  { id: 'hc-actualizada', label: 'Historia Clínica — Actualizada' },
  { id: 'valorativo',     label: 'Reporte Valorativo' },
  { id: 'integracion',    label: 'Integración y Plan de Intervención' },
  { id: 'proceso',        label: 'Reporte de Proceso' },
]

// ── Componente ────────────────────────────────────────────────
export default function ReportesPanel({ tier, terapeutaNombre }: Props) {
  const [open,      setOpen]      = useState(false)
  const [loaded,    setLoaded]    = useState(false)
  const [empresas,  setEmpresas]  = useState<Empresa[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [logoUrl,   setLogoUrl]   = useState<string | null>(null)
  const [pid,       setPid]       = useState('')
  const [selected,  setSelected]  = useState<ReportId | null>(null)

  // Sesiones
  const [sesiones,   setSesiones]   = useState<{ id: string; label: string; date: string }[]>([])
  const [loadingSes, setLoadingSes] = useState(false)
  const [sessionOpt, setSessionOpt] = useState('all')

  // Análisis
  const [analisisFechas, setAnalisisFechas] = useState<{ id: string; label: string }[]>([])
  const [loadingAnal,    setLoadingAnal]    = useState(false)
  const [analisisOpt,    setAnalisisOpt]    = useState('')

  // Reporte de la Atención
  const [raOpt,     setRaOpt]     = useState('all')
  const [loadingRA, setLoadingRA] = useState(false)
  const [errorRA,   setErrorRA]   = useState('')

  // Impresión clínico
  const [printingId, setPrintingId] = useState<string | null>(null)

  const isClinico = tier === 'clinico'

  // ── Escuchar evento ───────────────────────────────────────────
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('avi:openReportes', handler)
    return () => window.removeEventListener('avi:openReportes', handler)
  }, [])

  // ── Carga inicial ─────────────────────────────────────────────
  useEffect(() => {
    if (!open || loaded) return
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
  }, [open, loaded])

  const close = useCallback(() => setOpen(false), [])

  // ── Cambio de paciente ────────────────────────────────────────
  async function handlePacienteChange(p: string) {
    setPid(p)
    setSessionOpt('all'); setAnalisisOpt(''); setRaOpt('all')
    setSesiones([]); setAnalisisFechas([]); setErrorRA('')
    if (!p) return

    setLoadingSes(true)
    try {
      const res  = await fetch(`/api/therapist/sesiones-lista?pid=${p}`)
      const data = await res.json()
      setSesiones((data.sesiones ?? []).map((s: { id: string; number: number; date: string }) => ({
        id: String(s.id), date: s.date,
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

  const headerOpts      = { terapeutaNombre, logoUrl, side: logoUrl ? 'logo' : 'name' } as const
  const empresasConLogo = empresas.filter(e => e.logo_url)

  function canPrint(): boolean {
    if (!pid || !selected) return false
    if (selected === 'analisis' && !analisisOpt) return false
    if (selected === 'reporte-atencion' && sesiones.length === 0) return false
    if (CLINICO_ITEMS.some(i => i.id === selected) && !isClinico) return false
    return true
  }

  async function handlePrint() {
    if (!pid || !selected) return
    switch (selected) {
      case 'datos-generales':
        await imprimirDatosGeneralesDesdeReportes(pid, headerOpts); break
      case 'nota-inicial':
        await imprimirNotaInicialDesdeReportes(pid, headerOpts); break
      case 'sesiones':
        await imprimirSesionesDesdeReportes(pid, sessionOpt === 'all' ? undefined : sessionOpt, headerOpts); break
      case 'analisis':
        if (!analisisOpt) return
        await imprimirAnalisisDesdeReportes(pid, analisisOpt, headerOpts); break
      case 'reporte-atencion':
        await generarReporteAtencion(); return
      default:
        await runClinico(selected); break
    }
  }

  async function runClinico(id: string) {
    setPrintingId(id)
    try {
      switch (id) {
        case 'hc-original':    await imprimirHCOriginalDesdeReportes(pid);    break
        case 'hc-actualizada': await imprimirHCActualizadaDesdeReportes(pid); break
        case 'valorativo':     await imprimirReporteValorativoDesdeReportes(pid); break
        case 'integracion':    await imprimirIntegracionPlanDesdeReportes(pid);   break
        case 'proceso':        await imprimirReporteProcesoDesdeReportes(pid);    break
      }
    } finally { setPrintingId(null) }
  }

  async function generarReporteAtencion() {
    if (!pid) { setErrorRA('Selecciona un paciente primero.'); return }
    if (sesiones.length === 0) { setErrorRA('Este paciente no tiene sesiones registradas.'); return }
    let dateFrom: string, dateTo: string
    if (raOpt === 'all') {
      dateFrom = sesiones[0].date; dateTo = sesiones[sesiones.length - 1].date
    } else {
      const s = sesiones.find(x => x.id === raOpt)
      if (!s) { setErrorRA('Sesión no encontrada.'); return }
      dateFrom = s.date; dateTo = s.date
    }
    setLoadingRA(true); setErrorRA('')
    try {
      const res  = await fetch('/api/therapist/reporte-atencion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: pid, date_from: dateFrom, date_to: dateTo, patient_status: 'activos' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      imprimirReporteAtencion({ ...data, terapeutaNombre, logoUrl } as ReporteAtencionData)
    } catch (e: unknown) {
      setErrorRA(e instanceof Error ? e.message : 'Error al generar el reporte.')
    } finally { setLoadingRA(false) }
  }

  // ── navItem — igual al EHR sidebar (AVI-Esencial/AVI-Clínico) ─
  function navItem(id: ReportId, label: string, dim = false) {
    return (
      <button
        key={id}
        onClick={() => { if (!dim) setSelected(id) }}
        disabled={dim}
        className={[
          'w-full flex items-center gap-2 px-2 py-2 text-left transition-colors',
          dim
            ? 'text-gray-300 cursor-not-allowed'
            : selected === id
              ? 'bg-primary-50 text-primary-700 font-medium border-r-2 border-primary-500'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
        ].join(' ')}
      >
        <span className="flex-1 truncate text-sm leading-tight">{label}</span>
      </button>
    )
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition-opacity duration-200
                    ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-black/40" onClick={close} />
      </div>

      {/* Panel deslizante desde la derecha — solo móvil */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reportes terapéuticos"
        className={`md:hidden fixed top-0 right-0 h-full w-72 bg-white shadow-xl z-50
                    flex flex-col overflow-hidden
                    transition-transform duration-200
                    ${open ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header — igual al Nav panel */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Reportes</p>
          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
            aria-label="Cerrar panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* Selectores de paciente y encabezado */}
          <div className="px-3 pt-3 pb-2 space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1">Paciente</label>
              <select
                value={pid}
                onChange={e => handlePacienteChange(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="">— Elige un paciente —</option>
                {pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            {empresasConLogo.length >= 1 && (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1">Encabezado</label>
                <select
                  value={logoUrl ?? '__nombre__'}
                  onChange={e => setLogoUrl(e.target.value === '__nombre__' ? null : e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm bg-white
                             focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  {empresasConLogo.map(e => (
                    <option key={e.id} value={e.logo_url!}>{e.nombre} (logo)</option>
                  ))}
                  <option value="__nombre__">{terapeutaNombre} (nombre)</option>
                </select>
              </div>
            )}
          </div>

          {/* Separador */}
          <div className="border-t border-gray-100 mx-3 my-2" />

          {/* AVI-Esencial */}
          <p className="text-[15px] font-semibold text-primary-600 uppercase tracking-widest px-3 pt-1 pb-1.5">
            AVI-Esencial
          </p>
          {ESENCIAL_ITEMS.map(item => navItem(item.id, item.label))}

          {/* Separador */}
          <div className="border-t border-gray-100 mx-3 my-2.5" />

          {/* AVI-Clínico */}
          <div className="flex items-center gap-1.5 px-3 pb-1.5">
            <p className={`text-[15px] font-semibold uppercase tracking-widest ${!isClinico ? 'text-gray-300' : 'text-primary-600'}`}>
              AVI-Clínico
            </p>
            {!isClinico && <Lock size={10} className="text-gray-300" />}
          </div>
          {CLINICO_ITEMS.map(item => navItem(item.id, item.label, !isClinico))}
          {!isClinico && (
            <p className="text-[10px] text-gray-300 px-3 pt-1 leading-relaxed">
              Disponible en plan Clínico
            </p>
          )}

          {/* Opciones del reporte seleccionado */}
          {selected && (
            <>
              <div className="border-t border-gray-100 mx-3 mt-3 mb-2" />
              <div className="px-3 pb-6 space-y-3">

                {selected === 'sesiones' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Sesión</label>
                    <select
                      value={sessionOpt}
                      onChange={e => setSessionOpt(e.target.value)}
                      disabled={loadingSes || !pid}
                      className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm bg-white
                                 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:opacity-50"
                    >
                      <option value="all">Todas las sesiones</option>
                      {sesiones.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                )}

                {selected === 'analisis' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Fecha del análisis</label>
                    <select
                      value={analisisOpt}
                      onChange={e => setAnalisisOpt(e.target.value)}
                      disabled={loadingAnal || !pid}
                      className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm bg-white
                                 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:opacity-50"
                    >
                      <option value="">— Selecciona un análisis —</option>
                      {analisisFechas.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                    {pid && !loadingAnal && analisisFechas.length === 0 && (
                      <p className="text-[10px] text-gray-400">Sin análisis generados para este paciente.</p>
                    )}
                  </div>
                )}

                {selected === 'reporte-atencion' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Rango de sesiones</label>
                    <select
                      value={raOpt}
                      onChange={e => { setRaOpt(e.target.value); setErrorRA('') }}
                      disabled={loadingSes || !pid || sesiones.length === 0}
                      className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm bg-white
                                 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:opacity-50"
                    >
                      <option value="all">Todas las sesiones</option>
                      {sesiones.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    {errorRA && <p className="text-xs text-red-500">{errorRA}</p>}
                    {pid && !loadingSes && sesiones.length === 0 && (
                      <p className="text-[10px] text-gray-400">Este paciente no tiene sesiones registradas.</p>
                    )}
                  </div>
                )}

                {/* Bloqueo clínico */}
                {CLINICO_ITEMS.some(i => i.id === selected) && !isClinico ? (
                  <div className="flex items-center gap-2 text-xs text-amber-600
                                  bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                    <Lock size={12} />
                    <span>Requiere Plan Clínico.{' '}
                      <a href="/pricing" className="underline">Ver planes →</a>
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handlePrint}
                    disabled={!canPrint() || loadingRA || !!printingId}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                               bg-primary-600 text-white rounded-xl font-semibold text-sm
                               hover:bg-primary-700 transition-colors
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {(loadingRA || printingId === selected) ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generando…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Imprimir / Guardar PDF
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
