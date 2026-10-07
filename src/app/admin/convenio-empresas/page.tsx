'use client'

// ─────────────────────────────────────────────────────────────
// /admin/convenio-empresas — Gestión de Empresas en CONVENIO
// Sprint 10: logo upload por empresa
// Sprint 11: Personas Institucionales por empresa
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { NIVEL_LABELS } from '@/lib/niveles-institucionales'

interface Empresa {
  id: string
  nombre: string
  is_active: boolean
  logo_url: string | null
  telefono: string | null
  created_at: string
}

interface PersonaInstitucional {
  id: string
  empresa_id: string
  therapist_id: string
  nivel: 'N1' | 'N2' | 'N3'
  opera_como_terapeuta: boolean
  is_active: boolean
  nombre: string
  email: string
}

interface Terapeuta {
  id: string
  nombre: string
  email: string
}

const BUCKET = 'empresa-logos'
// Accesos por nivel en Administración Institucional — ver src/lib/niveles-institucionales.ts
const NIVEL_COLORS: Record<string, string> = {
  N1: 'bg-green-100 text-green-700 border-green-200',
  N2: 'bg-blue-100  text-blue-700  border-blue-200',
  N3: 'bg-amber-100 text-amber-700 border-amber-200',
}

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Logo uploader ────────────────────────────────────────────
function LogoUploader({ empresa, onUpdated }: { empresa: Empresa; onUpdated: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [err, setErr]             = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    setErr('')
    if (file.size > 2 * 1024 * 1024) { setErr('El archivo no debe superar 2 MB.'); return }
    const allowed = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowed.includes(file.type)) { setErr('Solo PNG, JPG o WebP.'); return }

    setUploading(true)
    try {
      const supabase = getSupabase()
      const ext  = file.name.split('.').pop()
      const path = `${empresa.id}/logo.${ext}`
      const { error: storageErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type })
      if (storageErr) throw storageErr
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
      const urlWithBust = `${publicUrl}?t=${Date.now()}`
      const res = await fetch('/api/admin/convenio-empresas', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: empresa.id, logo_url: urlWithBust }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      onUpdated()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al subir logo.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDelete() {
    if (!empresa.logo_url) return
    setDeleting(true); setErr('')
    try {
      const supabase = getSupabase()
      const exts = ['png', 'jpg', 'jpeg', 'webp']
      for (const ext of exts) await supabase.storage.from(BUCKET).remove([`${empresa.id}/logo.${ext}`])
      await fetch('/api/admin/convenio-empresas', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: empresa.id, logo_url: null }),
      })
      onUpdated()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al eliminar logo.')
    } finally { setDeleting(false) }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
      {empresa.logo_url ? (
        <div className="flex items-center gap-4">
          <div className="border border-gray-200 rounded-lg p-2 bg-gray-50 flex items-center justify-center" style={{ width: 200, height: 80 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={empresa.logo_url} alt={`Logo de ${empresa.nombre}`} style={{ maxWidth: 200, maxHeight: 80, objectFit: 'contain' }} />
          </div>
          <button onClick={handleDelete} disabled={deleting} className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors">
            {deleting ? 'Eliminando…' : '✕ Eliminar logo'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">Sin logo cargado.</p>
      )}
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-3 py-1.5 rounded-lg transition-colors">
          {uploading ? 'Subiendo…' : empresa.logo_url ? '↑ Cambiar logo' : '↑ Subir logo'}
        </button>
        <span className="text-xs text-gray-400">PNG, JPG o WebP · máx 2 MB · min 300×120 px</span>
      </div>
      {err && <p className="text-red-500 text-xs">{err}</p>}
    </div>
  )
}

// ── Teléfono de contacto (se muestra al paciente en la bienvenida) ──
function TelefonoEditor({ empresa, onUpdated }: { empresa: Empresa; onUpdated: () => void }) {
  const [valor,  setValor]  = useState(empresa.telefono ?? '')
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')
  const cambiado = valor.trim() !== (empresa.telefono ?? '')

  async function guardar() {
    setSaving(true); setErr('')
    try {
      const res  = await fetch('/api/admin/convenio-empresas', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: empresa.id, telefono: valor }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      onUpdated()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al guardar teléfono.')
    } finally { setSaving(false) }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-1">
      <label className="text-xs text-gray-500 block">Teléfono de contacto (lo ve el paciente en la bienvenida)</label>
      <div className="flex items-center gap-2">
        <input
          type="tel" placeholder="Ej. 33 1363 0266" value={valor}
          onChange={e => { setValor(e.target.value); setErr('') }}
          onKeyDown={e => e.key === 'Enter' && cambiado && guardar()}
          className="w-56 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
        <button
          onClick={guardar} disabled={saving || !cambiado}
          className="text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {!empresa.telefono && <span className="text-xs text-amber-600">Sin teléfono capturado</span>}
      </div>
      {err && <p className="text-red-500 text-xs">{err}</p>}
    </div>
  )
}

// ── Personas Institucionales por empresa ─────────────────────
function PersonasInstitucionales({ empresa }: { empresa: Empresa }) {
  const [open,       setOpen]       = useState(false)
  const [personas,   setPersonas]   = useState<PersonaInstitucional[]>([])
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([])
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')

  // Form de alta
  const [selectedTherapistId, setSelectedTherapistId] = useState('')
  const [nivel,    setNivel]    = useState<'N1' | 'N2' | 'N3'>('N2')
  const [opera,    setOpera]    = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [personasRes, terapeutasRes] = await Promise.all([
      fetch(`/api/admin/personas-institucionales?empresa_id=${empresa.id}`).then(r => r.json()),
      fetch(`/api/admin/terapeutas-empresa?empresa_id=${empresa.id}`).then(r => r.json()),
    ])
    setPersonas(personasRes.personas ?? [])
    setTerapeutas(terapeutasRes.terapeutas ?? [])
    setLoading(false)
  }, [empresa.id])

  useEffect(() => { if (open) loadData() }, [open, loadData])

  // Terapeutas disponibles (no registrados aún como personas institucionales)
  const idsRegistrados = new Set(personas.map(p => p.therapist_id))
  const disponibles = terapeutas.filter(t => !idsRegistrados.has(t.id))

  async function agregar() {
    if (!selectedTherapistId) { setErr('Selecciona un terapeuta.'); return }
    setSaving(true); setErr('')
    const res = await fetch('/api/admin/personas-institucionales', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa_id: empresa.id, therapist_id: selectedTherapistId, nivel, opera_como_terapeuta: opera }),
    })
    const data = await res.json()
    if (data.error) { setErr(data.error) }
    else { setSelectedTherapistId(''); await loadData() }
    setSaving(false)
  }

  async function cambiarNivel(id: string, nuevoNivel: string) {
    await fetch('/api/admin/personas-institucionales', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, nivel: nuevoNivel }),
    })
    await loadData()
  }

  async function toggleOpera(id: string, opera_como_terapeuta: boolean) {
    await fetch('/api/admin/personas-institucionales', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, opera_como_terapeuta }),
    })
    await loadData()
  }

  async function toggleActivo(id: string, is_active: boolean) {
    await fetch('/api/admin/personas-institucionales', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active }),
    })
    await loadData()
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta persona institucional?')) return
    await fetch('/api/admin/personas-institucionales', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await loadData()
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-900 transition-colors"
      >
        <span>{open ? '▾' : '▸'}</span>
        Personas Institucionales
        {!open && personas.length === 0 && <span className="text-xs text-gray-400 font-normal">(sin registrar)</span>}
        {!open && personas.length > 0 && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">{personas.length}/5</span>}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {loading ? (
            <p className="text-xs text-gray-400">Cargando…</p>
          ) : (
            <>
              {/* Lista de personas */}
              {personas.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Sin personas institucionales registradas.</p>
              ) : (
                <div className="space-y-2">
                  {personas.map(p => (
                    <div key={p.id} className={`rounded-xl border px-3 py-2.5 space-y-2 ${p.is_active ? 'border-indigo-100 bg-indigo-50/40' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                          <p className="text-xs text-gray-400 truncate">{p.email}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-semibold border px-2 py-0.5 rounded-full ${NIVEL_COLORS[p.nivel]}`}>
                          {p.nivel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/60">
                        {/* Cambiar nivel */}
                        <select
                          value={p.nivel}
                          onChange={e => cambiarNivel(p.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        >
                          {Object.entries(NIVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>

                        {/* Toggle opera como terapeuta */}
                        <button
                          onClick={() => toggleOpera(p.id, !p.opera_como_terapeuta)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${p.opera_como_terapeuta ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                        >
                          {p.opera_como_terapeuta ? '✓ Opera como terapeuta' : '✕ Sin panel terapeuta'}
                        </button>

                        <div className="ml-auto flex gap-2">
                          <button
                            onClick={() => toggleActivo(p.id, !p.is_active)}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {p.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            onClick={() => eliminar(p.id)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulario de alta */}
              {personas.length < 5 && (
                <div className="bg-white border border-indigo-100 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                    Agregar persona ({personas.length}/5)
                  </p>

                  {disponibles.length === 0 && terapeutas.length > 0 ? (
                    <p className="text-xs text-gray-400 italic">Todos los terapeutas de esta empresa ya son personas institucionales.</p>
                  ) : terapeutas.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Esta empresa no tiene terapeutas asignados. Asígnalos desde el panel de Terapeutas.</p>
                  ) : (
                    <>
                      <select
                        value={selectedTherapistId}
                        onChange={e => setSelectedTherapistId(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        <option value="">— Seleccionar terapeuta —</option>
                        {disponibles.map(t => (
                          <option key={t.id} value={t.id}>{t.nombre} ({t.email})</option>
                        ))}
                      </select>

                      <div className="flex flex-wrap gap-3 items-center">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Nivel</label>
                          <select
                            value={nivel}
                            onChange={e => setNivel(e.target.value as 'N1' | 'N2' | 'N3')}
                            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          >
                            {Object.entries(NIVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs text-gray-500 block mb-1">¿Opera como terapeuta?</label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setOpera(true)}
                              className={`text-sm px-3 py-2 rounded-xl border transition-colors ${opera ? 'bg-green-50 border-green-300 text-green-700 font-medium' : 'border-gray-200 text-gray-400'}`}
                            >Sí</button>
                            <button
                              onClick={() => setOpera(false)}
                              className={`text-sm px-3 py-2 rounded-xl border transition-colors ${!opera ? 'bg-red-50 border-red-300 text-red-700 font-medium' : 'border-gray-200 text-gray-400'}`}
                            >No</button>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={agregar}
                        disabled={saving || !selectedTherapistId}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                      >
                        {saving ? 'Guardando…' : '+ Agregar persona institucional'}
                      </button>
                    </>
                  )}

                  {err && <p className="text-red-500 text-xs">{err}</p>}
                </div>
              )}

              {personas.length >= 5 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  Límite de 5 personas institucionales alcanzado para esta empresa.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────
export default function ConvenioEmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [nombre,  setNombre]    = useState('')
  const [error,   setError]     = useState('')

  const fetchEmpresas = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/admin/convenio-empresas')
    const data = await res.json()
    setEmpresas(data.empresas ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchEmpresas() }, [fetchEmpresas])

  async function addEmpresa() {
    if (!nombre.trim()) return
    setSaving(true); setError('')
    const res  = await fetch('/api/admin/convenio-empresas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    })
    const data = await res.json()
    if (data.error) { setError(data.error) }
    else { setNombre(''); await fetchEmpresas() }
    setSaving(false)
  }

  async function toggleActive(id: string, is_active: boolean) {
    await fetch('/api/admin/convenio-empresas', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active }),
    })
    await fetchEmpresas()
  }

  const activas   = empresas.filter(e => e.is_active)
  const inactivas = empresas.filter(e => !e.is_active)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Empresas en CONVENIO</h1>
        <p className="text-sm text-gray-500 mt-1">
          Las empresas activas aparecen en el dropdown de "Paquetes en CONVENIO" en la página de precios.
          Puedes cargar el logo de cada empresa y registrar sus personas institucionales.
        </p>
      </div>

      {/* ── Agregar empresa ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Agregar empresa</h2>
        <div className="flex gap-3">
          <input
            type="text" placeholder="Nombre de la empresa" value={nombre}
            onChange={e => { setNombre(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && addEmpresa()}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button
            onClick={addEmpresa} disabled={saving || !nombre.trim()}
            className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
          >
            {saving ? 'Guardando…' : '+ Agregar'}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>

      {/* ── Empresas activas ── */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Activas ({activas.length})</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Cargando…</p>
        ) : activas.length === 0 ? (
          <p className="text-sm text-gray-400">Sin empresas registradas aún.</p>
        ) : (
          <div className="space-y-3">
            {activas.map(e => (
              <div key={e.id} className="bg-white border border-purple-100 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{e.nombre}</span>
                  <button onClick={() => toggleActive(e.id, false)} className="text-xs text-red-400 hover:text-red-600 transition-colors">
                    Desactivar
                  </button>
                </div>
                <TelefonoEditor empresa={e} onUpdated={fetchEmpresas} />
                <LogoUploader empresa={e} onUpdated={fetchEmpresas} />
                <PersonasInstitucionales empresa={e} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Empresas inactivas ── */}
      {inactivas.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Inactivas ({inactivas.length})</h2>
          <div className="space-y-2">
            {inactivas.map(e => (
              <div key={e.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 opacity-60">
                <span className="text-sm text-gray-500">{e.nombre}</span>
                <button onClick={() => toggleActive(e.id, true)} className="text-xs text-purple-500 hover:text-purple-700 transition-colors">
                  Reactivar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
