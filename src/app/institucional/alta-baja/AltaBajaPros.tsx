'use client'

// ─────────────────────────────────────────────────────────────
// Alta/Baja de <Pros> — la usan la Persona Institucional (User/Superuser) en
// Administración y el SaaS Controller en AVI Administración.
// Guarda vía /api/institucional/alta-baja y refresca los datos del servidor.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EmpresaAdministrada, ProAltaBaja, ProEnEmpresa } from './cargar-alta-baja'

type Palabras = { pro: string; Pro: string; pros: string; Pros: string; user: string; users: string }

const API = '/api/institucional/alta-baja'

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function enviar(method: 'POST' | 'DELETE', body: Record<string, string>) {
  const res = await fetch(API, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.error) throw new Error(json.error ?? 'No se pudo guardar.')
  return json
}

export default function AltaBajaPros({ empresas, pros, w }: { empresas: EmpresaAdministrada[]; pros: ProAltaBaja[]; w: Palabras }) {
  const router = useRouter()
  const [exito, setExito] = useState('')
  const [baja, setBaja] = useState<{ pro: ProAltaBaja; empresa: ProEnEmpresa } | null>(null)

  function listo(mensaje: string) {
    setExito(mensaje)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <AltaPorCorreo empresas={empresas} w={w} onListo={listo} />

      {exito && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 text-sm text-green-800 font-medium">✓ {exito}</div>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800">{w.Pros} registrados ({pros.length})</h2>
        {pros.length === 0
          ? <p className="text-sm text-gray-400">Aún no hay {w.pros} en tus empresas.</p>
          : pros.map(p => (
              <TarjetaPro key={p.therapistId} pro={p} empresas={empresas} w={w}
                onBaja={empresa => { setExito(''); setBaja({ pro: p, empresa }) }} onListo={listo} />
            ))}
      </section>

      <AvisoBaja w={w} />

      {baja && <ConfirmarBaja baja={baja} w={w} onCerrar={() => setBaja(null)} onListo={m => { setBaja(null); listo(m) }} />}
    </div>
  )
}

// ── Alta de un terapeuta que aún no está en la lista ─────────
function AltaPorCorreo({ empresas, w, onListo }: { empresas: EmpresaAdministrada[]; w: Palabras; onListo: (m: string) => void }) {
  const [email, setEmail] = useState('')
  const [empresaId, setEmpresaId] = useState(empresas.length === 1 ? empresas[0].id : '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function alta() {
    setSaving(true); setErr('')
    try {
      const json = await enviar('POST', { empresa_id: empresaId, email })
      const empresa = empresas.find(e => e.id === empresaId)?.nombre ?? ''
      setEmail('')
      onListo(`${json.nombre || email} quedó dado de alta en ${empresa}.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo dar de alta.')
    } finally { setSaving(false) }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <h2 className="text-base font-semibold text-gray-800">Dar de alta a un {w.pro}</h2>
      <p className="text-xs text-gray-500">
        Escribe el correo con el que el {w.pro} se registró en AVI. Al darlo de alta, entra a AVI con tu empresa
        y la empresa cubre su acceso.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="email" placeholder="correo@ejemplo.com" value={email}
          onChange={e => { setEmail(e.target.value); setErr('') }}
          className="flex-1 min-w-[220px] border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300" />
        {empresas.length > 1 && (
          <select value={empresaId} onChange={e => setEmpresaId(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300">
            <option value="" disabled>Empresa…</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        )}
        <button onClick={alta} disabled={saving || !email.trim() || !empresaId}
          className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          {saving ? 'Guardando…' : 'Dar de alta'}
        </button>
      </div>
      {err && <p className="text-red-500 text-xs">{err}</p>}
    </section>
  )
}

// ── Tarjeta de cada terapeuta (mismo diseño que SaaS Controller › Terapeutas) ──
function TarjetaPro({ pro, empresas, w, onBaja, onListo }: {
  pro: ProAltaBaja; empresas: EmpresaAdministrada[]; w: Palabras
  onBaja: (e: ProEnEmpresa) => void; onListo: (m: string) => void
}) {
  const disponibles = empresas.filter(e => !pro.empresas.some(x => x.empresaId === e.id))
  const [empresaId, setEmpresaId] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function agregar() {
    setSaving(true); setErr('')
    try {
      await enviar('POST', { empresa_id: empresaId, therapist_id: pro.therapistId })
      const empresa = empresas.find(e => e.id === empresaId)?.nombre ?? ''
      setEmpresaId('')
      onListo(`${pro.nombre} quedó dado de alta en ${empresa}.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo agregar.')
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-white border border-green-100 rounded-2xl p-5">
      <div className="grid grid-cols-1 md:grid-cols-3 items-baseline gap-x-4">
        <p className="font-medium text-gray-800">{pro.nombre}</p>
        <p className="text-sm text-gray-500 md:text-center truncate">{pro.email}</p>
      </div>

      <div className="mt-4 pt-3 border-t border-primary-300">
        <p className="text-sm font-normal text-primary-400 mb-1">Control de acceso con registro temporal</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {pro.empresas.map(e => (
            <span key={e.empresaId} className="inline-flex items-center gap-1.5 text-xs pl-2.5 pr-1 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
              🏢 {e.nombre} · {e.pacientes} {e.pacientes === 1 ? w.user : w.users} · desde {fmt(e.desde)}
              <button onClick={() => onBaja(e)} title={`Dar de baja de ${e.nombre}`}
                className="ml-0.5 w-5 h-5 rounded-full text-[11px] text-purple-400 hover:bg-red-100 hover:text-red-600 transition-colors">✕</button>
            </span>
          ))}
          {pro.otrasEmpresas > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200 font-medium">
              🏢 También en {pro.otrasEmpresas} {pro.otrasEmpresas === 1 ? 'empresa más' : 'empresas más'}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 border border-gray-200 font-medium">
            📝 Registro en AVI: {fmt(pro.registroAvi)}
          </span>
          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
            pro.ultimoAcceso ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
            🕐 {w.Pro}: {fmt(pro.ultimoAcceso)}
          </span>
          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
            pro.ultimaSesionPac ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
            📱 Últ. sesión {w.user}: {fmt(pro.ultimaSesionPac)}
          </span>
        </div>

        {disponibles.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <select value={empresaId} onChange={e => setEmpresaId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-300 text-gray-600">
              <option value="" disabled>+ Agregar empresa...</option>
              {disponibles.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <button onClick={agregar} disabled={saving || !empresaId}
              className="text-xs text-purple-600 border border-purple-200 rounded-lg px-2 py-1 hover:bg-purple-50 disabled:opacity-50 transition-colors">
              {saving ? 'Agregando…' : 'Agregar'}
            </button>
          </div>
        )}
        {err && <p className="text-red-500 text-xs mt-1">{err}</p>}
      </div>
    </div>
  )
}

// ── Baja de <Pros> ───────────────────────────────────────────
function AvisoBaja({ w }: { w: Palabras }) {
  return (
    <section className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-800 leading-relaxed">
      <h2 className="font-semibold mb-1">Baja de {w.Pros}</h2>
      <p className="text-amber-700 mb-2">Para dar de baja, toca la ✕ junto a la empresa en la tarjeta del {w.pro}.</p>
      <ul className="list-disc list-inside space-y-1 text-amber-700">
        <li>Si el {w.pro} tiene {w.users} activos en tu empresa, deberán ser transferidos a otro {w.pro}.</li>
        <li>Si lo das de baja por error, puedes volver a darlo de alta aquí mismo.</li>
        <li>Esta acción no elimina al {w.pro} de AVI, solo lo desvincula de tu empresa.</li>
      </ul>
    </section>
  )
}

function ConfirmarBaja({ baja, w, onCerrar, onListo }: {
  baja: { pro: ProAltaBaja; empresa: ProEnEmpresa }; w: Palabras
  onCerrar: () => void; onListo: (m: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const { pro, empresa } = baja

  async function confirmar() {
    setSaving(true); setErr('')
    try {
      await enviar('DELETE', { empresa_id: empresa.empresaId, therapist_id: pro.therapistId })
      onListo(`${pro.nombre} fue dado de baja de ${empresa.nombre}.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo dar de baja.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <h3 className="font-bold text-gray-800 text-base">¿Dar de baja a este {w.pro}?</h3>
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-1">
          <div><span className="text-gray-500">{w.Pro}:</span> <span className="font-semibold text-gray-800">{pro.nombre}</span></div>
          <div><span className="text-gray-500">Correo:</span> <span className="text-gray-700">{pro.email}</span></div>
          <div><span className="text-gray-500">Empresa:</span> <span className="text-gray-700">{empresa.nombre}</span></div>
          {empresa.pacientes > 0 && (
            <div className="mt-2 text-amber-700 font-medium">
              ⚠️ Tiene {empresa.pacientes} {empresa.pacientes === 1 ? `${w.user} activo` : `${w.users} activos`} en esta empresa. Deberán ser transferidos a otro {w.pro}.
            </div>
          )}
        </div>
        <p className="text-sm text-gray-600">
          Esta acción desvincula al {w.pro} de <strong>{empresa.nombre}</strong>. Si lo das de baja por error, puedes volver a darlo de alta aquí mismo.
        </p>
        {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onCerrar} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
            {saving ? 'Procesando…' : 'Confirmar baja'}
          </button>
        </div>
      </div>
    </div>
  )
}
