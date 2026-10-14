'use client'

// ─────────────────────────────────────────────────────────────
// Configuración Admin — por empresa: terminología, teléfono de contacto y logo.
// La usan la Persona Institucional (User/Superuser) en Administración y el
// SaaS Controller en AVI Administración. Guarda vía /api/institucional/empresa-config.
// ─────────────────────────────────────────────────────────────
import { useRef, useState } from 'react'
import { TERMINOLOGIA_OPCIONES, normalizarTerminologia, type Terminologia } from '@/lib/terminologia'

export interface EmpresaConfig {
  id: string
  nombre: string
  terminologia: string | null
  telefono: string | null
  logo_url: string | null
}

const API = '/api/institucional/empresa-config'

// Espacio del logo en los reportes impresos (buildReportHeader en print-utils.ts)
const REPORTE_ALTO  = 48
const REPORTE_ANCHO = 140
// Medida recomendada: 2.5 : 1, al triple del alto impreso para que se vea nítido
const RECOMENDADO = { ancho: 360, alto: 144 }

async function enviar(init: RequestInit, query = '') {
  const res  = await fetch(`${API}${query}`, init)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.error) throw new Error(json.error ?? 'No se pudo guardar.')
  return json
}

export default function ConfiguracionEmpresas({ empresas }: { empresas: EmpresaConfig[] }) {
  if (empresas.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No hay empresas para configurar.</p>
  }
  return (
    <div className="space-y-3">
      {empresas.map(e => <TarjetaEmpresa key={e.id} empresa={e} abierta={empresas.length === 1} />)}
    </div>
  )
}

function TarjetaEmpresa({ empresa, abierta }: { empresa: EmpresaConfig; abierta: boolean }) {
  return (
    <details open={abierta} className="group bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none hover:bg-gray-50">
        <span className="font-semibold text-primary-700">{empresa.nombre}</span>
        <svg className="w-3.5 h-3.5 text-gray-500 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-5 pb-5 space-y-5 border-t border-gray-100 pt-4">
        <TerminologiaEmpresa empresa={empresa} />
        <TelefonoEmpresa empresa={empresa} />
        <LogoEmpresa empresa={empresa} />
      </div>
    </details>
  )
}

// ── Terminología ─────────────────────────────────────────────
function TerminologiaEmpresa({ empresa }: { empresa: EmpresaConfig }) {
  const [actual, setActual] = useState<Terminologia>(normalizarTerminologia(empresa.terminologia))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function cambiar(valor: Terminologia) {
    if (valor === actual) return
    const anterior = actual
    setActual(valor); setSaving(true); setErr('')
    try {
      await enviar({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresa_id: empresa.id, terminologia: valor }) })
    } catch (e) {
      setActual(anterior)
      setErr(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally { setSaving(false) }
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-800">Terminología</h3>
      <p className="text-xs text-gray-500 leading-relaxed">
        Cómo se nombra en AVI a las personas que atienden esta empresa y a quien atiende.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {TERMINOLOGIA_OPCIONES.map(o => (
          <label key={o.valor} className={`flex items-center gap-2 text-sm ${saving ? 'opacity-50' : 'cursor-pointer'}`}>
            <input type="radio" name={`terminologia-${empresa.id}`} checked={actual === o.valor} disabled={saving}
              onChange={() => cambiar(o.valor)} className="accent-purple-700" />
            <span className="font-medium text-gray-800">{o.nombre}</span>
            <span className="text-xs text-gray-400">({o.ejemplo})</span>
          </label>
        ))}
        {saving && <span className="text-xs text-gray-400">Guardando…</span>}
      </div>
      {err && <p className="text-red-500 text-xs">{err}</p>}
    </section>
  )
}

// ── Teléfono de contacto ─────────────────────────────────────
function TelefonoEmpresa({ empresa }: { empresa: EmpresaConfig }) {
  const [guardado, setGuardado] = useState(empresa.telefono ?? '')
  const [valor, setValor] = useState(empresa.telefono ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const cambiado = valor.trim() !== guardado

  async function guardar() {
    setSaving(true); setErr(''); setOk(false)
    try {
      await enviar({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresa_id: empresa.id, telefono: valor }) })
      setGuardado(valor.trim()); setValor(valor.trim()); setOk(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally { setSaving(false) }
  }

  return (
    <section className="space-y-2 border-t border-gray-100 pt-4">
      <h3 className="text-sm font-semibold text-gray-800">Teléfono de contacto</h3>
      <p className="text-xs text-gray-500 leading-relaxed">
        Lo ve la persona en la bienvenida de AVI (&quot;Para cualquier otro apoyo, contacta a…&quot;) y AVI lo usa en el chat para invitarla a llamar.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="tel" placeholder="Ej. 33 1363 0266" value={valor}
          onChange={e => { setValor(e.target.value); setErr(''); setOk(false) }}
          onKeyDown={e => e.key === 'Enter' && cambiado && guardar()}
          className="w-56 border border-gray-300 rounded-xl px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300" />
        <button onClick={guardar} disabled={saving || !cambiado}
          className="text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-3 py-1.5 rounded-lg transition-colors">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {ok && !cambiado && <span className="text-xs text-green-600">✓ Guardado</span>}
        {!guardado && !cambiado && <span className="text-xs text-amber-600">Sin teléfono capturado</span>}
      </div>
      {err && <p className="text-red-500 text-xs">{err}</p>}
    </section>
  )
}

// ── Logo ─────────────────────────────────────────────────────
function MarcoReporte({ src }: { src: string | null }) {
  // Mismo espacio que ocupa el logo en el encabezado de los reportes impresos
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="border border-dashed border-gray-300 bg-white flex items-center justify-end"
        style={{ width: REPORTE_ANCHO + 2, height: REPORTE_ALTO + 2 }}>
        {src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt="Logo" style={{ height: REPORTE_ALTO, maxWidth: REPORTE_ANCHO, objectFit: 'contain' }} />
          : <span className="text-[10px] text-gray-400 w-full text-center">Sin logo</span>}
      </div>
      <span className="text-[10px] text-gray-400">Tamaño real en los reportes</span>
    </div>
  )
}

function LogoEmpresa({ empresa }: { empresa: EmpresaConfig }) {
  const [logoUrl, setLogoUrl] = useState(empresa.logo_url)
  const [nuevo, setNuevo] = useState<{ file: File; url: string; avisos: string[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function elegir(file: File) {
    setErr('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setErr('Solo PNG, JPG o WebP.'); return }
    if (file.size > 2 * 1024 * 1024) { setErr('El archivo no debe superar 2 MB.'); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const avisos: string[] = []
      const proporcion = img.naturalWidth / img.naturalHeight
      if (img.naturalHeight < 96) avisos.push(`Es chico (${img.naturalWidth} × ${img.naturalHeight} px): puede verse borroso al imprimir.`)
      if (proporcion < 1.5) avisos.push('Es vertical o cuadrado: en los reportes se verá pequeño. Lo ideal es un logo horizontal.')
      else if (proporcion > 4) avisos.push('Es muy alargado: en los reportes se verá delgado.')
      setNuevo({ file, url, avisos })
    }
    img.onerror = () => setErr('No se pudo leer la imagen.')
    img.src = url
  }

  function cancelar() {
    if (nuevo) URL.revokeObjectURL(nuevo.url)
    setNuevo(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function subir() {
    if (!nuevo) return
    setSaving(true); setErr('')
    try {
      const form = new FormData()
      form.append('empresa_id', empresa.id)
      form.append('file', nuevo.file)
      const json = await enviar({ method: 'POST', body: form })
      setLogoUrl(json.logo_url)
      cancelar()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo subir el logo.')
    } finally { setSaving(false) }
  }

  async function quitar() {
    if (!confirm(`¿Quitar el logo de ${empresa.nombre}? Los reportes saldrán con el nombre del terapeuta.`)) return
    setSaving(true); setErr('')
    try {
      await enviar({ method: 'DELETE' }, `?empresa_id=${encodeURIComponent(empresa.id)}`)
      setLogoUrl(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo quitar el logo.')
    } finally { setSaving(false) }
  }

  return (
    <section className="space-y-3 border-t border-gray-100 pt-4">
      <h3 className="text-sm font-semibold text-gray-800">Logo</h3>
      <p className="text-xs text-gray-500 leading-relaxed">
        Sale en el encabezado de los reportes impresos de los terapeutas de esta empresa.
        Para que se vea bien: <strong>horizontal, de {RECOMENDADO.ancho} × {RECOMENDADO.alto} px</strong> (proporción 2.5 : 1),
        recortado sin espacio en blanco alrededor, de preferencia PNG con fondo transparente. PNG, JPG o WebP, máximo 2 MB.
      </p>

      <div className="flex flex-wrap items-end gap-6">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">{nuevo ? 'Logo actual' : 'Así sale hoy'}</p>
          <MarcoReporte src={logoUrl} />
        </div>
        {nuevo && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-primary-700">Logo nuevo (vista previa)</p>
            <MarcoReporte src={nuevo.url} />
          </div>
        )}
      </div>

      {nuevo?.avisos.map(a => <p key={a} className="text-xs text-amber-700">⚠️ {a}</p>)}

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) elegir(f) }} />
        {nuevo ? (
          <>
            <button onClick={subir} disabled={saving}
              className="text-xs bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors">
              {saving ? 'Subiendo…' : 'Guardar este logo'}
            </button>
            <button onClick={cancelar} disabled={saving} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancelar</button>
          </>
        ) : (
          <>
            <button onClick={() => fileRef.current?.click()} disabled={saving}
              className="text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-3 py-1.5 rounded-lg transition-colors">
              {logoUrl ? '↑ Cambiar logo' : '↑ Subir logo'}
            </button>
            {logoUrl && (
              <button onClick={quitar} disabled={saving} className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 px-2">
                ✕ Quitar logo
              </button>
            )}
          </>
        )}
      </div>
      {err && <p className="text-red-500 text-xs">{err}</p>}
    </section>
  )
}
