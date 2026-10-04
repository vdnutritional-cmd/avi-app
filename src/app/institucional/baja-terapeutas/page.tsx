'use client'

// ─────────────────────────────────────────────────────────────
// /institucional/baja-terapeutas
// Solo accesible para Personas Institucionales N1/N2.
// Muestra los terapeutas de la empresa y permite darlos de baja.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface EmpresaPI {
  empresaId: string
  empresaNombre: string
  nivel: 'N1' | 'N2'
}

interface TerapeutaItem {
  therapistId: string
  nombre: string
  email: string
  pacientesActivos: number
}

interface Confirmacion {
  terapeuta: TerapeutaItem
  empresaId: string
  empresaNombre: string
}

export default function BajaTerapeutasPage() {
  const [empresas,     setEmpresas]     = useState<EmpresaPI[]>([])
  const [terapeutas,   setTerapeutas]   = useState<Record<string, TerapeutaItem[]>>({})
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null)
  const [ejecutando,   setEjecutando]   = useState(false)
  const [exito,        setExito]        = useState('')

  // Cargar empresas N1/N2 del PI actual
  useEffect(() => {
    async function cargar() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('No autenticado'); return }

        const { data: piRows } = await supabase
          .from('convenio_personas_institucionales')
          .select('empresa_id, nivel, convenio_empresas(nombre)')
          .eq('therapist_id', user.id)
          .eq('is_active', true)
          .in('nivel', ['N1', 'N2'])

        if (!piRows || piRows.length === 0) {
          setError('No tienes permiso para acceder a esta sección (requiere nivel N1 o N2).')
          return
        }

        const listaEmpresas: EmpresaPI[] = piRows.map((r: any) => ({
          empresaId:     r.empresa_id,
          empresaNombre: r.convenio_empresas?.nombre ?? r.empresa_id,
          nivel:         r.nivel as 'N1' | 'N2',
        }))
        setEmpresas(listaEmpresas)

        // Cargar terapeutas para cada empresa
        const mapTerapeutas: Record<string, TerapeutaItem[]> = {}
        await Promise.all(
          listaEmpresas.map(async (emp) => {
            const res = await fetch(`/api/institucional/baja-terapeuta?empresa_id=${emp.empresaId}`)
            const json = await res.json()
            mapTerapeutas[emp.empresaId] = json.terapeutas ?? []
          })
        )
        setTerapeutas(mapTerapeutas)
      } catch (e) {
        setError('Error al cargar los datos.')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const recargarEmpresa = useCallback(async (empresaId: string) => {
    const res = await fetch(`/api/institucional/baja-terapeuta?empresa_id=${empresaId}`)
    const json = await res.json()
    setTerapeutas(prev => ({ ...prev, [empresaId]: json.terapeutas ?? [] }))
  }, [])

  async function ejecutarBaja() {
    if (!confirmacion) return
    setEjecutando(true)
    setExito('')
    try {
      const res = await fetch('/api/institucional/baja-terapeuta', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapistId: confirmacion.terapeuta.therapistId,
          empresaId:   confirmacion.empresaId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al dar de baja')

      setExito(`${confirmacion.terapeuta.nombre} fue dado de baja de ${confirmacion.empresaNombre} correctamente.`)
      setConfirmacion(null)
      await recargarEmpresa(confirmacion.empresaId)
    } catch (e: any) {
      setError(e.message ?? 'Error al dar de baja')
    } finally {
      setEjecutando(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-primary-700">Baja de Terapeutas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Puedes dar de baja a un terapeuta de tu empresa. Solo el administrador de AVI podrá reactivarlo.
        </p>
      </div>

      {/* Aviso informativo */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-800 leading-relaxed">
        <div className="font-semibold mb-1">⚠️ Importante antes de dar de baja</div>
        <ul className="list-disc list-inside space-y-1 text-amber-700">
          <li>Si el terapeuta tiene pacientes activos en tu empresa, deberán ser transferidos antes de que el proceso quede completo.</li>
          <li>La reactivación del terapeuta solo la puede hacer el administrador de AVI.</li>
          <li>Esta acción no elimina al terapeuta de AVI, solo lo desvincula de tu empresa.</li>
        </ul>
      </div>

      {/* Estado de carga / error */}
      {loading && (
        <p className="text-sm text-gray-400 animate-pulse">Cargando terapeutas…</p>
      )}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Mensaje de éxito */}
      {exito && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 text-sm text-green-800 font-medium">
          ✓ {exito}
        </div>
      )}

      {/* Bloques por empresa */}
      {!loading && empresas.map((emp) => {
        const lista = terapeutas[emp.empresaId] ?? []
        return (
          <div key={emp.empresaId} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {/* Header de empresa */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <h2 className="font-semibold text-gray-700 text-sm flex-1">{emp.empresaNombre}</h2>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                emp.nivel === 'N1'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {emp.nivel}
              </span>
            </div>

            {lista.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">
                No hay terapeutas registrados en esta empresa.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Terapeuta</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Correo</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pac. activos</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lista.map((t) => (
                    <tr key={t.therapistId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-gray-800">{t.nombre}</td>
                      <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell">{t.email}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm
                          ${t.pacientesActivos > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                          {t.pacientesActivos}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setConfirmacion({ terapeuta: t, empresaId: emp.empresaId, empresaNombre: emp.empresaNombre })}
                          className="text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50
                                     px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-300
                                     transition-colors whitespace-nowrap"
                        >
                          Dar de baja
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

      {/* Modal de confirmación */}
      {confirmacion && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-gray-800 text-base">¿Dar de baja a este terapeuta?</h3>

            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-1">
              <div><span className="text-gray-500">Terapeuta:</span>{' '}
                <span className="font-semibold text-gray-800">{confirmacion.terapeuta.nombre}</span>
              </div>
              <div><span className="text-gray-500">Correo:</span>{' '}
                <span className="text-gray-700">{confirmacion.terapeuta.email}</span>
              </div>
              <div><span className="text-gray-500">Empresa:</span>{' '}
                <span className="text-gray-700">{confirmacion.empresaNombre}</span>
              </div>
              {confirmacion.terapeuta.pacientesActivos > 0 && (
                <div className="mt-2 text-amber-700 font-medium">
                  ⚠️ Este terapeuta tiene {confirmacion.terapeuta.pacientesActivos} paciente{confirmacion.terapeuta.pacientesActivos !== 1 ? 's' : ''} activo{confirmacion.terapeuta.pacientesActivos !== 1 ? 's' : ''} en esta empresa.
                  Deberán ser transferidos a otro terapeuta.
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600">
              Esta acción desvincula al terapeuta de <strong>{confirmacion.empresaNombre}</strong>.
              Solo el administrador de AVI podrá reactivarlo.
            </p>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setConfirmacion(null); setError('') }}
                disabled={ejecutando}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium
                           text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarBaja}
                disabled={ejecutando}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold
                           hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {ejecutando ? 'Procesando…' : 'Confirmar baja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
