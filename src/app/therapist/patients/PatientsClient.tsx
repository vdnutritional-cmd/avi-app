'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Variable } from '@/lib/terminologia'
import type { Subcarpeta } from '@/lib/subcarpetas'

interface Patient {
  id: string
  full_name: string | null
  email: string | null
  is_active: boolean
  /** 'inactive' = bloqueado por inactividad · 'blocked' = bloqueado manualmente */
  status: string
  is_virtual:  boolean
  is_pro_bono: boolean
  subcarpeta_id: string | null
}

function ClasificacionBadges({ virtual: isVirtual, proBono }: { virtual: boolean; proBono: boolean }) {
  if (!isVirtual && !proBono) return null
  const etiquetas = [
    ...(isVirtual ? ['Virtual'] : []),
    ...(proBono   ? ['Pro-bono'] : []),
  ]
  return (
    <span className="text-xs font-normal" style={{ color: '#b243d5' }}>
      [{etiquetas.join(', ')}]
    </span>
  )
}

interface Props {
  activos: Patient[]
  bloqueados: Patient[]
  toggleAction: (formData: FormData) => Promise<void>
  /** SubCarpetas del terapeuta (privadas, src/lib/subcarpetas.ts) */
  subcarpetas: Subcarpeta[]
  w: Record<Variable, string>
}

const API_SUB = '/api/therapist/subcarpetas'

async function llamarSub(method: 'PUT', body: Record<string, unknown>) {
  const res = await fetch(API_SUB, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.error) throw new Error(json.error ?? 'No se pudo guardar.')
  return json
}

export default function PatientsClient({ activos, bloqueados, toggleAction, subcarpetas: subIniciales, w }: Props) {
  const [query, setQuery] = useState('')
  // SubCarpetas (7 nov 2026): lista, la de cada persona y el filtro ('' = todas, 'sin' = sin SubCarpeta)
  const subcarpetas = subIniciales
  const [subDe, setSubDe] = useState<Record<string, string | null>>(
    Object.fromEntries([...activos, ...bloqueados].map(p => [p.id, p.subcarpeta_id]))
  )
  const [filtroSub, setFiltroSub] = useState('')
  const [errSub, setErrSub] = useState('')

  async function moverA(patientId: string, subcarpetaId: string | null) {
    const anterior = subDe[patientId] ?? null
    setSubDe(prev => ({ ...prev, [patientId]: subcarpetaId })); setErrSub('')
    try { await llamarSub('PUT', { patient_id: patientId, subcarpeta_id: subcarpetaId }) }
    catch (e) { setSubDe(prev => ({ ...prev, [patientId]: anterior })); setErrSub(e instanceof Error ? e.message : 'No se pudo guardar.') }
  }

  const filtrar = (lista: Patient[]) => {
    if (filtroSub) lista = lista.filter(p => filtroSub === 'sin' ? !subDe[p.id] : subDe[p.id] === filtroSub)
    const q = query.toLowerCase().trim()
    if (!q) return lista
    const buscarVirtual  = 'virtual'.includes(q)
    const buscarProBono  = 'pro-bono'.includes(q) || 'probono'.includes(q) || 'pro bono'.includes(q)
    return lista.filter(p =>
      (p.full_name ?? '').toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q) ||
      (buscarVirtual  && p.is_virtual) ||
      (buscarProBono  && p.is_pro_bono)
    )
  }

  const activosFiltrados   = filtrar(activos)
  const bloqueadosFiltrados = filtrar(bloqueados)

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <div className="pt-2 pb-1">
        <h1 className="text-xl font-semibold text-gray-800">Mis {w.Users}</h1>
        <p className="text-sm text-gray-400">
          {activos.length} {activos.length !== 1 ? w.users : w.user} activo{activos.length !== 1 ? 's' : ''}
          {bloqueados.length > 0 && ` · ${bloqueados.length} bloqueado${bloqueados.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Buscador */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400
                     bg-white transition"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── SubCarpetas ── */}
      <SubCarpetasBarra
        subcarpetas={subcarpetas}
        conteo={id => [...activos, ...bloqueados].filter(p => id === 'sin' ? !subDe[p.id] : subDe[p.id] === id).length}
        total={activos.length + bloqueados.length}
        filtro={filtroSub} setFiltro={setFiltroSub} />
      {errSub && <p className="text-xs text-red-500">{errSub}</p>}

      {/* ── Activos ── */}
      {activosFiltrados.length === 0 && !query ? null : (
        <div className="space-y-2">
          {activosFiltrados.length === 0 && query ? (
            <p className="text-center py-4 text-sm text-gray-400">Sin resultados para &ldquo;{query}&rdquo;</p>
          ) : (
            activosFiltrados.map(p => (
              <div key={p.id}
                className="bg-white rounded-2xl border border-gray-100 px-5 py-4
                           hover:border-primary-200 hover:shadow-sm transition-all
                           flex items-center justify-between gap-3">
                <Link href={`/therapist/patients/${p.id}`} className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate flex items-center gap-2 flex-wrap">
                    {p.full_name ?? 'Sin nombre'}
                    <ClasificacionBadges virtual={p.is_virtual} proBono={p.is_pro_bono} />
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{p.email}</p>
                </Link>
                {subcarpetas.length > 0 && <SelectSub value={subDe[p.id] ?? null} subcarpetas={subcarpetas} onChange={v => moverA(p.id, v)} />}
                <form action={toggleAction}>
                  <input type="hidden" name="patientId"   value={p.id} />
                  <input type="hidden" name="nuevoEstado" value="false" />
                  <button type="submit"
                    onClick={e => {
                      if (!confirm(`¿Bloquear el acceso de ${p.full_name ?? p.email}?`)) e.preventDefault()
                    }}
                    className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5
                               hover:bg-red-50 transition-colors whitespace-nowrap">
                    🚫 Bloquear
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Bloqueados ── */}
      {bloqueadosFiltrados.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">
            Bloqueados
          </p>
          {bloqueadosFiltrados.map(p => (
            <div key={p.id}
              className="bg-gray-50 rounded-2xl border border-gray-100 px-5 py-4
                         flex items-center justify-between gap-3 opacity-70">
              <Link href={`/therapist/patients/${p.id}`} className="flex-1 min-w-0">
                <p className="font-medium text-gray-500 truncate flex items-center gap-2 flex-wrap">
                  {p.full_name ?? 'Sin nombre'}
                  <ClasificacionBadges virtual={p.is_virtual} proBono={p.is_pro_bono} />
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{p.email}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {p.status === 'inactive' ? 'Bloqueado por inactividad' : 'Bloqueado manualmente'}
                </p>
              </Link>
              {subcarpetas.length > 0 && <SelectSub value={subDe[p.id] ?? null} subcarpetas={subcarpetas} onChange={v => moverA(p.id, v)} />}
              <form action={toggleAction}>
                <input type="hidden" name="patientId"   value={p.id} />
                <input type="hidden" name="nuevoEstado" value="true" />
                <button type="submit"
                  className="text-xs text-green-600 border border-green-200 rounded-lg px-3 py-1.5
                             hover:bg-green-50 transition-colors whitespace-nowrap">
                  ✓ Reactivar
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SubCarpetas (7 nov 2026): privadas del terapeuta, un solo nivel ──────────
function SelectSub({ value, subcarpetas, onChange }: {
  value: string | null; subcarpetas: Subcarpeta[]; onChange: (v: string | null) => void
}) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value || null)} title="SubCarpeta"
      className="max-w-[130px] text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600
                 focus:outline-none focus:ring-1 focus:ring-primary-300">
      <option value="">📁 Sin SubCarpeta</option>
      {subcarpetas.map(s => <option key={s.id} value={s.id}>📁 {s.nombre}</option>)}
    </select>
  )
}

function SubCarpetasBarra({ subcarpetas, conteo, total, filtro, setFiltro }: {
  subcarpetas: Subcarpeta[]
  conteo: (id: string) => number; total: number
  filtro: string; setFiltro: (v: string) => void
}) {
  // Se crean y se renombran en Mis <users> › Crear SubCarpeta (/therapist/subcarpetas)
  if (subcarpetas.length === 0) return null
  const chip = (activo: boolean) => `text-xs px-2.5 py-1 rounded-full border transition-colors ${
    activo ? 'bg-primary-600 border-primary-600 text-white font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={() => setFiltro('')} className={chip(filtro === '')}>Todos ({total})</button>
      {subcarpetas.map(s => (
        <button key={s.id} onClick={() => setFiltro(filtro === s.id ? '' : s.id)} className={chip(filtro === s.id)}>
          📁 {s.nombre} ({conteo(s.id)})
        </button>
      ))}
      <button onClick={() => setFiltro(filtro === 'sin' ? '' : 'sin')} className={chip(filtro === 'sin')}>
        Sin SubCarpeta ({conteo('sin')})
      </button>
      <Link href="/therapist/subcarpetas" className="text-xs text-primary-600 hover:text-primary-800 px-1.5 py-1">⚙︎ SubCarpetas</Link>
    </div>
  )
}
