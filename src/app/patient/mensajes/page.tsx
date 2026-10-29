'use client'

// Mensajes de mi terapeuta (27 oct 2026): solo para leer, no se contestan.
// Al abrir uno se marca como leído; ?id=… lo abre directo (desde la pantalla de inicio de Habla,
// con "← Regresar" para volver a ella).
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { terminos, normalizarTerminologia, type Terminologia } from '@/lib/terminologia'

interface Mensaje {
  id: string
  asunto: string
  mensaje: string
  created_at: string
  leido_at: string | null
}

// useSearchParams necesita Suspense en Next 16
export default function MensajesPage() {
  return <Suspense fallback={null}><Mensajes /></Suspense>
}

function Mensajes() {
  const params = useSearchParams()
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null)
  const [terminologia, setTerminologia] = useState<Terminologia | null>(null)
  const [abierto, setAbierto] = useState<string | null>(params.get('id'))
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/patient/mensajes')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => {
        setMensajes(j.mensajes)
        setTerminologia(normalizarTerminologia(j.terminologia))
      })
      .catch(() => setError(true))
  }, [])

  // Marcar como leído al abrirlo
  useEffect(() => {
    if (!abierto || !mensajes) return
    const m = mensajes.find(x => x.id === abierto)
    if (!m || m.leido_at) return
    setMensajes(ms => ms!.map(x => x.id === abierto ? { ...x, leido_at: new Date().toISOString() } : x))
    fetch('/api/patient/mensajes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: abierto }),
    }).then(() => window.dispatchEvent(new CustomEvent('avi:mensajesLeidos'))).catch(() => {})
  }, [abierto, mensajes])

  if (error) {
    return <p className="p-6 text-center text-sm text-red-600">No se pudieron cargar tus mensajes. Revisa tu conexión e intenta de nuevo.</p>
  }
  if (!mensajes || !terminologia) {
    return <p className="p-6 text-center text-sm text-gray-400">Cargando mensajes…</p>
  }

  const { pro } = terminos(terminologia)
  const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {params.get('id') && (
        <Link href="/patient/chat" className="text-sm text-primary-600 hover:underline">← Regresar</Link>
      )}
      <div>
        <h1 className="text-lg font-semibold text-gray-800">Mensajes de tu {pro}</h1>
        <p className="text-xs text-gray-500 mt-1">Información que tu {pro} te envía. Son solo para leer; no se contestan por aquí.</p>
      </div>

      {mensajes.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-10">Aún no tienes mensajes.</p>
      )}

      <div className="space-y-2">
        {mensajes.map(m => {
          const esAbierto = abierto === m.id
          const nuevo = !m.leido_at
          return (
            <div key={m.id} className={`rounded-2xl border bg-white overflow-hidden ${nuevo ? 'border-indigo-300' : 'border-gray-100'}`}>
              <button
                onClick={() => setAbierto(esAbierto ? null : m.id)}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className={`text-sm truncate ${nuevo ? 'font-semibold text-indigo-800' : 'font-medium text-gray-800'}`}>{m.asunto}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fecha(m.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {nuevo && <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-lg font-medium">Nuevo</span>}
                  <span className="text-gray-400 text-sm">{esAbierto ? '▲' : '▼'}</span>
                </div>
              </button>
              {esAbierto && (
                <div className="border-t border-gray-100 px-4 py-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{m.mensaje}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
