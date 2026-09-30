'use client'

// ─────────────────────────────────────────────────────────────
// /admin/convenio-empresas — Gestión de Empresas en CONVENIO
// El admin registra las empresas que aparecen en el dropdown
// de la sección "Paquetes en CONVENIO" de /pricing
// Sprint 10 (XII): agrega upload de logo por empresa
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface Empresa {
  id: string
  nombre: string
  is_active: boolean
  logo_url: string | null
  created_at: string
}

const BUCKET = 'empresa-logos'

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Logo uploader sub-component ────────────────────────────
function LogoUploader({ empresa, onUpdated }: { empresa: Empresa; onUpdated: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [err, setErr]             = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    setErr('')
    if (file.size > 2 * 1024 * 1024) {
      setErr('El archivo no debe superar 2 MB.')
      return
    }
    const allowed = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowed.includes(file.type)) {
      setErr('Solo PNG, JPG o WebP.')
      return
    }

    setUploading(true)
    try {
      const supabase = getSupabase()
      const ext  = file.name.split('.').pop()
      const path = `${empresa.id}/logo.${ext}`

      // Upsert into Storage (overwrite if exists)
      const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type })

      if (storageErr) throw storageErr

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

      // Cache-bust the URL
      const urlWithBust = `${publicUrl}?t=${Date.now()}`

      // Persist URL to DB via API
      const res = await fetch('/api/admin/convenio-empresas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
    setDeleting(true)
    setErr('')
    try {
      const supabase = getSupabase()

      // Remove all possible extensions from storage
      const exts = ['png', 'jpg', 'jpeg', 'webp']
      for (const ext of exts) {
        await supabase.storage.from(BUCKET).remove([`${empresa.id}/logo.${ext}`])
      }

      // Clear URL in DB
      await fetch('/api/admin/convenio-empresas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: empresa.id, logo_url: null }),
      })

      onUpdated()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al eliminar logo.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
      {/* Current logo preview */}
      {empresa.logo_url ? (
        <div className="flex items-center gap-4">
          <div className="border border-gray-200 rounded-lg p-2 bg-gray-50 flex items-center justify-center" style={{ width: 200, height: 80 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={empresa.logo_url}
              alt={`Logo de ${empresa.nombre}`}
              style={{ maxWidth: 200, maxHeight: 80, objectFit: 'contain' }}
            />
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Eliminando…' : '✕ Eliminar logo'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">Sin logo cargado.</p>
      )}

      {/* Upload control */}
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          {uploading ? 'Subiendo…' : empresa.logo_url ? '↑ Cambiar logo' : '↑ Subir logo'}
        </button>
        <span className="text-xs text-gray-400">PNG, JPG o WebP · máx 2 MB · min 300×120 px</span>
      </div>

      {err && <p className="text-red-500 text-xs">{err}</p>}
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
    setSaving(true)
    setError('')
    const res  = await fetch('/api/admin/convenio-empresas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setNombre('')
      await fetchEmpresas()
    }
    setSaving(false)
  }

  async function toggleActive(id: string, is_active: boolean) {
    await fetch('/api/admin/convenio-empresas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
          Puedes cargar el logo de cada empresa para que aparezca en los reportes terapéuticos.
        </p>
      </div>

      {/* ── Agregar empresa ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Agregar empresa</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Nombre de la empresa"
            value={nombre}
            onChange={e => { setNombre(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && addEmpresa()}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button
            onClick={addEmpresa}
            disabled={saving || !nombre.trim()}
            className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
          >
            {saving ? 'Guardando…' : '+ Agregar'}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>

      {/* ── Empresas activas ── */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Activas ({activas.length})
        </h2>
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
                  <button
                    onClick={() => toggleActive(e.id, false)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Desactivar
                  </button>
                </div>
                <LogoUploader empresa={e} onUpdated={fetchEmpresas} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Empresas inactivas ── */}
      {inactivas.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Inactivas ({inactivas.length})
          </h2>
          <div className="space-y-2">
            {inactivas.map(e => (
              <div key={e.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 opacity-60">
                <span className="text-sm text-gray-500">{e.nombre}</span>
                <button
                  onClick={() => toggleActive(e.id, true)}
                  className="text-xs text-purple-500 hover:text-purple-700 transition-colors"
                >
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
