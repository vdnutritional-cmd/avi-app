'use client'

// /patient/consentimiento — elegir la opción de la Escucha de AVI y firmar el Consentimiento Informado v2
// (8 nov 2026, src/lib/consentimiento.ts). Llega aquí:
//   - quien firmó una versión anterior (al volver a entrar a AVI; /patient/chat lo manda aquí);
//   - quien tiene un cambio habilitado por su <pro> (Derechos ARCO; aparece en "Tu <pro> te envió").
// La firma la guarda el servidor (/api/patient/consentimiento) con el mismo texto, la IP y el dispositivo.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { terminos, type Terminologia } from '@/lib/terminologia'
import { nombreOpcion, type OpcionEscucha } from '@/lib/consentimiento'
import { AcuerdoConsentimiento, TuPrivacidad } from '@/components/consentimiento/PasosConsentimiento'

interface Estado {
  alDia: boolean
  opcion: OpcionEscucha | null
  solicitud: { created_at: string } | null
  terminologia: Terminologia
  empresa: string | null
}

export default function ConsentimientoPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado | null>(null)
  const [paso, setPaso] = useState<'privacidad' | 'consentimiento'>('privacidad')
  const [opcion, setOpcion] = useState<OpcionEscucha | null>(null)
  const [acepto, setAcepto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/patient/consentimiento')
      .then(r => r.json())
      .then((d: Estado) => setEstado(d))
      .catch(() => setError('No se pudo cargar tu Consentimiento. Revisa tu conexión.'))
  }, [])

  async function firmar() {
    if (!opcion || !acepto) return
    setGuardando(true); setError('')
    const res = await fetch('/api/patient/consentimiento', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opcion, acepto }),
    }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) {
      setError(json.error ?? 'No se pudo guardar tu Consentimiento. Revisa tu conexión e intenta de nuevo.')
      setGuardando(false)
      return
    }
    router.replace('/patient/chat')
  }

  const cont = 'min-h-screen flex flex-col items-center bg-gradient-to-br from-primary-50 via-white to-calm-50'
  if (!estado) return (
    <div className={`${cont} justify-center`}>
      {error ? <p className="text-sm text-red-600 px-6">{error}</p>
        : <span className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />}
    </div>
  )

  const w = terminos(estado.terminologia)
  const porArco = !!estado.solicitud

  // Sin cambio habilitado y con la versión vigente firmada: nada que firmar
  if (!porArco && estado.alDia) return (
    <div className={`${cont} justify-center px-6`}>
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="text-5xl">🔒</div>
        <p className="text-sm text-gray-600">Tu Consentimiento Informado está al día. Para cambiar tu opción, solicítalo a tu {w.pro}.</p>
        <Link href="/patient/privacidad" className="inline-block text-sm text-primary-600 hover:text-primary-800">Ver mi privacidad y consentimiento →</Link>
      </div>
    </div>
  )

  return (
    <div className={cont}>
      <div className="w-full max-w-sm flex flex-col min-h-screen">
        <div className="px-6 pt-8 space-y-3">
          <div className="flex gap-2">
            {['privacidad', 'consentimiento'].map((p, i) => (
              <div key={p} className={`h-1 flex-1 rounded-full ${i <= (paso === 'privacidad' ? 0 : 1) ? 'bg-primary-500' : 'bg-gray-200'}`} />
            ))}
          </div>
          <p className="text-xs text-gray-500 bg-white/70 border border-gray-200 rounded-xl px-3 py-2 leading-relaxed">
            {porArco
              ? <>Tu {w.pro} te habilitó el cambio de tu opción y de tu Consentimiento Informado.
                  {estado.opcion && <> Tu opción actual es <strong>{nombreOpcion(estado.opcion, estado.terminologia)}</strong>.</>}</>
              : <>Actualizamos el Consentimiento Informado de AVI. Para continuar, elige tu opción y fírmalo.</>}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {paso === 'privacidad' ? (
            <>
              <div className="text-center space-y-3">
                <div className="text-5xl">🔒</div>
                <h2 className="text-lg font-bold text-primary-700">Tu privacidad importa</h2>
              </div>
              <TuPrivacidad terminologia={estado.terminologia} opcion={opcion} onOpcion={setOpcion} />
            </>
          ) : opcion && (
            <AcuerdoConsentimiento terminologia={estado.terminologia} opcion={opcion} empresa={estado.empresa}
              acepto={acepto} onAcepto={setAcepto} />
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}
        </div>

        <div className="px-6 pb-10 space-y-3">
          {paso === 'privacidad' ? (
            <button onClick={() => { setPaso('consentimiento'); window.scrollTo(0, 0) }} disabled={!opcion}
              className="w-full py-4 bg-primary-600 text-white font-semibold rounded-2xl hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Siguiente
            </button>
          ) : (
            <>
              <button onClick={firmar} disabled={!acepto || guardando}
                className="w-full py-4 bg-primary-600 text-white font-semibold rounded-2xl hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {guardando ? 'Guardando...' : 'Acepto y firmo'}
              </button>
              <button onClick={() => { setPaso('privacidad'); setAcepto(false); window.scrollTo(0, 0) }}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">← Anterior</button>
            </>
          )}
          {porArco && (
            <Link href="/patient/chat" className="block text-center text-xs text-gray-400 hover:text-gray-600">
              Ahora no (tu opción actual sigue vigente)
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
