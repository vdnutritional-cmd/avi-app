'use client'

// Crear SubCarpeta: alta, cambio de nombre y baja de SubCarpetas, y en cuál está cada persona.
// Guarda vía /api/therapist/subcarpetas (src/lib/subcarpetas.ts).
import { useState } from 'react'
import type { Variable } from '@/lib/terminologia'
import type { Subcarpeta } from '@/lib/subcarpetas'

interface Persona { id: string; nombre: string; email: string; activo: boolean; subcarpeta_id: string | null }

const API = '/api/therapist/subcarpetas'

async function llamar(method: 'POST' | 'PATCH' | 'DELETE' | 'PUT', body: Record<string, unknown>) {
  const res = await fetch(API, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.error) throw new Error(json.error ?? 'No se pudo guardar.')
  return json
}

export default function SubcarpetasClient({ subcarpetas: iniciales, personas, w }: {
  subcarpetas: Subcarpeta[]; personas: Persona[]; w: Record<Variable, string>
}) {
  const [subcarpetas, setSubcarpetas] = useState<Subcarpeta[]>(iniciales)
  const [subDe, setSubDe] = useState<Record<string, string | null>>(Object.fromEntries(personas.map(p => [p.id, p.subcarpeta_id])))
  const [nuevo, setNuevo] = useState('')
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [guardando, setGuardando] = useState<Record<string, boolean>>({})
  const [err, setErr] = useState('')
  const [filtro, setFiltro] = useState('')   // '' = todas · id · 'sin'

  const ordenar = (l: Subcarpeta[]) => [...l].sort((a, b) => a.nombre.localeCompare(b.nombre))
  const conteo = (id: string) => personas.filter(p => id === 'sin' ? !subDe[p.id] : subDe[p.id] === id).length

  async function hacer(fn: () => Promise<void>) {
    setSaving(true); setErr('')
    try { await fn() } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo guardar.') } finally { setSaving(false) }
  }
  const crear = () => hacer(async () => {
    const json = await llamar('POST', { nombre: nuevo })
    setSubcarpetas(prev => ordenar([...prev, json.subcarpeta])); setNuevo('')
  })
  const renombrar = () => hacer(async () => {
    if (!editando) return
    const json = await llamar('PATCH', editando)
    setSubcarpetas(prev => ordenar(prev.map(s => s.id === editando.id ? { ...s, nombre: json.nombre } : s))); setEditando(null)
  })
  function eliminar(s: Subcarpeta) {
    const n = conteo(s.id)
    if (!confirm(`¿Eliminar la SubCarpeta "${s.nombre}"?${n ? ` Sus ${n} ${n === 1 ? w.user : w.users} quedarán sin SubCarpeta.` : ''}`)) return
    hacer(async () => {
      await llamar('DELETE', { id: s.id })
      setSubcarpetas(prev => prev.filter(x => x.id !== s.id))
      setSubDe(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, v === s.id ? null : v])))
      if (filtro === s.id) setFiltro('')
    })
  }

  async function mover(patientId: string, subcarpetaId: string | null) {
    const anterior = subDe[patientId] ?? null
    setSubDe(prev => ({ ...prev, [patientId]: subcarpetaId }))
    setGuardando(prev => ({ ...prev, [patientId]: true })); setErr('')
    try { await llamar('PUT', { patient_id: patientId, subcarpeta_id: subcarpetaId }) }
    catch (e) { setSubDe(prev => ({ ...prev, [patientId]: anterior })); setErr(e instanceof Error ? e.message : 'No se pudo guardar.') }
    finally { setGuardando(prev => ({ ...prev, [patientId]: false })) }
  }

  const visibles = filtro ? personas.filter(p => filtro === 'sin' ? !subDe[p.id] : subDe[p.id] === filtro) : personas
  const inputCls = 'text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300'
  const chip = (activo: boolean) => `text-xs px-2.5 py-1 rounded-full border transition-colors ${
    activo ? 'bg-primary-600 border-primary-600 text-white font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`

  return (
    <div className="space-y-6">
      {/* ── Mis SubCarpetas ── */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Mis SubCarpetas</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input value={nuevo} maxLength={60} placeholder="Nombre de la SubCarpeta nueva" className={`${inputCls} flex-1 min-w-[200px]`}
            onChange={e => { setNuevo(e.target.value); setErr('') }}
            onKeyDown={e => e.key === 'Enter' && nuevo.trim() && crear()} />
          <button onClick={crear} disabled={saving || !nuevo.trim()}
            className="text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl">
            + Crear SubCarpeta
          </button>
        </div>
        {subcarpetas.length === 0
          ? <p className="text-sm text-gray-400">Aún no tienes SubCarpetas.</p>
          : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
              {subcarpetas.map(s => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  {editando?.id === s.id ? (
                    <>
                      <input value={editando.nombre} maxLength={60} autoFocus className={`${inputCls} flex-1 min-w-[160px] py-1.5`}
                        onChange={e => setEditando({ id: s.id, nombre: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') renombrar(); if (e.key === 'Escape') setEditando(null) }} />
                      <button onClick={renombrar} disabled={saving || !editando.nombre.trim()}
                        className="text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-3 py-1.5 rounded-lg">Guardar</button>
                      <button onClick={() => setEditando(null)} className="text-xs text-gray-500 px-1">Cancelar</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-medium text-gray-700">📁 {s.nombre}</span>
                      <span className="text-xs text-gray-500">{conteo(s.id)} {conteo(s.id) === 1 ? w.user : w.users}</span>
                      <button onClick={() => { setErr(''); setEditando({ id: s.id, nombre: s.nombre }) }} disabled={saving}
                        className="text-xs text-primary-600 hover:text-primary-800 px-1.5">Renombrar</button>
                      <button onClick={() => eliminar(s)} disabled={saving} title="Eliminar"
                        className="text-xs text-red-400 hover:text-red-600 px-1.5">✕</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        {err && <p className="text-xs text-red-500">{err}</p>}
      </section>

      {/* ── En qué SubCarpeta está cada persona ── */}
      {subcarpetas.length > 0 && personas.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setFiltro('')} className={chip(filtro === '')}>Todos ({personas.length})</button>
            {subcarpetas.map(s => (
              <button key={s.id} onClick={() => setFiltro(filtro === s.id ? '' : s.id)} className={chip(filtro === s.id)}>
                📁 {s.nombre} ({conteo(s.id)})
              </button>
            ))}
            <button onClick={() => setFiltro(filtro === 'sin' ? '' : 'sin')} className={chip(filtro === 'sin')}>Sin SubCarpeta ({conteo('sin')})</button>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{w.User}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Correo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SubCarpeta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibles.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {p.nombre}{!p.activo && <span className="ml-2 text-xs font-normal text-gray-400">(bloqueado)</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-500 hidden sm:table-cell">{p.email}</td>
                    <td className="px-5 py-2.5">
                      <select value={subDe[p.id] ?? ''} disabled={guardando[p.id]} onChange={e => mover(p.id, e.target.value || null)}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white text-gray-700
                                   focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:opacity-50 disabled:cursor-wait">
                        <option value="">Sin SubCarpeta</option>
                        {subcarpetas.map(s => <option key={s.id} value={s.id}>📁 {s.nombre}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {personas.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aún no tienes {w.users} registrados.</p>}
    </div>
  )
}
