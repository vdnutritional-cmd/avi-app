'use client'

// Mensajes al paciente (AVI-CLÍNICO › Cuestionarios, 27 oct 2026): Asunto + Mensaje, de un solo sentido.
// La persona los lee en su pestaña "Mensajes" y recibe un correo de aviso sin el contenido.
// "Retirar" (envío por error) lo oculta para la persona; aquí sigue en el registro.
import { useEffect, useState } from 'react'
import type { Variable } from '@/lib/terminologia'

const MAX_ASUNTO = 150
const MAX_MENSAJE = 5000

interface Mensaje {
  id: string
  asunto: string
  mensaje: string
  created_at: string
  leido_at: string | null
  retirado_at: string | null
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

export default function MensajesPaciente({ patientId, w }: { patientId: string; w: Record<Variable, string> }) {
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null)
  const [puedeEnviar, setPuedeEnviar] = useState(true)
  const [motivo, setMotivo] = useState<string | null>(null)
  const [asunto, setAsunto] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)

  async function cargar() {
    const res = await fetch(`/api/therapist/mensajes-paciente?patientId=${patientId}`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setMensajes([]); setAviso({ ok: false, texto: json.error ?? 'No se pudieron cargar los mensajes.' }); return }
    setMensajes(json.mensajes)
    setPuedeEnviar(json.puedeEnviar)
    setMotivo(json.motivo)
  }

  useEffect(() => { cargar() }, [patientId])

  async function enviar() {
    if (!asunto.trim() || !texto.trim()) return
    if (!confirm(`¿Enviar este mensaje al ${w.user}? Lo verá en su cuenta de AVI y le llegará un correo de aviso (sin el contenido).`)) return
    setEnviando(true)
    setAviso(null)
    const res = await fetch('/api/therapist/mensajes-paciente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, asunto, mensaje: texto }),
    })
    const json = await res.json().catch(() => ({}))
    setEnviando(false)
    if (!res.ok) { setAviso({ ok: false, texto: json.error ?? 'No se pudo enviar. Intenta de nuevo.' }); return }
    setAsunto('')
    setTexto('')
    setAviso({ ok: true, texto: `Mensaje enviado. El ${w.user} lo verá en su pestaña "Mensajes".` })
    cargar()
  }

  async function retirar(m: Mensaje) {
    if (!confirm(`¿Retirar el mensaje "${m.asunto}"?\n\nEl ${w.user} ya no lo verá. Aquí queda en el registro como retirado.`)) return
    const res = await fetch('/api/therapist/mensajes-paciente', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setAviso({ ok: false, texto: json.error ?? 'No se pudo retirar.' }); return }
    cargar()
  }

  return (
    <div className="space-y-4">
      {/* ── Enviar ── */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Enviar mensaje al {w.user}</p>
          <p className="text-xs text-emerald-600 mt-1">
            Para enviarle información por escrito. Lo lee en su cuenta de AVI (pestaña &quot;Mensajes&quot;); no puede contestar
            y no ve tu teléfono. Le llega un correo que solo avisa que tiene un mensaje.
          </p>
        </div>
        {!puedeEnviar && motivo ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{motivo}</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Asunto:</label>
              <input
                value={asunto}
                onChange={e => setAsunto(e.target.value.slice(0, MAX_ASUNTO))}
                className="w-full text-sm rounded-xl border border-emerald-300 bg-white px-3 py-2.5
                           focus:outline-none focus:ring-2 focus:ring-emerald-300 text-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mensaje:</label>
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value.slice(0, MAX_MENSAJE))}
                rows={6}
                className="w-full text-sm rounded-xl border border-emerald-300 bg-white px-3 py-2.5
                           focus:outline-none focus:ring-2 focus:ring-emerald-300 text-gray-700 resize-y"
              />
              <p className="text-[11px] text-gray-400 text-right">{texto.length} / {MAX_MENSAJE}</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={enviar}
                disabled={enviando || !asunto.trim() || !texto.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold
                           rounded-xl transition-colors disabled:opacity-50"
              >
                {enviando ? 'Enviando…' : '✉️ Enviar'}
              </button>
            </div>
          </>
        )}
        {aviso && (
          <p className={`text-sm ${aviso.ok ? 'text-emerald-700' : 'text-red-600'}`}>{aviso.texto}</p>
        )}
      </div>

      {/* ── Enviados ── */}
      {mensajes && mensajes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mensajes enviados</p>
          {mensajes.map(m => {
            const esAbierto = expandido === m.id
            return (
              <div key={m.id} className={`border rounded-2xl overflow-hidden ${m.retirado_at ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100 shadow-sm'}`}>
                <button
                  onClick={() => setExpandido(esAbierto ? null : m.id)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${m.retirado_at ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{m.asunto}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Enviado {fecha(m.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.retirado_at
                      ? <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-lg font-medium">Retirado {fecha(m.retirado_at)}</span>
                      : m.leido_at
                        ? <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">Leído {fecha(m.leido_at)}</span>
                        : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-medium">Sin leer</span>}
                    <span className="text-gray-400 text-sm">{esAbierto ? '▲' : '▼'}</span>
                  </div>
                </button>
                {esAbierto && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{m.mensaje}</p>
                    {!m.retirado_at && (
                      <div className="flex justify-end">
                        <button onClick={() => retirar(m)} className="text-xs text-red-600 hover:text-red-700 underline">
                          Retirar mensaje (enviado por error)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
