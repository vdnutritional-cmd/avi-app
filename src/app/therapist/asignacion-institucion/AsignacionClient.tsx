'use client'

import { useState, useTransition } from 'react'
import type { Variable } from '@/lib/terminologia'

interface Empresa {
  id: string
  nombre: string
}

interface Paciente {
  patient_id: string
  nombre: string
  email: string
  empresa_id: string | null
  centro_id: string | null
}

interface Centro { id: string; empresa_id: string; nombre: string }

interface Props {
  pacientes: Paciente[]
  empresas: Empresa[]
  /** Empresas de sus personas a las que el terapeuta no pertenece (id → nombre) */
  otrasEmpresas: Record<string, string>
  /** CentrosAtención activos del terapeuta (7 nov 2026) */
  centros: Centro[]
  /** CentrosAtención de sus personas en los que el terapeuta ya no está (id → nombre) */
  otrosCentros: Record<string, string>
  w: Record<Variable, string>
}

export default function AsignacionClient({ pacientes, empresas, otrasEmpresas, centros, otrosCentros, w }: Props) {
  const [assignments, setAssignments] = useState<Record<string, string | null>>(
    Object.fromEntries(pacientes.map(p => [p.patient_id, p.empresa_id]))
  )
  const [centroDe, setCentroDe] = useState<Record<string, string | null>>(
    Object.fromEntries(pacientes.map(p => [p.patient_id, p.centro_id]))
  )
  const hayCentros = centros.length > 0 || Object.keys(otrosCentros).length > 0
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  async function handleChange(patientId: string, cambio: { empresa_id: string | null } | { centro_id: string | null }) {
    if ('empresa_id' in cambio) setAssignments(prev => ({ ...prev, [patientId]: cambio.empresa_id }))
    else setCentroDe(prev => ({ ...prev, [patientId]: cambio.centro_id }))
    setSaving(prev => ({ ...prev, [patientId]: true }))
    setSaved(prev => ({ ...prev, [patientId]: false }))
    setErrors(prev => ({ ...prev, [patientId]: '' }))

    try {
      const res = await fetch('/api/therapist/paciente-empresa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, ...cambio }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrors(prev => ({ ...prev, [patientId]: data.error ?? 'Error al guardar' }))
      } else {
        // Al cambiar de empresa, el servidor pone el CentroAtención que le toca
        if ('centro_id' in data) setCentroDe(prev => ({ ...prev, [patientId]: data.centro_id }))
        startTransition(() => {
          setSaved(prev => ({ ...prev, [patientId]: true }))
          setTimeout(() => setSaved(prev => ({ ...prev, [patientId]: false })), 2000)
        })
      }
    } catch {
      setErrors(prev => ({ ...prev, [patientId]: 'Error de red' }))
    } finally {
      setSaving(prev => ({ ...prev, [patientId]: false }))
    }
  }

  if (pacientes.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No tienes {w.users} activos registrados.
      </p>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{w.User}</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Correo</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Institución asignada</th>
            {hayCentros && <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">CentroAtención</th>}
            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {pacientes.map(p => (
            <tr key={p.patient_id} className="hover:bg-gray-50 transition-colors">
              <td className="px-5 py-3.5 font-medium text-gray-800">{p.nombre}</td>
              <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell">{p.email}</td>
              <td className="px-5 py-3">
                <select
                  value={assignments[p.patient_id] ?? ''}
                  disabled={saving[p.patient_id]}
                  onChange={e => handleChange(p.patient_id, { empresa_id: e.target.value || null })}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-1.5
                             bg-white text-gray-700 focus:outline-none focus:ring-2
                             focus:ring-primary-300 disabled:opacity-50 disabled:cursor-wait"
                >
                  <option value="">Sin asignar</option>
                  {empresas.map(e => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                  {/* Su empresa actual, aunque el terapeuta no pertenezca a ella (solo se puede quitar) */}
                  {p.empresa_id && otrasEmpresas[p.empresa_id] && (
                    <option value={p.empresa_id}>{otrasEmpresas[p.empresa_id]} (no perteneces a esta empresa)</option>
                  )}
                </select>
                {errors[p.patient_id] && (
                  <p className="text-xs text-red-500 mt-1">{errors[p.patient_id]}</p>
                )}
              </td>
              {hayCentros && (() => {
                const empresaId = assignments[p.patient_id]
                const propios = centros.filter(c => c.empresa_id === empresaId)
                const actual = centroDe[p.patient_id]
                const ajeno = actual && !propios.some(c => c.id === actual) ? otrosCentros[actual] : null
                if (!empresaId || (propios.length === 0 && !ajeno)) {
                  return <td className="px-5 py-3 text-xs text-gray-300">—</td>
                }
                return (
                  <td className="px-5 py-3">
                    <select
                      value={actual ?? ''}
                      disabled={saving[p.patient_id]}
                      onChange={e => handleChange(p.patient_id, { centro_id: e.target.value || null })}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-1.5
                                 bg-white text-gray-700 focus:outline-none focus:ring-2
                                 focus:ring-primary-300 disabled:opacity-50 disabled:cursor-wait"
                    >
                      <option value="">Sin CentroAtención</option>
                      {propios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      {ajeno && <option value={actual!}>{ajeno} (no estás en este CentroAtención)</option>}
                    </select>
                  </td>
                )
              })()}
              <td className="px-3 py-3.5 text-center w-12">
                {saving[p.patient_id] && (
                  <span className="text-xs text-gray-400">⏳</span>
                )}
                {saved[p.patient_id] && (
                  <span className="text-xs text-green-500">✓</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
