'use client'

// ─────────────────────────────────────────────────────────────
// AudioRecorder — Sprint 13 (27 oct 2026): escucha de la sesión y resumen con IA.
// Graba con el micrófono, transcribe con Groq Whisper (/api/transcribir-sesion) y pide
// un resumen de 300 a 400 palabras (/api/transcribir-sesion/resumen) que entrega a onResumen.
//
// - Graba en tramos de 4 min (cada uno es un archivo completo): Vercel no acepta peticiones
//   de más de 4.5 MB. Cada tramo se transcribe en cuanto termina, mientras sigue la sesión.
// - Solo se transcriben los primeros ~50 min (LIMITE_SEG).
// - El audio nunca se guarda: vive en memoria del navegador hasta recibir el resumen o descartarlo.
//   Si algo falla, se conserva para "Reintentar" sin volver a grabar.
// - Wake Lock para que no se apague la pantalla; avisos con tono a los 40 y 50 min;
//   cuenta como actividad (evento avi:actividad) para que no se cierre la sesión por inactividad.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'

type Estado = 'idle' | 'recording' | 'transcribing' | 'error'
type Tramo = { inicio: number; blob: Blob; texto?: string; fallo?: boolean }

const TRAMO_MS     = 4 * 60 * 1000
const AVISO_SEG    = 40 * 60
const LIMITE_SEG   = 50 * 60
const BITS_AUDIO   = 32000   // voz: 32 kbps sobra y deja cada tramo en ~1 MB

const BANNERS = {
  normal:  { clase: 'bg-amber-50 border-amber-200 text-amber-800',    texto: 'Recuerda que la sesión no debe exceder 50 minutos para una transcripción óptima.' },
  aviso:   { clase: 'bg-orange-50 border-orange-300 text-orange-800', texto: '⚠️ Llevas 40 minutos. Considera cerrar la sesión en los próximos 10 minutos.' },
  limite:  { clase: 'bg-red-50 border-red-300 text-red-700',          texto: '🔴 Has alcanzado 50 minutos. Se recomienda detener la grabación ahora.' },
} as const

function tono(segundos: number) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 440
    osc.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + segundos)
    osc.onended = () => { void ctx.close() }
  } catch { /* sin audio: solo cambia el aviso */ }
}

function mmss(seg: number) {
  return `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`
}

function tipoAudio(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

export default function AudioRecorder({ onResumen, patientId }: { onResumen: (texto: string) => void; patientId?: string }) {
  const [estado, setEstado] = useState<Estado>('idle')
  const [segundos, setSegundos] = useState(0)
  const [banner, setBanner] = useState<keyof typeof BANNERS>('normal')
  const [recortada, setRecortada] = useState(false)
  const [error, setError] = useState('')
  const [confirmarDescarte, setConfirmarDescarte] = useState(false)

  const streamRef   = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const tramosRef   = useRef<Tramo[]>([])
  const envios      = useRef<Map<Tramo, Promise<void>>>(new Map())
  const grabando    = useRef(false)
  const inicioRef   = useRef(0)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const relojRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const detenerOk   = useRef<(() => void) | null>(null)
  const avisado     = useRef(0)   // 0 ninguno · 1 aviso de 40 min · 2 aviso de 50 min

  // Al salir de la pantalla: apagar micrófono, reloj y Wake Lock
  useEffect(() => () => {
    grabando.current = false
    try { recorderRef.current?.stop() } catch { /* ya detenido */ }
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (relojRef.current) clearInterval(relojRef.current)
    void wakeLockRef.current?.release().catch(() => {})
  }, [])

  // El navegador suelta el Wake Lock al cambiar de pestaña: se pide otra vez al volver
  useEffect(() => {
    if (estado !== 'recording') return
    const alVolver = () => { if (document.visibilityState === 'visible') void pedirWakeLock() }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [estado])

  // Grabar y transcribir cuenta como actividad (si no, la sesión del terapeuta se cierra a los 15 min)
  useEffect(() => {
    if (estado !== 'recording' && estado !== 'transcribing') return
    const id = setInterval(() => window.dispatchEvent(new Event('avi:actividad')), 30_000)
    return () => clearInterval(id)
  }, [estado])

  async function pedirWakeLock() {
    try { wakeLockRef.current = await navigator.wakeLock?.request('screen') ?? null } catch { /* no soportado */ }
  }
  function soltarWakeLock() {
    void wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  // ── Transcripción de un tramo (en segundo plano) ──
  function transcribir(tramo: Tramo): Promise<void> {
    const envio = (async () => {
      tramo.fallo = false
      try {
        const form = new FormData()
        form.append('audio', tramo.blob)
        if (patientId) form.append('patientId', patientId)
        const res = await fetch('/api/transcribir-sesion', { method: 'POST', body: form })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error)
        tramo.texto = json.texto ?? ''
      } catch {
        tramo.fallo = true
      }
    })()
    envios.current.set(tramo, envio)
    return envio
  }

  // ── Grabación por tramos ──
  function grabarTramo() {
    const stream = streamRef.current
    if (!stream) return
    const mimeType = tipoAudio()
    const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: BITS_AUDIO })
    const partes: Blob[] = []
    const inicio = (Date.now() - inicioRef.current) / 1000
    recorder.ondataavailable = e => { if (e.data.size) partes.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(partes, { type: recorder.mimeType || mimeType || 'audio/webm' })
      if (blob.size > 0) {
        if (inicio < LIMITE_SEG) {
          const tramo: Tramo = { inicio, blob }
          tramosRef.current.push(tramo)
          void transcribir(tramo)
        } else {
          setRecortada(true)
        }
      }
      if (grabando.current) grabarTramo()
      else detenerOk.current?.()
    }
    recorderRef.current = recorder
    recorder.start()
    setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, TRAMO_MS)
  }

  async function iniciar() {
    setError(''); setRecortada(false); setBanner('normal'); setSegundos(0)
    tramosRef.current = []; envios.current = new Map()
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador no permite grabar audio.'); setEstado('error'); return
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('No se pudo usar el micrófono. Revisa el permiso del navegador.'); setEstado('error'); return
    }
    await pedirWakeLock()
    grabando.current = true
    avisado.current = 0
    inicioRef.current = Date.now()
    grabarTramo()
    setEstado('recording')
    relojRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - inicioRef.current) / 1000)
      setSegundos(s)
      // Con >= y una marca: si el navegador retrasa el reloj (pestaña en segundo plano), el aviso no se pierde
      if (s >= LIMITE_SEG && avisado.current < 2)     { avisado.current = 2; tono(1);   setBanner('limite') }
      else if (s >= AVISO_SEG && avisado.current < 1) { avisado.current = 1; tono(0.6); setBanner('aviso') }
    }, 1000)
  }

  async function detener() {
    grabando.current = false
    if (relojRef.current) clearInterval(relojRef.current)
    soltarWakeLock()
    setEstado('transcribing')
    // Esperar el último tramo (onstop) y apagar el micrófono
    await new Promise<void>(ok => {
      detenerOk.current = ok
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      else ok()
    })
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (Math.floor((Date.now() - inicioRef.current) / 1000) > LIMITE_SEG) setRecortada(true)
    await terminar()
  }

  // Espera las transcripciones (reintenta las que fallaron) y pide el resumen
  async function terminar() {
    setEstado('transcribing'); setError('')
    const tramos = tramosRef.current
    await Promise.all(tramos.map(t => t.fallo ? transcribir(t) : envios.current.get(t)))
    if (tramos.length === 0) { setError('No se grabó audio.'); setEstado('error'); return }
    if (tramos.some(t => t.fallo)) { setError('Ocurrió un error al transcribir; revisa la comunicación de WiFi y reintenta.'); setEstado('error'); return }

    const transcripcion = tramos.map(t => t.texto).filter(Boolean).join('\n')
    try {
      const res = await fetch('/api/transcribir-sesion/resumen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcripcion, patientId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.resumen) throw new Error(json.error)
      onResumen(json.resumen)
      descartar()
    } catch {
      setError('Ocurrió un error al transcribir; revisa la comunicación de WiFi y reintenta.')
      setEstado('error')
    }
  }

  function descartar() {
    tramosRef.current = []
    envios.current = new Map()
    setConfirmarDescarte(false)
    setSegundos(0)
    setEstado('idle')
  }

  const hayGrabacion = tramosRef.current.length > 0

  return (
    <div className="space-y-2">
      {estado === 'idle' && (
        <button type="button" onClick={iniciar}
          className="text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl transition-colors">
          🎙 Inicia escucha de AVI
        </button>
      )}

      {estado === 'recording' && (
        <>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-mono font-semibold text-red-600">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              {mmss(segundos)}
            </span>
            <button type="button" onClick={detener}
              className="text-sm font-semibold bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl transition-colors">
              ⏹ Detener y transcribir
            </button>
          </div>
          <p className={`text-xs border rounded-xl px-3 py-2 ${BANNERS[banner].clase}`}>{BANNERS[banner].texto}</p>
        </>
      )}

      {estado === 'transcribing' && (
        <div className="flex items-center gap-2 text-sm text-purple-700">
          <span className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          Transcribiendo con IA...
        </div>
      )}

      {recortada && estado !== 'recording' && (
        <p className="text-xs border rounded-xl px-3 py-2 bg-amber-50 border-amber-200 text-amber-800">
          La grabación era muy larga; se transcribirán los primeros ~50 minutos.
        </p>
      )}

      {estado === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-red-600">{error || 'Ocurrió un error al transcribir; revisa la comunicación de WiFi y reintenta.'}</p>
          {confirmarDescarte ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 space-y-2">
              <p className="text-sm text-gray-700">¿Seguro que deseas descartar la grabación? Esta acción no se puede deshacer.</p>
              <div className="flex gap-2">
                <button type="button" onClick={descartar}
                  className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg">Sí, descartar</button>
                <button type="button" onClick={() => setConfirmarDescarte(false)}
                  className="text-xs text-gray-600 hover:text-gray-800 px-3 py-1.5">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {hayGrabacion && (
                <button type="button" onClick={terminar}
                  className="text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg">
                  🔄 Reintentar transcripción
                </button>
              )}
              <button type="button" onClick={() => hayGrabacion ? setConfirmarDescarte(true) : descartar()}
                className="text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg">
                ✕ Descartar grabación
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
