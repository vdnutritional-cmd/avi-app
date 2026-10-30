'use client'

// ─────────────────────────────────────────────────────────────
// /admin/conversion-paciente — Conversión de paciente a terapeuta (17 oct 2026)
// Para quien se registró por error como paciente y es terapeuta. Primero se ve qué
// tiene la cuenta; al confirmar, la misma cuenta pasa a terapeuta (no se borra nada).
// API: /api/admin/convertir-paciente
// ─────────────────────────────────────────────────────────────

import { useState } from 'react'

interface Vinculo { terapeuta: string; empresa: string | null; status: string; desde: string }
interface VistaPrevia {
  cuenta: { id: string; nombre: string; email: string; creado: string }
  vinculos: Vinculo[]
  sesionesAvi: number
  sesionesAbiertas: number
  tieneExpediente: boolean
}

const API = '/api/admin/convertir-paciente'

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ConversionPacientePage() {
  const [correo,    setCorreo]    = useState('')
  const [buscando,  setBuscando]  = useState(false)
  const [previa,    setPrevia]    = useState<VistaPrevia | null>(null)
  const [entendido, setEntendido] = useState(false)
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [err, setErr] = useState('')
  const [ok,  setOk]  = useState('')

  async function buscar() {
    const email = correo.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('Escribe un correo válido.'); return }
    setBuscando(true); setErr(''); setOk(''); setPrevia(null); setEntendido(false)
    const data = await fetch(`${API}?email=${encodeURIComponent(email)}`).then(r => r.json()).catch(() => ({ error: 'No se pudo consultar.' }))
    if (data.error) setErr(data.error)
    else setPrevia(data as VistaPrevia)
    setBuscando(false)
  }

  async function convertir() {
    if (!previa) return
    setConvirtiendo(true); setErr('')
    const data = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: previa.cuenta.email }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo convertir.' }))
    if (data.error) setErr(data.error)
    else {
      setOk(`${data.nombre || previa.cuenta.email} ya es una cuenta de terapeuta. Entra con su mismo correo y contraseña.`)
      setPrevia(null); setCorreo(''); setEntendido(false)
    }
    setConvirtiendo(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conversión de paciente a terapeuta</h1>
        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
          Para una persona que se registró por error como paciente y en realidad es terapeuta, consultor o asesor.
          AVI solo admite una cuenta por correo, por eso no puede registrarse otra vez: aquí su misma cuenta
          (mismo correo y contraseña) pasa a ser de terapeuta. No se borra nada de su historial.
        </p>
      </div>

      {/* ── Buscar ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Correo de la cuenta de paciente</h2>
        <div className="flex gap-3">
          <input
            type="email" placeholder="correo@ejemplo.com" value={correo}
            onChange={e => { setCorreo(e.target.value); setErr(''); setOk('') }}
            onKeyDown={e => { if (e.key === 'Enter' && correo.trim()) buscar() }}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button
            onClick={buscar} disabled={buscando || !correo.trim()}
            className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
          >
            {buscando ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
        {err && !previa && <p className="text-red-500 text-xs">{err}</p>}
        {ok && (
          <div className="space-y-2">
            <p className="text-green-700 text-sm">✓ {ok}</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 space-y-1.5">
              <p className="font-semibold">Siguiente paso — aparecerá en Terapeutas registrados › Pendientes:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>No uses &quot;No aprobar&quot;</strong>: elimina la cuenta de AVI. (Ya no aparece para cuentas convertidas.)</li>
                <li>Para darle acceso: apruébale un plan ahí mismo, <strong>o</strong> asígnala a una empresa (Empresas en CONVENIO › Personas Institucionales › Agregar por correo, o Alta/Baja de la empresa): con una empresa activa entra sin plan.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ── Vista previa y confirmación ── */}
      {previa && (
        <div className="bg-white border border-primary-100 rounded-2xl p-6 space-y-5">
          <div>
            <p className="text-base font-semibold text-primary-700">{previa.cuenta.nombre || '(sin nombre)'}</p>
            <p className="text-sm text-gray-600">{previa.cuenta.email} · cuenta de paciente desde {fecha(previa.cuenta.creado)}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Registrado como paciente con</p>
            {previa.vinculos.length === 0 ? (
              <p className="text-sm text-gray-600">Ningún terapeuta.</p>
            ) : (
              <ul className="space-y-1">
                {previa.vinculos.map((v, i) => (
                  <li key={i} className="text-sm text-gray-800">
                    • {v.terapeuta}{v.empresa ? ` · ${v.empresa}` : ' · sin empresa'}
                    <span className="text-gray-600"> · desde {fecha(v.desde)}{v.status !== 'active' ? ` · ${v.status}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-600">Sesiones con AVI</p>
              <p className="text-lg font-bold text-gray-900">{previa.sesionesAvi}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-600">Sesiones abiertas</p>
              <p className="text-lg font-bold text-gray-900">{previa.sesionesAbiertas}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-600">Expediente / Datos Generales</p>
              <p className="text-lg font-bold text-gray-900">{previa.tieneExpediente ? 'Sí' : 'No'}</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 space-y-1.5">
            <p className="font-semibold">⚠️ Al convertirla:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Pierde su acceso como paciente</strong>: ya no podrá platicar con AVI ni ver su Resumen.</li>
              {previa.vinculos.length > 0 && (
                <li>Desaparece de &quot;Mis pacientes&quot; de {previa.vinculos.length === 1 ? 'su terapeuta' : 'sus terapeutas'}. No se le avisa.</li>
              )}
              {previa.sesionesAbiertas > 0 && <li>Sus sesiones abiertas con AVI se cierran con su resumen.</li>}
              <li>Su historial (expediente, sesiones y mensajes) <strong>se conserva</strong> en AVI; no se borra nada.</li>
              <li>Entra con su mismo correo y contraseña, como terapeuta y sin plan: aparecerá en Terapeutas registrados › Pendientes. Ahí apruébale un plan o asígnala a una empresa; <strong>no uses &quot;No aprobar&quot;</strong>, que elimina la cuenta.</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
            <input type="checkbox" checked={entendido} onChange={e => setEntendido(e.target.checked)} className="accent-purple-700 w-4 h-4 mt-0.5 shrink-0" />
            Entiendo que esta persona pierde su acceso como paciente y quiero convertir su cuenta a terapeuta.
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={convertir} disabled={!entendido || convirtiendo}
              className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
            >
              {convirtiendo ? 'Convirtiendo…' : 'Convertir a terapeuta'}
            </button>
            <button
              onClick={() => { setPrevia(null); setEntendido(false); setErr('') }} disabled={convirtiendo}
              className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2"
            >
              Cancelar
            </button>
          </div>
          {err && <p className="text-red-500 text-xs">{err}</p>}
        </div>
      )}
    </div>
  )
}
