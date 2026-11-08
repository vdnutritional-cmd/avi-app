'use client'

// Derechos ARCO de <user> (AVI-CLÍNICO › Cuestionarios, 8 nov 2026; src/lib/consentimiento.ts).
// El <pro> ve la opción vigente de la Escucha de AVI y todas las firmas del Consentimiento (no se
// pueden cambiar). Cuando <user> lo pide formalmente, "Habilitar cambio" le llega a su app (Tu <pro>
// te envió + aviso al teléfono) y ahí elige y firma de nuevo. El <pro> nunca elige por la persona.
import { useEffect, useState } from 'react'
import type { Variable } from '@/lib/terminologia'
import { escuchaPermitida, nombreOpcion, NOMBRE_ORIGEN, type OpcionEscucha, type OrigenFirma } from '@/lib/consentimiento'
import type { Terminologia } from '@/lib/terminologia'

interface FirmaVista {
  id: string; version: number; opcion: OpcionEscucha; origen: OrigenFirma
  firmado_at: string; ip: string | null; dispositivo: string; sha256: string
}
interface Estado {
  opcion: OpcionEscucha | null
  alDia: boolean
  version: number
  firmas: FirmaVista[]
  solicitud: { created_at: string; propia: boolean } | null
}

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-MX', {
  timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export default function DerechosArco({ patientId, w, terminologia }: {
  patientId: string; w: Record<Variable, string>; terminologia: Terminologia
}) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [error, setError] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let cancelado = false
    fetch(`/api/therapist/consentimiento?patientId=${encodeURIComponent(patientId)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { if (!cancelado) setEstado(d) })
      .catch(status => {
        if (cancelado) return
        // 401: la sesión de este navegador ya no es la del <pro> (expiró, o se entró con otra cuenta)
        setError(status === 401
          ? 'Tu sesión expiró o en este navegador se inició sesión con otra cuenta. Vuelve a iniciar sesión como ' + w.pro + '.'
          : 'No se pudo cargar el Consentimiento. Revisa tu conexión y recarga la página.')
      })
    return () => { cancelado = true }
  }, [patientId])

  async function habilitar() {
    setEnviando(true); setError('')
    const res = await fetch('/api/therapist/consentimiento', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId }),
    }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) setError(json.error ?? 'No se pudo habilitar el cambio.')
    else setEstado(prev => prev ? { ...prev, solicitud: json.solicitud } : prev)
    setEnviando(false); setConfirmar(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-800">🔒 Derechos ARCO del {w.user}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Opción de la Escucha de AVI y Consentimiento Informado. Solo el {w.user} elige y firma; aquí se habilita el cambio cuando lo solicite formalmente.
        </p>
      </div>

      {!estado ? (
        error ? <p className="text-sm text-red-600">{error}</p> : <p className="text-sm text-gray-400">Cargando…</p>
      ) : (
        <>
          {/* Opción vigente */}
          {estado.opcion ? (
            <div className={`rounded-xl border px-4 py-3 text-sm ${escuchaPermitida(estado.opcion)
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              Opción vigente: <strong>{nombreOpcion(estado.opcion, terminologia)}</strong>
              {estado.firmas[0] && <> · firmada el {fechaHora(estado.firmas[0].firmado_at)} (versión {estado.firmas[0].version})</>}
            </div>
          ) : (
            <div className="rounded-xl border px-4 py-3 text-sm bg-red-50 border-red-200 text-red-700">
              El {w.user} aún no firma el Consentimiento Informado versión {estado.version}: la Escucha de AVI no está autorizada.
              Lo verá al entrar a su app de AVI.
            </div>
          )}
          {estado.opcion && !estado.alDia && (
            <p className="text-xs text-amber-700">Firmó una versión anterior; al entrar a AVI se le pedirá firmar la versión {estado.version}.</p>
          )}

          {/* Habilitar cambio */}
          {estado.solicitud ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Cambio habilitado el {fechaHora(estado.solicitud.created_at)}{!estado.solicitud.propia && ` por otro ${w.pro}`}: pendiente de que el {w.user} elija y firme en su app.
            </p>
          ) : confirmar ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-2">
              <p className="text-sm text-gray-700">
                ¿El {w.user} solicitó formalmente cambiar su opción o su Consentimiento? Le llegará a su app para elegir y firmar de nuevo; mientras tanto sigue vigente su opción actual.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={habilitar} disabled={enviando}
                  className="text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl">
                  {enviando ? 'Enviando…' : 'Sí, habilitar'}
                </button>
                <button type="button" onClick={() => setConfirmar(false)} className="text-sm text-gray-600 px-3 py-2">Cancelar</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmar(true)}
              className="text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl">
              Habilitar cambio de opción y nuevo Consentimiento
            </button>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Historial (no se puede modificar) */}
          {estado.firmas.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Historial de firmas ({estado.firmas.length})
              </summary>
              <div className="mt-2 border border-gray-100 rounded-xl divide-y divide-gray-100">
                {estado.firmas.map(f => (
                  <div key={f.id} className="px-3 py-2 space-y-0.5">
                    <p className="text-gray-800 font-medium">{nombreOpcion(f.opcion, terminologia)}</p>
                    <p className="text-xs text-gray-500">{fechaHora(f.firmado_at)} · Versión {f.version} · {NOMBRE_ORIGEN[f.origen]}</p>
                    <p className="text-xs text-gray-400 break-all">IP {f.ip ?? '—'} · {f.dispositivo} · SHA-256 {f.sha256.slice(0, 16)}…</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
