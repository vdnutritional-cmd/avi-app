'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Paciente = { id: string; nombre: string; email: string }

type Preview = {
  paciente:  { id: string; nombre: string; email: string }
  receptor:  { id: string; nombre: string; email: string }
  resumen:   { sesionesPresenciales: number; analisis: number; tieneExpediente: boolean }
}

type Paso = 'formulario' | 'preview' | 'exito'

export default function TransferirPacientePage() {
  const [pacientes,      setPacientes]      = useState<Paciente[]>([])
  const [pacienteId,     setPacienteId]     = useState('')
  const [emailReceptor,  setEmailReceptor]  = useState('')
  const [modalidad,      setModalidad]      = useState<'completo' | 'compartido'>('completo')
  const [preview,        setPreview]        = useState<Preview | null>(null)
  const [paso,           setPaso]           = useState<Paso>('formulario')
  const [loading,        setLoading]        = useState(false)
  const [loadingPacientes, setLoadingPacientes] = useState(true)
  const [error,          setError]          = useState('')
  const [exitoModalidad, setExitoModalidad] = useState<'completo' | 'compartido'>('completo')

  // Cargar pacientes activos del terapeuta
  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('therapist_patients')
        .select('patient_id, profiles!therapist_patients_patient_id_fkey(full_name, email)')
        .eq('therapist_id', user.id)
        .eq('is_active', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (data) {
        const lista: Paciente[] = data.map((row: any) => {
          const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
          return {
            id:     row.patient_id,
            nombre: p?.full_name ?? p?.email ?? row.patient_id,
            email:  p?.email ?? '',
          }
        })
        setPacientes(lista)
      }
      setLoadingPacientes(false)
    }
    cargar()
  }, [])

  async function verPreview() {
    setError('')
    setLoading(true)
    const res = await fetch(
      `/api/therapist/transferir-paciente?patientId=${encodeURIComponent(pacienteId)}&emailReceptor=${encodeURIComponent(emailReceptor)}`
    )
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) {
      setError(data.error ?? 'Error al obtener vista previa')
      return
    }
    setPreview(data)
    setPaso('preview')
  }

  async function confirmar() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/therapist/transferir-paciente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: pacienteId, emailReceptor, modalidad }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok || data.error) {
      setError(data.error ?? 'Error al ejecutar el traslado')
      return
    }
    setExitoModalidad(modalidad)
    setPaso('exito')
  }

  function reiniciar() {
    setPacienteId('')
    setEmailReceptor('')
    setModalidad('completo')
    setPreview(null)
    setError('')
    setPaso('formulario')
  }

  const pacienteSeleccionado = pacientes.find(p => p.id === pacienteId)

  return (
    <div className="max-w-lg mx-auto px-6 py-8 space-y-6">

      {/* Cabecera */}
      <div>
        <Link href="/therapist/patients" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          ← Mis pacientes
        </Link>
        <h1 className="mt-3 text-xl font-bold text-gray-900">Transferir paciente</h1>
        <p className="mt-1 text-sm text-gray-500">
          Traslada el expediente completo de un paciente a otro terapeuta de AVI.
          El paciente no notará ningún cambio — seguirá usando su mismo correo y contraseña.
        </p>
      </div>

      {/* ── Paso 1: formulario ── */}
      {paso === 'formulario' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">

          {/* Selector de paciente */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Paciente a transferir</label>
            {loadingPacientes ? (
              <p className="text-sm text-gray-400 py-2">Cargando pacientes…</p>
            ) : (
              <select
                value={pacienteId}
                onChange={e => { setPacienteId(e.target.value); setError('') }}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              >
                <option value="">— Selecciona un paciente —</option>
                {pacientes.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} {p.email ? `(${p.email})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Email del receptor */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Correo del terapeuta receptor
            </label>
            <input
              type="email"
              value={emailReceptor}
              onChange={e => { setEmailReceptor(e.target.value); setError('') }}
              placeholder="terapeuta@ejemplo.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <p className="text-xs text-gray-400">Debe tener una cuenta de terapeuta activa en AVI</p>
          </div>

          {/* Modalidad */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Tipo de traslado</label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="modalidad"
                value="completo"
                checked={modalidad === 'completo'}
                onChange={() => setModalidad('completo')}
                className="mt-0.5 accent-primary-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">Traslado completo</p>
                <p className="text-xs text-gray-500">El paciente desaparece de tu lista. Solo el terapeuta receptor lo verá.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="modalidad"
                value="compartido"
                checked={modalidad === 'compartido'}
                onChange={() => setModalidad('compartido')}
                className="mt-0.5 accent-primary-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">Traslado compartido</p>
                <p className="text-xs text-gray-500">Ambos terapeutas tendrán acceso al paciente y su historial.</p>
              </div>
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
          )}

          <button
            onClick={verPreview}
            disabled={loading || !pacienteId || !emailReceptor.trim()}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Verificando…' : 'Ver resumen del traslado →'}
          </button>
        </div>
      )}

      {/* ── Paso 2: preview ── */}
      {paso === 'preview' && preview && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Resumen del traslado</h2>

            {/* Origen → Receptor */}
            <div className="flex items-start gap-3">
              <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">PACIENTE</p>
                <p className="text-sm font-medium text-gray-800">{preview.paciente.nombre}</p>
                <p className="text-xs text-gray-500 truncate">{preview.paciente.email}</p>
              </div>
              <div className="flex items-center pt-6 text-gray-400 text-xl">→</div>
              <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-green-700 mb-1">TERAPEUTA RECEPTOR</p>
                <p className="text-sm font-medium text-gray-800">{preview.receptor.nombre}</p>
                <p className="text-xs text-gray-500 truncate">{preview.receptor.email}</p>
              </div>
            </div>

            {/* Qué se traslada */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Se trasladará</p>
              <div className="space-y-1.5 text-sm text-gray-700">
                <p>✓ Nota inicial y análisis clínicos</p>
                <p>✓ {preview.resumen.sesionesPresenciales} sesión{preview.resumen.sesionesPresenciales !== 1 ? 'es' : ''} presencial{preview.resumen.sesionesPresenciales !== 1 ? 'es' : ''}</p>
                <p>✓ {preview.resumen.analisis} análisis Consúltame</p>
                {preview.resumen.tieneExpediente && <p>✓ Expediente completo (datos generales, secciones clínicas)</p>}
                <p>✓ Historial de sesiones AVI <span className="text-gray-400 text-xs">(visible automáticamente)</span></p>
              </div>
            </div>

            {/* Modalidad elegida */}
            <div className={`rounded-xl p-3 text-sm ${modalidad === 'completo' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
              {modalidad === 'completo'
                ? '⚠️ Traslado completo: el paciente desaparecerá de tu lista activa después de confirmar.'
                : 'ℹ️ Traslado compartido: seguirás viendo al paciente en tu lista junto con el nuevo terapeuta.'}
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
                {loading ? 'Procesando…' : '✓ Confirmar traslado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Paso 3: éxito ── */}
      {paso === 'exito' && (
        <div className="bg-white rounded-2xl border border-green-100 p-8 shadow-sm text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h2 className="text-lg font-bold text-gray-800">¡Traslado completado!</h2>
          <p className="text-sm text-gray-500">
            {exitoModalidad === 'completo'
              ? `Todo el expediente fue trasladado al terapeuta receptor. El paciente ya no aparece en tu lista activa.`
              : `El expediente fue copiado al terapeuta receptor. Ambos tienen acceso al paciente.`}
          </p>
          <p className="text-xs text-gray-400">
            El paciente puede seguir usando AVI con su mismo correo y contraseña sin ningún cambio.
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
              Transferir otro paciente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
