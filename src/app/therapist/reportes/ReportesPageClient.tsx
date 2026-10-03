'use client'

// ─────────────────────────────────────────────────────────────
// ReportesPageClient — Página desktop de Reportes Terapéuticos
// Layout: sidebar izquierdo (tipo EHR) + área de contenido
// Solo visible en md:flex — en móvil se usa ReportesPanel
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
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
  type DGPreloaded,
} from '../patients/[patientId]/print-utils'
import { imprimirReporteAtencion, type ReporteAtencionData } from './reporte-atencion-print'
import { createClient } from '@/lib/supabase/client'

// ── Tipos ─────────────────────────────────────────────────────
type ReportId =
  | 'datos-generales' | 'nota-inicial' | 'sesiones' | 'analisis' | 'reporte-atencion'
  | 'hc-original' | 'hc-actualizada' | 'valorativo' | 'integracion' | 'proceso'

interface Empresa  { id: string; nombre: string; logo_url: string | null }
interface Paciente { id: string; nombre: string }
interface Props    { tier: string | null; terapeutaNombre: string }

// ── Catálogos ─────────────────────────────────────────────────
const ESENCIAL_ITEMS: { id: ReportId; label: string; desc: string }[] = [
  { id: 'datos-generales',   label: 'Datos Generales',                       desc: 'Ficha del asesorado con genograma (1 hoja).' },
  { id: 'nota-inicial',      label: 'Nota Inicial',                          desc: 'Primera consulta del paciente.' },
  { id: 'sesiones',          label: 'Sesiones presenciales',                 desc: 'Todas o una sesión específica.' },
  { id: 'analisis',          label: 'Análisis clínico y Propuesta técnica',  desc: 'Selecciona la fecha del análisis.' },
  { id: 'reporte-atencion',  label: 'Reporte de la Atención',                desc: 'Resumen integral de la atención (9 secciones).' },
]

const CLINICO_ITEMS: { id: ReportId; label: string }[] = [
  { id: 'hc-original',    label: 'Historia Clínica — Original' },
  { id: 'hc-actualizada', label: 'Historia Clínica — Actualizada' },
  { id: 'valorativo',     label: 'Reporte Valorativo' },
  { id: 'integracion',    label: 'Integración y Plan de Intervención' },
  { id: 'proceso',        label: 'Reporte de Proceso' },
]

// ── Componente principal ──────────────────────────────────────
export default function ReportesPageClient({ tier, terapeutaNombre }: Props) {
  const isClinico = tier === 'clinico'

  // Estado general
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

  // Cache de datos pre-cargados para el reporte Datos Generales
  const [dgCache, setDgCache] = useState<DGPreloaded | null>(null)

  // ── Cargar datos iniciales ─────────────────────────────────
  useEffect(() => {
    if (loaded) return
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
  }, [loaded])

  // ── Cambio de paciente ─────────────────────────────────────
  async function handlePacienteChange(p: string) {
    setPid(p)
    setDgCache(null)
    setSessionOpt('all')
    setAnalisisOpt('')
    setRaOpt('all')
    setSesiones([])
    setAnalisisFechas([])
    setErrorRA('')
    if (!p) return

    // Pre-cargar expediente + nombre del paciente (fire-and-forget)
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const [expRes, patRes] = await Promise.all([
          supabase.from('patient_expediente').select('*').eq('therapist_id', user.id).eq('patient_id', p).maybeSingle(),
          supabase.from('profiles').select('full_name, email').eq('id', p).single(),
        ])
        setDgCache({
          expediente:      expRes.data ?? null,
          patientName:     patRes.data?.full_name ?? patRes.data?.email ?? '—',
          patientEmail:    patRes.data?.email ?? '',
          terapeutaNombre: terapeutaNombre,
        })
      } catch { /* silently fail */ }
    })()

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

  const headerOpts = { terapeutaNombre, logoUrl, side: logoUrl ? 'logo' : 'name' } as const
  const empresasConLogo = empresas.filter(e => e.logo_url)

  // ── Acciones de impresión ──────────────────────────────────
  async function handlePrint() {
    if (!pid || !selected) return
    switch (selected) {
      case 'datos-generales':
        await imprimirDatosGeneralesDesdeReportes(pid, headerOpts, dgCache ?? undefined); break
      case 'nota-inicial':
        await imprimirNotaInicialDesdeReportes(pid, headerOpts); break
      case 'sesiones':
        await imprimirSesionesDesdeReportes(pid, sessionOpt === 'all' ? undefined : sessionOpt, headerOpts); break
      case 'analisis':
        if (!analisisOpt) return
        await imprimirAnalisisDesdeReportes(pid, analisisOpt, headerOpts); break
      case 'reporte-atencion':
        await generarReporteAtencion(); return
      case 'hc-original':
        if (!isClinico) return
        await runClinico('hc-original'); break
      case 'hc-actualizada':
        if (!isClinico) return
        await runClinico('hc-actualizada'); break
      case 'valorativo':
        if (!isClinico) return
        await runClinico('valorativo'); break
      case 'integracion':
        if (!isClinico) return
        await runClinico('integracion'); break
      case 'proceso':
        if (!isClinico) return
        await runClinico('proceso'); break
    }
  }

  async function runClinico(id: string) {
    setPrintingId(id)
    try {
      switch (id) {
        case 'hc-original':    await imprimirHCOriginalDesdeReportes(pid, headerOpts);    break
        case 'hc-actualizada': await imprimirHCActualizadaDesdeReportes(pid, headerOpts); break
        case 'valorativo':     await imprimirReporteValorativoDesdeReportes(pid, headerOpts); break
        case 'integracion':    await imprimirIntegracionPlanDesdeReportes(pid, headerOpts);   break
        case 'proceso':        await imprimirReporteProcesoDesdeReportes(pid, headerOpts);    break
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

  // ── Util: ¿el reporte seleccionado puede imprimirse ya? ───
  function canPrint(): boolean {
    if (!pid || !selected) return false
    if (selected === 'analisis' && !analisisOpt) return false
    if (selected === 'reporte-atencion' && sesiones.length === 0) return false
    if (CLINICO_ITEMS.some(i => i.id === selected) && !isClinico) return false
    return true
  }

  // ── NavItem del sidebar ───────────────────────────────────
  function navItem(id: ReportId, label: string, dim = false) {
    return (
      <button
        key={id}
        onClick={() => { if (!dim) setSelected(id) }}
        disabled={dim}
        className={[
          'w-full flex items-center gap-2 px-2 py-2 text-left text-sm transition-colors',
          dim
            ? 'text-gray-300 cursor-not-allowed'
            : selected === id
              ? 'bg-primary-50 text-primary-700 font-medium border-r-2 border-primary-500'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
        ].join(' ')}
      >
        <span className="flex-1 truncate leading-tight">{label}</span>
      </button>
    )
  }

  // ── Área de contenido (derecha) ───────────────────────────
  function renderContent() {
    if (!selected) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-24">
          <svg className="w-12 h-12 mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          <p className="text-sm font-medium text-gray-400">Selecciona un reporte del menú izquierdo</p>
          <p className="text-xs text-gray-300 mt-1">y elige un paciente para imprimir</p>
        </div>
      )
    }

    const info = [...ESENCIAL_ITEMS, ...CLINICO_ITEMS.map(i => ({ ...i, desc: '' }))].find(i => i.id === selected)
    const isClinicoReport = CLINICO_ITEMS.some(i => i.id === selected)
    const locked = isClinicoReport && !isClinico

    return (
      <div className="max-w-xl space-y-6">
        {/* Título del reporte */}
        <div>
          <h2 className="text-lg font-bold text-gray-800">{info?.label}</h2>
          {'desc' in (info ?? {}) && (info as { desc?: string }).desc && (
            <p className="text-sm text-gray-400 mt-0.5">{(info as { desc?: string }).desc}</p>
          )}
          {locked && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
              <Lock size={14} />
              Este reporte requiere Plan Clínico.{' '}
              <a href="/pricing" className="underline hover:text-amber-800">Ver planes →</a>
            </div>
          )}
        </div>

        {/* Opciones específicas por reporte */}
        {selected === 'sesiones' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sesión</label>
            <select
              value={sessionOpt}
              onChange={e => setSessionOpt(e.target.value)}
              disabled={loadingSes || !pid}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:opacity-50"
            >
              <option value="all">Todas las sesiones</option>
              {sesiones.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        )}

        {selected === 'analisis' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha del análisis</label>
            <select
              value={analisisOpt}
              onChange={e => setAnalisisOpt(e.target.value)}
              disabled={loadingAnal || !pid}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:opacity-50"
            >
              <option value="">— Selecciona un análisis —</option>
              {analisisFechas.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            {pid && !loadingAnal && analisisFechas.length === 0 && (
              <p className="text-xs text-gray-400">Sin análisis generados para este paciente.</p>
            )}
          </div>
        )}

        {selected === 'reporte-atencion' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rango de sesiones</label>
            <select
              value={raOpt}
              onChange={e => { setRaOpt(e.target.value); setErrorRA('') }}
              disabled={loadingSes || !pid || sesiones.length === 0}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:opacity-50"
            >
              <option value="all">Todas las sesiones</option>
              {sesiones.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            {pid && !loadingSes && sesiones.length === 0 && (
              <p className="text-xs text-gray-400">Este paciente no tiene sesiones registradas.</p>
            )}
            {errorRA && <p className="text-xs text-red-500">{errorRA}</p>}
          </div>
        )}

        {/* Botón de impresión */}
        {!locked && (
          <button
            onClick={handlePrint}
            disabled={!canPrint() || loadingRA || !!printingId}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl
                       font-semibold text-sm hover:bg-primary-700 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {(loadingRA || printingId === selected) ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generando…</>
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

        {!pid && (
          <p className="text-xs text-gray-400">Selecciona un paciente en el panel izquierdo para continuar.</p>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      {/* Mensaje en móvil */}
      <div className="md:hidden flex flex-col items-center justify-center py-16 text-center px-6">
        <svg className="w-10 h-10 mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <p className="text-sm font-medium text-gray-500">En dispositivos móviles, usa el menú principal</p>
        <p className="text-xs text-gray-400 mt-1">☰ → Reportes terapéuticos</p>
      </div>

      {/* Layout desktop */}
      <div className="hidden md:flex gap-0 h-full -mt-8 -mb-8 -mr-8 ml-2">

        {/* ── Sidebar izquierdo ── */}
        <aside className="w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col h-screen sticky top-0 overflow-y-auto">

          {/* Header del sidebar */}
          <div className="px-4 pt-5 pb-4 border-b border-gray-100">
            <h1 className="text-base font-bold text-gray-800">🖨️ Reportes terapéuticos</h1>
          </div>

          {/* Selectores */}
          <div className="px-3 pt-4 space-y-4">
            {/* Paciente */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Paciente</label>
              <select
                value={pid}
                onChange={e => handlePacienteChange(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="">— Elige un paciente —</option>
                {pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            {/* Logo/encabezado — solo si hay empresas con logo */}
            {empresasConLogo.length >= 1 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Encabezado</label>
                <select
                  value={logoUrl ?? '__nombre__'}
                  onChange={e => setLogoUrl(e.target.value === '__nombre__' ? null : e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
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
          <div className="border-t border-gray-100 mx-3 my-3" />

          {/* AVI-Esencial */}
          <p className="text-[15px] font-semibold text-primary-600 uppercase tracking-widest px-2 pb-1.5">AVI-Esencial</p>
          {ESENCIAL_ITEMS.map(item => navItem(item.id, item.label))}

          {/* Separador */}
          <div className="border-t border-gray-100 mx-2 my-2.5" />

          {/* AVI-Clínico */}
          <div className="flex items-center gap-1.5 px-2 pb-1.5">
            <p className={`text-[15px] font-semibold uppercase tracking-widest ${!isClinico ? 'text-gray-300' : 'text-primary-600'}`}>AVI-Clínico</p>
            {!isClinico && <Lock size={10} className="text-gray-300" />}
          </div>
          {CLINICO_ITEMS.map(item => navItem(item.id, item.label, !isClinico))}
          {!isClinico && (
            <p className="text-[10px] text-gray-300 px-2 pt-1 pb-4 leading-relaxed">
              Disponible en plan Clínico
            </p>
          )}
        </aside>

        {/* ── Área de contenido ── */}
        <main className="flex-1 overflow-y-auto p-8">
          {renderContent()}
        </main>
      </div>
    </>
  )
}
