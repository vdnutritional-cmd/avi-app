'use client'

// ─────────────────────────────────────────────────────────────
// Configuración Admin — por empresa: terminología, enfoques terapéuticos, teléfono de contacto y logo.
// La usan la Persona Institucional (User/Superuser) en Administración y el
// SaaS Controller en AVI Administración. Guarda vía /api/institucional/empresa-config.
// ─────────────────────────────────────────────────────────────
import { useRef, useState } from 'react'
import { TERMINOLOGIA_OPCIONES, normalizarTerminologia, terminos, type Terminologia } from '@/lib/terminologia'
import { ENFOQUES_CATALOGO, TODOS_LOS_ENFOQUES, esEnfoque, type EnfoqueId } from '@/lib/enfoques'

export interface EmpresaConfig {
  id: string
  nombre: string
  terminologia: string | null
  telefono: string | null
  telefono_solicitudes: string | null
  logo_url: string | null
  enfoques_permitidos?: string[] | null
}

const API = '/api/institucional/empresa-config'

// Espacio del logo en los reportes impresos (buildReportHeader en print-utils.ts)
const REPORTE_ALTO  = 48
const REPORTE_ANCHO = 140

// ── Recorte automático de márgenes (18 oct 2026) ─────────────
// Canva y otros exportan el diseño completo con mucho espacio alrededor; en el
// recuadro del reporte (140 × 48) ese margen hace que el logo se vea diminuto.
// Se recorta en el navegador: fuera lo transparente y lo del color del fondo
// (el de la esquina), con un margen mínimo. Devuelve PNG (conserva transparencia).
interface Recorte { file: File; url: string; ancho: number; alto: number; anchoOriginal: number; altoOriginal: number; recortado: boolean }

const LADO_MAX = 1200   // más grande no aporta nitidez en un recuadro de 140 × 48

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => ok(img)
    img.onerror = () => mal(new Error('No se pudo leer la imagen.'))
    img.src = src
  })
}

async function recortarMargenes(src: string, nombre: string): Promise<Recorte> {
  const img = await cargarImagen(src)
  const W = img.naturalWidth, H = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, W, H)

  // Fondo = color de la esquina superior izquierda (o transparente)
  const [r0, g0, b0, a0] = [data[0], data[1], data[2], data[3]]
  const esFondo = (i: number) => {
    const a = data[i + 3]
    if (a < 16) return true
    if (a0 < 16) return false
    return Math.abs(data[i] - r0) < 24 && Math.abs(data[i + 1] - g0) < 24 && Math.abs(data[i + 2] - b0) < 24
  }
  // Solo si casi todo el borde es fondo: un logo ya recortado (su dibujo toca el borde) se deja igual
  let bordeFondo = 0, borde = 0
  for (let x = 0; x < W; x++) { borde += 2; if (esFondo(x * 4)) bordeFondo++; if (esFondo(((H - 1) * W + x) * 4)) bordeFondo++ }
  for (let y = 0; y < H; y++) { borde += 2; if (esFondo(y * W * 4)) bordeFondo++; if (esFondo((y * W + W - 1) * 4)) bordeFondo++ }
  const hayMargen = bordeFondo / borde >= 0.95

  let x0 = W, y0 = H, x1 = -1, y1 = -1
  if (!hayMargen) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1 }
  else for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!esFondo((y * W + x) * 4)) {
        if (x < x0) x0 = x; if (x > x1) x1 = x
        if (y < y0) y0 = y; if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) throw new Error('La imagen está vacía (solo fondo).')

  // Margen mínimo: 2 % del alto del logo
  const m = hayMargen ? Math.round((y1 - y0 + 1) * 0.02) : 0
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m)
  x1 = Math.min(W - 1, x1 + m); y1 = Math.min(H - 1, y1 + m)
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1
  const recortado = cw < W - 2 || ch < H - 2

  const escala = Math.min(1, LADO_MAX / Math.max(cw, ch))
  const out = document.createElement('canvas')
  out.width = Math.round(cw * escala); out.height = Math.round(ch * escala)
  const octx = out.getContext('2d')!
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(canvas, x0, y0, cw, ch, 0, 0, out.width, out.height)
  const blob: Blob = await new Promise((ok, mal) => out.toBlob(b => b ? ok(b) : mal(new Error('No se pudo preparar el logo.')), 'image/png'))
  const file = new File([blob], nombre.replace(/\.[a-z]+$/i, '') + '.png', { type: 'image/png' })
  return { file, url: URL.createObjectURL(file), ancho: out.width, alto: out.height, anchoOriginal: W, altoOriginal: H, recortado }
}

function avisosDeTamano(ancho: number, alto: number): string[] {
  const avisos: string[] = []
  const proporcion = ancho / alto
  if (alto < 96) avisos.push(`Es chico (${ancho} × ${alto} px): puede verse borroso al imprimir.`)
  if (proporcion < 1.5) avisos.push('Es vertical o cuadrado: en los reportes se verá pequeño. Lo ideal es un logo horizontal.')
  else if (proporcion > 4) avisos.push('Es muy alargado: en los reportes se verá delgado.')
  return avisos
}

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
  // Palabra de esta empresa (Inventario de Terminología, página 12): cambia en cuanto se elige otra
  const [terminologia, setTerminologia] = useState<Terminologia>(normalizarTerminologia(empresa.terminologia))
  const w = terminos(terminologia)
  return (
    <details open={abierta} className="group bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none hover:bg-gray-50">
        <span className="font-semibold text-primary-700">{empresa.nombre}</span>
        <svg className="w-3.5 h-3.5 text-gray-500 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-5 pb-5 space-y-5 border-t border-gray-100 pt-4">
        <TerminologiaEmpresa empresa={empresa} actual={terminologia} setActual={setTerminologia} />
        <EnfoquesEmpresa empresa={empresa} w={w} />
        <TelefonoEmpresa empresa={empresa} campo="telefono" titulo="Teléfono de contacto"
          explicacion={'Lo ve la persona en la bienvenida de AVI ("Para cualquier otro apoyo, contacta a…") y AVI lo usa en el chat para invitarla a llamar.'} />
        <TelefonoEmpresa empresa={empresa} campo="telefono_solicitudes" titulo="WhatsApp para solicitudes de alta"
          explicacion={`Debe tener WhatsApp. Ahí te llegan las solicitudes de los ${w.pros} que quieren participar en tu empresa (botón "Solicita acceso a la empresa" de Planes y precios). Después los das de alta en Alta/Baja.`} />
        <LogoEmpresa empresa={empresa} w={w} />
      </div>
    </details>
  )
}

// ── Terminología ─────────────────────────────────────────────
function TerminologiaEmpresa({ empresa, actual, setActual }: {
  empresa: EmpresaConfig; actual: Terminologia; setActual: (t: Terminologia) => void
}) {
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

// ── Enfoques terapéuticos autorizados (27 oct 2026) ─────────
// El <pro> sin plan pagado personal solo ve en Configuración › Enfoque terapéutico los que
// autoricen sus empresas, y elige hasta 2 (src/lib/enfoques-permitidos.ts).
function EnfoquesEmpresa({ empresa, w }: { empresa: EmpresaConfig; w: ReturnType<typeof terminos> }) {
  const inicial = (empresa.enfoques_permitidos ?? TODOS_LOS_ENFOQUES).filter(esEnfoque)
  const [guardado, setGuardado] = useState<EnfoqueId[]>(inicial)
  const [marcados, setMarcados] = useState<EnfoqueId[]>(inicial)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const cambiado = marcados.length !== guardado.length || marcados.some(id => !guardado.includes(id))
  const quitados = guardado.filter(id => !marcados.includes(id))

  function toggle(id: EnfoqueId) {
    setMarcados(prev => prev.includes(id) ? prev.filter(x => x !== id) : TODOS_LOS_ENFOQUES.filter(x => x === id || prev.includes(x)))
    setErr(''); setOk('')
  }

  async function guardar() {
    if (marcados.length === 0) { setErr('Marca al menos un enfoque terapéutico.'); return }
    if (quitados.length && !confirm(
      `A los ${w.pros} de ${empresa.nombre} que usan ${quitados.map(id => ENFOQUES_CATALOGO.find(e => e.id === id)!.label).join(' y ')} se les quitará de su configuración, salvo que otra de sus empresas o su plan personal lo autorice. ¿Continuar?`
    )) return
    setSaving(true); setErr(''); setOk('')
    try {
      const json = await enviar({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresa_id: empresa.id, enfoques_permitidos: marcados }) })
      setGuardado(marcados)
      setOk(json.terapeutasAjustados
        ? `✓ Guardado. Se ajustó el enfoque de ${json.terapeutasAjustados} ${json.terapeutasAjustados === 1 ? w.pro : w.pros}.`
        : '✓ Guardado')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally { setSaving(false) }
  }

  return (
    <section className="space-y-2 border-t border-gray-100 pt-4">
      <h3 className="text-sm font-semibold text-gray-800">Enfoques terapéuticos</h3>
      <p className="text-xs text-gray-500 leading-relaxed">
        Los que marques son los que verán los {w.pros} de esta empresa en Configuración › Enfoque terapéutico;
        de ellos cada uno elige hasta 2. Quien paga su propio plan en AVI puede elegir entre todos.
      </p>
      <div className="space-y-1.5">
        {ENFOQUES_CATALOGO.map(e => (
          <label key={e.id} className={`flex items-center gap-2 text-sm ${saving ? 'opacity-50' : 'cursor-pointer'}`}>
            <input type="checkbox" checked={marcados.includes(e.id)} disabled={saving}
              onChange={() => toggle(e.id)} className="accent-purple-700" />
            <span className="text-gray-800">{e.icon} {e.label}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={guardar} disabled={saving || !cambiado || marcados.length === 0}
          className="text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-3 py-1.5 rounded-lg transition-colors">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {marcados.length === 0 && <span className="text-xs text-amber-600">Marca al menos uno</span>}
        {ok && !cambiado && <span className="text-xs text-green-600">{ok}</span>}
      </div>
      {err && <p className="text-red-500 text-xs">{err}</p>}
    </section>
  )
}

// ── Teléfonos (contacto del paciente y WhatsApp de solicitudes) ──
function TelefonoEmpresa({ empresa, campo, titulo, explicacion }: {
  empresa: EmpresaConfig; campo: 'telefono' | 'telefono_solicitudes'; titulo: string; explicacion: string
}) {
  const [guardado, setGuardado] = useState(empresa[campo] ?? '')
  const [valor, setValor] = useState(empresa[campo] ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const cambiado = valor.trim() !== guardado

  async function guardar() {
    setSaving(true); setErr(''); setOk(false)
    try {
      await enviar({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresa_id: empresa.id, [campo]: valor }) })
      setGuardado(valor.trim()); setValor(valor.trim()); setOk(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally { setSaving(false) }
  }

  return (
    <section className="space-y-2 border-t border-gray-100 pt-4">
      <h3 className="text-sm font-semibold text-gray-800">{titulo}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{explicacion}</p>
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

function LogoEmpresa({ empresa, w }: { empresa: EmpresaConfig; w: ReturnType<typeof terminos> }) {
  const [logoUrl, setLogoUrl] = useState(empresa.logo_url)
  const [nuevo, setNuevo] = useState<{ file: File; url: string; avisos: string[]; nota?: string } | null>(null)
  const [preparando, setPreparando] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Recorta los márgenes y deja la vista previa lista para "Guardar este logo"
  async function preparar(src: string, nombre: string, deLogoActual: boolean) {
    setErr(''); setPreparando(true)
    try {
      const r = await recortarMargenes(src, nombre)
      if (r.file.size > 2 * 1024 * 1024) { URL.revokeObjectURL(r.url); setErr('El logo recortado supera 2 MB.'); return }
      if (deLogoActual && !r.recortado) { URL.revokeObjectURL(r.url); setErr('El logo actual ya no tiene márgenes que quitar.'); return }
      const nota = r.recortado
        ? `✂︎ Se quitó el espacio vacío alrededor: de ${r.anchoOriginal} × ${r.altoOriginal} px a ${r.ancho} × ${r.alto} px.`
        : undefined
      setNuevo({ file: r.file, url: r.url, avisos: avisosDeTamano(r.ancho, r.alto), nota })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo leer la imagen.')
    } finally { setPreparando(false) }
  }

  function elegir(file: File) {
    setErr('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setErr('Solo PNG, JPG o WebP.'); return }
    if (file.size > 10 * 1024 * 1024) { setErr('El archivo no debe superar 10 MB.'); return }
    const url = URL.createObjectURL(file)
    preparar(url, file.name, false).finally(() => URL.revokeObjectURL(url))
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
    if (!confirm(`¿Quitar el logo de ${empresa.nombre}? Los reportes saldrán con el nombre del ${w.pro}.`)) return
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
        Sale en el encabezado de los reportes impresos de los {w.pros} de esta empresa.
        Para que se vea bien: <strong>horizontal</strong>, de preferencia PNG con fondo transparente. PNG, JPG o WebP. <strong>AVI quita sola el espacio en blanco alrededor</strong>
        (por ejemplo, el de los diseños de Canva) para que se vea grande.
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

      {nuevo?.nota && <p className="text-xs text-green-700">{nuevo.nota}</p>}
      {nuevo?.avisos.map(a => <p key={a} className="text-xs text-amber-700">⚠️ {a}</p>)}
      {preparando && <p className="text-xs text-gray-600">Preparando el logo…</p>}

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
            <button onClick={() => fileRef.current?.click()} disabled={saving || preparando}
              className="text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-3 py-1.5 rounded-lg transition-colors">
              {logoUrl ? '↑ Cambiar logo' : '↑ Subir logo'}
            </button>
            {logoUrl && (
              <button onClick={() => preparar(logoUrl, 'logo', true)} disabled={saving || preparando}
                className="text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-3 py-1.5 rounded-lg transition-colors">
                ✂︎ Quitar márgenes al logo actual
              </button>
            )}
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
