'use client'

import { useState } from 'react'
import Link from 'next/link'

type Preview = {
  origen:  { email: string; tieneNotaInicial: boolean; fechaNota: string | null }
  destino: { email: string; tieneNotaInicial: boolean; fechaNota: string | null }
  sesionesPresenciales: number
  advertencias: string[]
}

type Paso = 'formulario' | 'preview' | 'exito'

export default function FusionarPacientePage() {
  const [emailOrigen, setEmailOrigen]   = useState('')
  const [emailDestino, setEmailDestino] = useState('')
  const [preview, setPreview]           = useState<Preview | null>(null)
  const [paso, setPaso]                 = useState<Paso>('formulario')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  async function verPreview() {
    setError('')
    setLoading(true)
    const res = await fetch(
      `/api/therapist/fusionar-paciente?emailOrigen=${encodeURIComponent(emailOrigen)}&emailDestino=${encodeURIComponent(emailDestino)}`
    )
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) {
      setError(data.error ?? 'Error al obtener vista previa')
      return
    }
    setPreview(data.preview)
    setPaso('preview')
  }

  async function confirmar() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/therapist/fusionar-paciente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrigen, emailDestino }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) {
      setError(data.error ?? 'Error al ejecutar la fusión')
      return
    }
    setPaso('exito')
  }

  function reiniciar() {
    setEmailOrigen('')
    setEmailDestino('')
    setPreview(null)
    setError('')
    setPaso('formulario')
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-8 space-y-6">

      {/* Cabecera */}
      <div>
        <Link href="/therapist/patients" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          ← Mis pacientes
        </Link>
        <h1 className="mt-3 text-xl font-bold text-gray-900">Fusionar cuentas de paciente</h1>
        <p className="mt-1 text-sm text-gray-500">
          Copia la nota inicial y las sesiones presenciales de una cuenta temporal a la cuenta real del paciente.
          La cuenta temporal quedará archivada y dejará de aparecer en tu lista.
        </p>
      </div>

      {/* ── Paso 1: formulario ── */}
      {paso === 'formulario' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Correo de la cuenta <span className="text-amber-600 font-semibold">temporal</span>
              <span className="text-xs font-normal text-gray-400 ml-1">(la que creaste tú)</span>
            </label>
            <input
              type="email"
              value={emailOrigen}
              onChange={e => { setEmailOrigen(e.target.value); setError('') }}
              placeholder="cuenta.temporal@ejemplo.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <div className="flex items-center gap-3 text-gray-300">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xl">↓</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Correo de la cuenta <span className="text-green-600 font-semibold">real del paciente</span>
              <span className="text-xs font-normal text-gray-400 ml-1">(la que creó el paciente)</span>
            </label>
            <input
              type="email"
              value={emailDestino}
              onChange={e => { setEmailDestino(e.target.value); setError('') }}
              placeholder="correo.real@paciente.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
          )}

          <button
            onClick={verPreview}
            disabled={loading || !emailOrigen.trim() || !emailDestino.trim()}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Verificando…' : 'Ver vista previa →'}
          </button>
        </div>
      )}

      {/* ── Paso 2: preview ── */}
      {paso === 'preview' && preview && (
        <div className="space-y-4">
          {/* Qué se copiará */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Resumen de la fusión</h2>

            {/* Origen → Destino */}
            <div className="flex items-start gap-3">
              <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-0.5">CUENTA TEMPORAL (origen)</p>
                <p className="text-sm text-gray-700 truncate">{preview.origen.email}</p>
                <div className="mt-2 space-y-1 text-xs text-gray-500">
                  {preview.origen.tieneNotaInicial
                    ? <p>✓ Nota inicial {preview.origen.fechaNota ? `del ${new Date(preview.origen.fechaNota).toLocaleDateString('es-MX')}` : ''}</p>
                    : <p className="text-gray-400">Sin nota inicial</p>
                  }
                  <p>✓ {preview.sesionesPresenciales} sesión{preview.sesionesPresenciales !== 1 ? 'es' : ''} presencial{preview.sesionesPresenciales !== 1 ? 'es' : ''}</p>
                </div>
              </div>
              <div className="flex items-center pt-8 text-gray-400 text-xl">→</div>
              <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-green-700 mb-0.5">CUENTA REAL (destino)</p>
                <p className="text-sm text-gray-700 truncate">{preview.destino.email}</p>
                <div className="mt-2 space-y-1 text-xs text-gray-500">
                  {preview.destino.tieneNotaInicial
                    ? <p className="text-amber-600">Ya tiene nota inicial — se conservará la existente</p>
                    : <p className="text-green-600">Recibirá la nota inicial</p>
                  }
                  <p className="text-green-600">Recibirá las sesiones presenciales</p>
                </div>
              </div>
            </div>

            {/* Advertencias */}
            {preview.advertencias.length > 0 && (
              <div className="space-y-1">
                {preview.advertencias.map((adv, i) => (
                  <p key={i} className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                    ⚠️ {adv}
                  </p>
                ))}
              </div>
            )}

            {/* Qué pasará con la temporal */}
            <p className="text-xs text-gray-400 border-t border-gray-50 pt-3">
              Después de la fusión, la cuenta <strong>{preview.origen.email}</strong> quedará archivada y desaparecerá de tu lista de pacientes activos.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={reiniciar}
              className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              ← Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={loading}
              className="flex-1 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Procesando…' : '✓ Confirmar fusión'}
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 3: éxito ── */}
      {paso === 'exito' && (
        <div className="bg-white rounded-2xl border border-green-100 p-8 shadow-sm text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h2 className="text-lg font-bold text-gray-800">¡Fusión completada!</h2>
          <p className="text-sm text-gray-500">
            La nota inicial y las sesiones presenciales de <strong>{emailOrigen}</strong> fueron copiadas a la cuenta de <strong>{emailDestino}</strong>.
            La cuenta temporal quedó archivada.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Link
              href="/therapist/patients"
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              Ir a Mis pacientes
            </Link>
            <button
              onClick={reiniciar}
              className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Fusionar otra cuenta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
