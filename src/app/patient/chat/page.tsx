'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { leerModoElegido, guardarModoElegido } from '@/lib/modo-platica'

// Límite de sesiones AVI: según la frecuencia de sesiones presenciales y el periodo
// desde la última presencial (src/lib/limite-sesiones-avi.ts, vía /api/patient/sesiones-avi)

// Tiempos de espera dentro de una sesión abierta (acordados con el supervisor de AVI)
const ESPERA_ESCUCHANDO_MS = 10 * 60_000   // AVI escuchando y el paciente callado
const ESPERA_PACIENTE_MS   =  5 * 60_000   // AVI terminó y espera que el paciente toque el micrófono
const ESPERA_ESCRIBIENDO_MS = 10 * 60_000  // sesión escrita: sin escribir (cada tecla reinicia)
const AVISO_ANTES_MS       =      60_000   // aviso 1 minuto antes de cerrar

// Cómo platica el paciente: se elige antes de iniciar y no cambia durante la sesión.
// Ya elegido, se recuerda al ir a "Resumen" y regresar; se vuelve a preguntar al salir.
type Modo = 'hablada' | 'escrita'

type AppState =
  | 'idle'        // Esperando que el paciente hable
  | 'recording'   // Grabando voz del paciente
  | 'processing'  // Transcribiendo + enviando a Claude
  | 'speaking'    // AVI está hablando

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Pendiente {
  id: string
  title: string
  questionnaire_type: string
  assigned_at: string
}

const STATE_LABELS: Record<AppState, string> = {
  idle: 'Toca para hablar',
  recording: 'Escuchando... toca para terminar',
  processing: 'AVI está pensando...',
  speaking: 'AVI está hablando...',
}

const STATE_COLORS: Record<AppState, string> = {
  idle: 'bg-primary-600 hover:bg-primary-700',
  recording: 'bg-red-500 animate-pulse',
  processing: 'bg-amber-400 cursor-not-allowed',
  speaking: 'bg-calm-500 cursor-not-allowed',
}

export default function PatientChatPage() {
  const router = useRouter()
  const [accesoSuspendido, setAccesoSuspendido] = useState(false)
  const [pendientes, setPendientes] = useState<Pendiente[]>([])

  // Acceso y sesiones AVI disponibles (la regla vive en el servidor)
  useEffect(() => {
    async function checkSesionesAvi() {
      try {
        const res = await fetch('/api/patient/sesiones-avi')
        if (!res.ok) return
        const estado = await res.json()
        aplicarEstadoSesiones(estado)
        // Se marca de entrada lo que eligió la última vez (si aún no lo eligió en este inicio de sesión)
        if (!leerModoElegido() && (estado.ultimoModo === 'hablada' || estado.ultimoModo === 'escrita')) setModo(estado.ultimoModo)
      } catch { /* sin conexión: el servidor vuelve a revisar al iniciar la sesión */ }
    }
    checkSesionesAvi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redirigir a onboarding si es la primera vez — verifica por usuario en Supabase
  useEffect(() => {
    async function checkOnboarding() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Cache específico por usuario (evita consulta extra en visitas repetidas)
      const cacheKey = `avi_onboarding_done_${user.id}`
      if (localStorage.getItem(cacheKey)) return

      // Verificar en Supabase si ya aceptó el consentimiento informado
      const { data: consent } = await supabase
        .from('patient_consents')
        .select('informed_consent_at')
        .eq('patient_id', user.id)
        .single()

      if (!consent?.informed_consent_at) {
        // Primera vez — ir a onboarding
        router.replace('/patient/onboarding')
      } else {
        // Ya lo hizo — guardar en cache para no volver a consultar
        localStorage.setItem(cacheKey, '1')
      }
    }
    checkOnboarding()
  }, [router])

  // Cargar cuestionarios pendientes del paciente
  useEffect(() => {
    async function fetchPendientes() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('patient_questionnaires')
        .select('id, title, questionnaire_type, assigned_at')
        .eq('patient_id', user.id)
        .eq('status', 'pending')
        .order('assigned_at', { ascending: true })

      if (data) setPendientes(data)
    }
    fetchPendientes()
  }, [])

  const [appState, setAppState] = useState<AppState>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [crisis, setCrisis] = useState(false)
  const [sessionClosed, setSessionClosed] = useState(false)
  const [closing, setClosing] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [sesionesUsadas, setSesionesUsadas] = useState(0)
  const [limitAlcanzado, setLimitAlcanzado] = useState(false)
  const [limiteActual, setLimiteActual] = useState<number | null>(null)
  // 'limite' = agotó sus sesiones del periodo · 'sin_cupo' = su terapeuta no tiene plan/cupo
  const [motivoLimite, setMotivoLimite] = useState<'limite' | 'sin_cupo' | null>(null)

  function aplicarEstadoSesiones(estado: { permitido: boolean; motivo: string; usadas: number; limite: number | null }) {
    setSesionesUsadas(estado.usadas ?? 0)
    setLimiteActual(estado.limite ?? null)
    if (estado.permitido) { setLimitAlcanzado(false); setMotivoLimite(null); return }
    if (estado.motivo === 'bloqueado' || estado.motivo === 'sin_terapeuta') { setAccesoSuspendido(true); return }
    setLimitAlcanzado(true)
    setMotivoLimite(estado.motivo === 'sin_cupo' ? 'sin_cupo' : 'limite')
  }
  // El paciente presionó "Terminar" mientras hablaba o AVI respondía: se cierra al terminar
  const [cierrePendiente, setCierrePendiente] = useState(false)
  // Aviso 1 minuto antes del cierre por tiempo (null = sin aviso)
  const [avisoTiempo, setAvisoTiempo] = useState<string | null>(null)
  // Hablada o escrita: se elige en la pantalla de inicio ("Empezar") y queda fija en la sesión
  const [modo, setModo] = useState<Modo>('hablada')
  const [modoConfirmado, setModoConfirmado] = useState(false)
  const [texto, setTexto] = useState('')       // Lo que el paciente va escribiendo (modo escrito)
  const modoRef = useRef<Modo>('hablada')
  const textoRef = useRef('')

  // Ya eligió en este inicio de sesión (fue a "Resumen" y regresó): directo a su modo
  useEffect(() => {
    const elegido = leerModoElegido()
    if (elegido) { setModo(elegido); setModoConfirmado(true) }
  }, [])
  const cajaTextoRef = useRef<HTMLTextAreaElement>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef<string>('')   // Acumula el texto mientras el usuario habla
  const interimRef = useRef<string>('')      // Último texto aún no confirmado (respaldo al terminar)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const userStoppedRef = useRef(false)       // true cuando se detuvo la grabación a propósito (botón o tiempo)
  const grabacionProcesadaRef = useRef(false) // evita procesar dos veces la misma grabación

  // Refs para acceder a valores actuales desde event listeners (evitan closures obsoletos)
  const sessionIdRef = useRef<string | null>(null)
  const sessionClosedRef = useRef(false)
  const hasMessagesRef = useRef(false)
  const cierrePendienteRef = useRef(false)
  const cierrePorTiempoRef = useRef(false)   // venció el tiempo mientras AVI escuchaba
  const finalizandoRef = useRef(false)

  // Canal de voz único: cada voz espera a que termine la anterior (nunca dos a la vez)
  const voiceChainRef = useRef<Promise<void>>(Promise.resolve())
  const finishCurrentRef = useRef<(() => void) | null>(null)

  // Tiempos dentro de una sesión abierta
  const ultimaVozPacienteRef = useRef(0)     // última palabra reconocida mientras AVI escucha
  const limiteRef = useRef<{ en: number; tipo: 'escuchando' | 'esperando' | 'escribiendo' } | null>(null)
  const vencidoRef = useRef(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeLockRef = useRef<any>(null)

  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])
  useEffect(() => { sessionClosedRef.current = sessionClosed }, [sessionClosed])
  useEffect(() => { hasMessagesRef.current = messages.length > 0 }, [messages])
  useEffect(() => { cierrePendienteRef.current = cierrePendiente }, [cierrePendiente])
  useEffect(() => { modoRef.current = modo }, [modo])
  useEffect(() => { textoRef.current = texto }, [texto])
  // La caja para escribir crece con el texto (hasta 4 líneas; después se desplaza por dentro)
  useEffect(() => {
    const el = cajaTextoRef.current
    if (!el) return
    el.style.height = 'auto'
    const alto = el.scrollHeight + (el.offsetHeight - el.clientHeight)   // + marco
    el.style.height = `${Math.min(alto, 112)}px`
    el.style.overflowY = alto > 112 ? 'auto' : 'hidden'
  }, [texto])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cierre por abandono SOLO si la página se descarga de verdad (cerrar pestaña/app).
  // Ya no se cierra al bloquear la pantalla o cambiar de app: las sesiones que
  // quedan abiertas se cierran al iniciar la siguiente o en el barrido diario.
  useEffect(() => {
    function handlePageHide(e: PageTransitionEvent) {
      if (e.persisted) return   // va al bfcache (puede regresar)
      const sid = sessionIdRef.current
      if (!sid || sessionClosedRef.current || !hasMessagesRef.current) return
      navigator.sendBeacon('/api/patterns', new Blob([JSON.stringify({ sessionId: sid })], { type: 'application/json' }))
    }
    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [])

  // Pantalla encendida mientras la sesión está abierta (Wake Lock; si el navegador no lo soporta, no pasa nada)
  useEffect(() => {
    if (!sessionId || sessionClosed) return
    let activo = true
    async function pedir() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wl = (navigator as any).wakeLock
        if (wl && activo && document.visibilityState === 'visible') wakeLockRef.current = await wl.request('screen')
      } catch { /* sin soporte o sin permiso */ }
    }
    function alVolver() { if (document.visibilityState === 'visible') pedir() }   // se pierde al ocultarse
    pedir()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      activo = false
      document.removeEventListener('visibilitychange', alVolver)
      wakeLockRef.current?.release?.().catch?.(() => {})
      wakeLockRef.current = null
    }
  }, [sessionId, sessionClosed])

  // Hablar con AVI o escucharla cuenta como actividad (temporizador general de 30 min)
  const marcarActividad = useCallback(() => {
    window.dispatchEvent(new Event('avi:actividad'))
  }, [])
  useEffect(() => {
    if (appState === 'idle') return
    marcarActividad()
    const t = setInterval(marcarActividad, 20_000)
    return () => clearInterval(t)
  }, [appState, marcarActividad])

  // Detener la voz que suena ahora (el canal sigue con la siguiente)
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    finishCurrentRef.current?.()
  }, [])

  // Reproducir un texto con Amazon Polly (una sola voz a la vez)
  const playTTS = useCallback(async (text: string) => {
    try {
      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!response.ok) throw new Error('Error TTS')

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      await new Promise<void>((resolve) => {
        let terminado = false
        const terminar = () => {
          if (terminado) return
          terminado = true
          finishCurrentRef.current = null
          URL.revokeObjectURL(audioUrl)
          resolve()
        }
        finishCurrentRef.current = terminar
        audio.onended = terminar
        audio.onerror = terminar
        audio.play()
          .then(() => setAppState('speaking'))
          .catch(terminar)
      })
    } catch {
      /* sin voz: el texto ya está en pantalla */
    } finally {
      setAppState('idle')
    }
  }, [])

  const speak = useCallback((text: string) => {
    // Sesión escrita: sin voz, el texto ya está en pantalla
    if (modoRef.current === 'escrita') {
      setAppState('idle')
      return Promise.resolve()
    }
    const turno = voiceChainRef.current.then(() => playTTS(text))
    voiceChainRef.current = turno.catch(() => {})
    return turno
  }, [playTTS])

  // Generar patrones (cierre técnico)
  const closeSession = useCallback(async (): Promise<boolean> => {
    const sid = sessionIdRef.current
    if (!sid) return false
    setClosing(true)
    try {
      const res = await fetch('/api/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      })
      if (res.ok) setSessionClosed(true)
      return res.ok
    } catch {
      return false
    } finally {
      setClosing(false)
      setAppState('idle')
    }
  }, [])

  /**
   * Cierre ordenado de la sesión.
   *   'avi'      → AVI ya se despidió: el mensaje fijo solo se muestra (no se repite en voz)
   *   'paciente' → presionó "Terminar": el mensaje fijo se dice en voz y se muestra
   *   'tiempo'   → venció el tiempo de espera: en voz y en pantalla
   */
  const finalizarSesion = useCallback(async (motivo: 'avi' | 'paciente' | 'tiempo') => {
    if (finalizandoRef.current || !sessionIdRef.current) return
    finalizandoRef.current = true
    cierrePendienteRef.current = false
    setCierrePendiente(false)
    setAvisoTiempo(null)
    limiteRef.current = null
    try { userStoppedRef.current = true; recognitionRef.current?.stop() } catch { /* sin grabación */ }

    const mensaje = 'Gracias por usar AVI. Recuerda contactar a tu terapeuta personal y haz una cita, o contacta a AVI Acompañamiento por WhatsApp para apoyarte para tener tu cita.'
    setMessages(prev => [...prev, { role: 'assistant', content: mensaje }])
    if (motivo !== 'avi') await speak(mensaje)
    const ok = await closeSession()
    if (!ok) {
      // No se pudo guardar el resumen: se puede volver a intentar con "Terminar la sesión"
      finalizandoRef.current = false
      setErrorMsg('No se pudo guardar tu sesión. Toca "Terminar la sesión" para intentarlo de nuevo.')
    }
  }, [speak, closeSession])

  // Enviar mensaje a Claude y reproducir respuesta; al terminar, aplicar el cierre pendiente
  const sendMessage = useCallback(async (transcript: string) => {
    if (!transcript.trim()) {
      setAppState('idle')
      return
    }

    setMessages(prev => [...prev, { role: 'user', content: transcript }])
    setAppState('processing')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: transcript,
          sessionId: sessionIdRef.current,
          cierreSolicitado: cierrePendienteRef.current,
          modo: modoRef.current,
        }),
      })

      // Al iniciar una sesión el servidor revisa la política de sesiones AVI
      if (response.status === 403) {
        const data = await response.json().catch(() => null)
        setMessages(prev => prev.slice(0, -1))   // quitar el mensaje que no se envió
        if (modoRef.current === 'escrita') setTexto(transcript)
        if (data?.estado) aplicarEstadoSesiones(data.estado)
        setAppState('idle')
        return
      }
      if (!response.ok) throw new Error('Error chat')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullResponse = ''
      let aviSeDespidio = false
      let continuar = false

      // Leer stream de texto
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))
          if (data.error) throw new Error(data.error)
          if (data.text) fullResponse += data.text
          if (data.done) {
            if (data.sessionId) { setSessionId(data.sessionId); sessionIdRef.current = data.sessionId }
            if (data.crisis) setCrisis(true)
            if (data.autoClose) aviSeDespidio = true
            if (data.continuar) continuar = true
          }
        }
      }

      // Limpiar marcadores del texto visible y hablado
      const cleanResponse = fullResponse
        .replace('[SESION_TERMINADA]', '')
        .replace('[CRISIS_DETECTADA]', '')
        .replace('[CONTINUAR_SESION]', '')
        .trim()

      setMessages(prev => [...prev, { role: 'assistant', content: cleanResponse }])

      // AVI siempre termina de hablar antes de cualquier cierre
      await speak(cleanResponse)

      // "Terminar" presionado por error ("no, me equivoqué", "no cierres"...): se sigue normal
      if (continuar) {
        cierrePendienteRef.current = false
        setCierrePendiente(false)
      }

      if (aviSeDespidio) await finalizarSesion('avi')
      else if (cierrePendienteRef.current) await finalizarSesion('paciente')
      else if (cierrePorTiempoRef.current) await finalizarSesion('tiempo')
    } catch (e) {
      setErrorMsg(`Error al conectar con AVI: ${e instanceof Error ? e.message : 'desconocido'}`)
      setAppState('idle')
      if (cierrePendienteRef.current) await finalizarSesion('paciente')
      else if (cierrePorTiempoRef.current) await finalizarSesion('tiempo')
    }
  }, [speak, finalizarSesion])

  // Procesa lo grabado una sola vez (botón, tiempo o respaldo si el navegador no avisa)
  const procesarGrabacion = useCallback(async () => {
    if (grabacionProcesadaRef.current) return
    grabacionProcesadaRef.current = true
    // userStoppedRef se queda en true: si onend llega tarde, no reabre el micrófono
    // Se suman las últimas palabras que el navegador no alcanzó a confirmar
    const transcript = `${transcriptRef.current} ${interimRef.current}`.trim()
    if (transcript) {
      setAppState('processing')
      await sendMessage(transcript)
    } else if (cierrePendienteRef.current) {
      await finalizarSesion('paciente')
    } else if (cierrePorTiempoRef.current) {
      await finalizarSesion('tiempo')
    } else {
      // Silencio: AVI lo dice en voz y NO lo envía (así nunca "responde" a algo que no se dijo)
      const aviso = 'No dijiste nada o no se escuchó nada. Por favor, repítelo.'
      setMessages(prev => [...prev, { role: 'assistant', content: aviso }])
      setErrorMsg('No se escuchó nada. Habla un poco más cerca del micrófono.')
      await speak(aviso)
    }
  }, [sendMessage, finalizarSesion, speak])

  // Termina la grabación a propósito; si el navegador no dispara onend en 2 s, se procesa igual
  const terminarGrabacion = useCallback(() => {
    userStoppedRef.current = true
    try { recognitionRef.current?.stop() } catch { /* ya detenida */ }
    setTimeout(() => { procesarGrabacion() }, 2000)
  }, [procesarGrabacion])

  // Iniciar reconocimiento de voz con Web Speech API
  function startRecording() {
    if (appState !== 'idle') return
    setErrorMsg(null)
    stopAudio()
    transcriptRef.current = ''
    interimRef.current = ''
    grabacionProcesadaRef.current = false
    userStoppedRef.current = false

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setErrorMsg('Tu navegador no soporta reconocimiento de voz. Usa Chrome.')
      return
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'es-MX'
    recognition.continuous = true
    recognition.interimResults = true
    recognitionRef.current = recognition

    recognition.onstart = () => {
      ultimaVozPacienteRef.current = Date.now()
      setAppState('recording')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      // Cualquier palabra reconocida reinicia los 10 min de espera
      ultimaVozPacienteRef.current = Date.now()
      if (limiteRef.current?.tipo === 'escuchando') {
        limiteRef.current = { en: Date.now() + ESPERA_ESCUCHANDO_MS, tipo: 'escuchando' }
        setAvisoTiempo(null)
      }
      marcarActividad()
      let provisional = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcriptRef.current += event.results[i][0].transcript + ' '
        } else {
          provisional += event.results[i][0].transcript
        }
      }
      interimRef.current = provisional
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setErrorMsg('Permite el acceso al micrófono en tu navegador.')
        setAppState('idle')
      }
    }

    recognition.onend = async () => {
      // Pausa larga: el navegador corta el micrófono; se reanuda mientras AVI escucha
      if (!userStoppedRef.current) {
        try { recognition.start() } catch { /* ya destruido */ }
        return
      }
      await procesarGrabacion()
    }

    recognition.start()
  }

  function stopRecording() {
    if (appState !== 'recording') return
    terminarGrabacion()
  }

  // ── Tiempos de espera dentro de una sesión abierta ───────────────────────────
  //   AVI escuchando (grabando): 10 min sin palabras → aviso al 9
  //   AVI esperando que el paciente toque el micrófono: 5 min → aviso al 4
  //   Sesión escrita, AVI esperando: 10 min sin escribir → aviso al 9 (cada tecla reinicia)
  //   Pensando o hablando: sin límite
  useEffect(() => {
    if (!sessionId || sessionClosed || closing || finalizandoRef.current) {
      limiteRef.current = null
      setAvisoTiempo(null)
      return
    }
    vencidoRef.current = false
    setAvisoTiempo(null)
    if (appState === 'recording') {
      limiteRef.current = { en: (ultimaVozPacienteRef.current || Date.now()) + ESPERA_ESCUCHANDO_MS, tipo: 'escuchando' }
    } else if (appState === 'idle') {
      limiteRef.current = modo === 'escrita'
        ? { en: Date.now() + ESPERA_ESCRIBIENDO_MS, tipo: 'escribiendo' }
        : { en: Date.now() + ESPERA_PACIENTE_MS, tipo: 'esperando' }
    } else {
      limiteRef.current = null
    }
  }, [appState, sessionId, sessionClosed, closing, modo])

  // Reloj de 1 s con la hora real (sigue funcionando al regresar de otra app)
  useEffect(() => {
    const t = setInterval(() => {
      const lim = limiteRef.current
      if (!lim || vencidoRef.current) return
      const resta = lim.en - Date.now()
      if (resta <= 0) {
        vencidoRef.current = true
        setAvisoTiempo(null)
        if (lim.tipo === 'escuchando') {
          // Se envía lo grabado, AVI responde y luego cierra
          cierrePorTiempoRef.current = true
          terminarGrabacion()
        } else if (lim.tipo === 'escribiendo' && textoRef.current.trim()) {
          // Se envía lo que alcanzó a escribir, AVI responde y luego cierra
          cierrePorTiempoRef.current = true
          const pendiente = textoRef.current
          setTexto('')
          sendMessage(pendiente)
        } else {
          finalizarSesion('tiempo')
        }
      } else if (resta <= AVISO_ANTES_MS) {
        setAvisoTiempo(lim.tipo === 'escuchando'
          ? 'Si no continúas la conversación en 1 minuto, se cerrará la sesión.'
          : lim.tipo === 'escribiendo'
            ? 'Si no continúas escribiendo en 1 minuto, se cerrará la sesión.'
            : 'Si no retomas la conversación en 1 minuto, se cerrará la sesión.')
      }
    }, 1000)
    return () => clearInterval(t)
  }, [terminarGrabacion, finalizarSesion, sendMessage])

  // ── Sesión escrita ───────────────────────────────────────────────────────────
  // Cada tecla cuenta como actividad y reinicia los 10 min sin escribir
  function alEscribir(valor: string) {
    setTexto(valor)
    marcarActividad()
    if (limiteRef.current?.tipo === 'escribiendo' && !vencidoRef.current) {
      limiteRef.current = { en: Date.now() + ESPERA_ESCRIBIENDO_MS, tipo: 'escribiendo' }
      setAvisoTiempo(null)
    }
  }

  function enviarTexto() {
    const mensaje = texto.trim()
    if (!mensaje || appState !== 'idle' || sessionClosed || finalizandoRef.current) return
    setErrorMsg(null)
    setTexto('')
    sendMessage(mensaje)
  }

  // "Terminar la sesión": en orden, sin cortar al paciente ni a AVI
  async function handlePatientClose() {
    if (!sessionIdRef.current || closing || finalizandoRef.current) return
    if (appState === 'idle') {
      await finalizarSesion('paciente')
      return
    }
    // Grabando, pensando o hablando: se cierra cuando termine
    cierrePendienteRef.current = true
    setCierrePendiente(true)
  }

  function cancelarCierre() {
    cierrePendienteRef.current = false
    setCierrePendiente(false)
  }

  const handleMicButton = () => {
    if (appState === 'idle') startRecording()
    else if (appState === 'recording') stopRecording()
    else if (appState === 'speaking') stopAudio()
  }

  // ── Acceso suspendido ────────────────────────────────────────────────────────
  if (accesoSuspendido) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] px-6 text-center space-y-4">
        <div className="text-5xl">🔒</div>
        <h2 className="text-lg font-semibold text-gray-700">Acceso suspendido</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Para continuar usando AVI, solicita una nueva Sesión Presencial con tu Asesor y coméntale en la cita.
        </p>
      </div>
    )
  }

  const hasPendientes = pendientes.length > 0
  // Antes de iniciar: ¿hablada o escrita? (una vez iniciada la sesión ya no cambia)
  const mostrarEleccion = !modoConfirmado && !sessionId && messages.length === 0 && !limitAlcanzado
  const enEscrito = modoConfirmado && modo === 'escrita' && (!limitAlcanzado || !!sessionId)
  const sesionesDisponibles = limiteActual !== null && !sessionId
    ? <>Sesiones AVI disponibles: {Math.max(0, limiteActual - sesionesUsadas)} de {limiteActual}</>
    : null

  // Mensaje de cierre (sesión hablada y escrita)
  const bloqueCierre = (
    <div className="text-center max-w-xs space-y-3 px-2">
      <p className="text-sm text-blue-600 leading-relaxed">
        Te invitamos a contactar a <strong>TU TERAPEUTA</strong> personal o contacta por WhatsApp a <strong>AVI Acompañamiento</strong> para apoyarte a obtener tu cita.
      </p>
      <a
        href={`https://wa.me/523318830312?text=${encodeURIComponent('Apóyenme para tener una cita con un terapeuta. Mi nombre es: ')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors w-full justify-center"
      >
        💬 Contactar por WhatsApp
      </a>
      <p className="text-xs text-blue-400">
        ✓ Sesión guardada — ve a <strong>&quot;Resumen&quot;</strong> para ver una propuesta de cómo verte
      </p>
    </div>
  )


  return (
    // Escrita: dvh = alto visible real del teléfono (la caja para escribir no queda tapada)
    <div className={`flex flex-col ${enEscrito ? 'h-[calc(100dvh-120px)]' : 'h-[calc(100vh-120px)]'} relative`}>

      {/* Pantalla de crisis — overlay total */}
      {crisis && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-6 text-center space-y-6">
          <div className="text-5xl">🆘</div>
          <h2 className="text-xl font-bold text-red-700">Necesitas apoyo ahora</h2>
          <p className="text-gray-700 text-sm leading-relaxed max-w-xs">
            Lo que describes merece atención especializada de inmediato.
            Por favor llama ahora a la <strong>Línea de la Vida</strong> — es gratuita, confidencial y disponible las 24 horas.
          </p>
          <a
            href="tel:8009112000"
            className="w-full max-w-xs py-5 bg-red-600 hover:bg-red-700 text-white text-xl font-bold
                       rounded-2xl flex items-center justify-center gap-3 shadow-lg transition-colors"
          >
            📞 800 911 2000
          </a>
          <p className="text-xs text-gray-400 max-w-xs">
            También puedes escribirle a tu terapeuta o ir a urgencias de tu hospital más cercano.
          </p>
          <button
            onClick={() => setCrisis(false)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Entendido, ya estoy seguro/a
          </button>
        </div>
      )}

      {/* ── SECCIÓN AVI — 80% (o 100% si no hay pendientes) ── */}
      <div className={`flex flex-col relative ${hasPendientes ? 'flex-[4]' : 'flex-1'} overflow-hidden`}>
        {enEscrito ? (
          <>
            {/* Barra superior: modo + Terminar (compacto, en negro) */}
            <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-gray-100">
              <span className="text-xs text-gray-400">⌨️ Escrita</span>
              {messages.length > 0 && !sessionClosed && (
                <div className="flex items-center gap-3">
                  {/* Presionó "Terminar" por error: puede cancelarlo (AVI también lo detecta si lo escribe) */}
                  {cierrePendiente && !closing && (
                    <button onClick={cancelarCierre} className="text-xs text-primary-600 hover:underline">
                      No, quiero seguir
                    </button>
                  )}
                  <button
                    onClick={handlePatientClose}
                    disabled={closing || !sessionId || cierrePendiente}
                    className="px-3 py-1.5 rounded-xl border-2 border-gray-900 text-gray-900 font-semibold text-xs
                               bg-white hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {closing ? 'Generando tu resumen...' : cierrePendiente ? 'Cerrando al terminar…' : '⏹ Terminar'}
                  </button>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="mx-4 mt-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700 flex justify-between items-start gap-2">
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} className="text-amber-400 hover:text-amber-600 flex-shrink-0">✕</button>
              </div>
            )}

            {/* Conversación (baja sola al mensaje más nuevo) */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center pt-10 space-y-2">
                  <p className="text-2xl font-semibold text-gray-700">Hola, estoy aquí</p>
                  <p className="text-gray-600 text-sm max-w-xs mx-auto leading-relaxed">
                    Escríbeme cómo te sientes. Te leo con calma.
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-tr-sm'
                      : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {appState === 'processing' && (
                <p className="text-xs text-gray-400 px-1">AVI está escribiendo…</p>
              )}
              {sessionClosed && <div className="flex justify-center pt-2">{bloqueCierre}</div>}
              <div ref={bottomRef} />
            </div>

            {/* Aviso 1 minuto antes del cierre por tiempo */}
            {avisoTiempo && !sessionClosed && (
              <div className="mx-4 mb-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2 text-center">
                <p className="text-sm font-semibold text-amber-700">¿Sigues ahí?</p>
                <p className="text-xs text-amber-700 mt-0.5">{avisoTiempo}</p>
              </div>
            )}

            {/* Caja para escribir + Enviar (crece hasta 4 líneas) */}
            {!sessionClosed && (
              <div className="border-t border-gray-100 bg-white px-3 pt-1.5 pb-2">
                <p className="text-xs text-gray-500 text-center mb-1.5">
                  AVI no reemplaza a tu terapeuta{sesionesDisponibles && <> · {sesionesDisponibles}</>}
                </p>
                <div className="flex items-end gap-2">
                  <textarea
                    ref={cajaTextoRef}
                    value={texto}
                    onChange={e => alEscribir(e.target.value)}
                    rows={1}
                    placeholder="Escribe aquí..."
                    className="flex-1 resize-none rounded-2xl border-2 border-gray-400 bg-white px-4 py-2.5 text-base leading-snug
                               text-gray-900 placeholder:text-gray-500 max-h-28 overflow-y-hidden
                               focus:outline-none focus:border-primary-500"
                  />
                  <button
                    onClick={enviarTexto}
                    disabled={!texto.trim() || appState !== 'idle' || closing}
                    aria-label="Enviar"
                    className="w-11 h-11 rounded-full bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center
                               flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.4 20.4 21 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87z" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>

          {/* Barra superior */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <button
              onClick={() => setShowTranscript(v => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showTranscript ? 'Ocultar texto' : 'Ver conversación'}
            </button>
          </div>

          {/* Error visible */}
          {errorMsg && (
            <div className="mx-4 mt-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700 flex justify-between items-start gap-2">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="text-amber-400 hover:text-amber-600 flex-shrink-0">✕</button>
            </div>
          )}

          {/* Transcripción (opcional) */}
          {showTranscript && messages.length > 0 && (
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-tr-sm'
                      : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Área principal de voz */}
          <div className={`flex flex-col items-center justify-center gap-6 px-8
            ${showTranscript && messages.length > 0 ? 'py-4' : 'flex-1'}`}>
            {/* ¿Hablada o escrita? Se marca lo que eligió la última vez */}
            {mostrarEleccion ? (
              <div className="flex flex-col items-center gap-4 w-full max-w-xs text-center">
                <p className="text-2xl font-semibold text-gray-700 mb-2">¿Cómo quieres platicar hoy?</p>
                {(['hablada', 'escrita'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setModo(m)}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 transition-colors
                      ${modo === m ? 'border-primary-600 bg-primary-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                  >
                    <span className="flex items-center gap-3 text-base font-medium text-gray-800">
                      <span className="text-2xl">{m === 'hablada' ? '🎙️' : '⌨️'}</span>
                      {m === 'hablada' ? 'Hablada' : 'Escrita'}
                    </span>
                    <span className={`w-5 h-5 rounded-full border-2 ${modo === m ? 'border-primary-600 bg-primary-600' : 'border-gray-300'}`} />
                  </button>
                ))}
                <button
                  onClick={() => { guardarModoElegido(modo); setModoConfirmado(true) }}
                  className="w-full mt-2 py-3.5 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
                >
                  Empezar
                </button>
                <p className="text-xs text-gray-300">
                  AVI no reemplaza a tu terapeuta{sesionesDisponibles && <> · {sesionesDisponibles}</>}
                </p>
              </div>
            ) : (
            <>

            {/* Sin sesiones AVI disponibles */}
            {limitAlcanzado && !sessionId && motivoLimite === 'limite' && (
              <div className="flex flex-col items-center gap-4 text-center max-w-xs">
                <div className="text-5xl">🌙</div>
                <h3 className="text-lg font-semibold text-gray-700">Usaste tus sesiones AVI</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Usaste tus {limiteActual} sesiones AVI. Se renuevan en tu próxima sesión presencial con tu terapeuta.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 w-full">
                  <p className="text-sm text-blue-700 leading-relaxed">
                    Mientras tanto, contacta a <strong>TU TERAPEUTA</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Terapeuta sin plan o sin cupo: el paciente le avisa */}
            {limitAlcanzado && !sessionId && motivoLimite === 'sin_cupo' && (
              <div className="flex flex-col items-center gap-4 text-center max-w-xs">
                <div className="text-5xl">⏸️</div>
                <h3 className="text-lg font-semibold text-gray-700">AVI no está disponible por ahora</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Tu acceso a AVI está en pausa. Avísale a <strong>TU TERAPEUTA</strong> para que lo reactive.
                </p>
              </div>
            )}

            {/* Indicador de estado visual */}
            {(!limitAlcanzado || sessionId) && (
              <div className="text-center space-y-2">
                {messages.length === 0 && (
                  <>
                    <p className="text-2xl font-semibold text-gray-700">Hola, estoy aquí</p>
                    <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
                      Toca el botón y cuéntame cómo te sientes. No hay nada que escribir.
                    </p>
                  </>
                )}
                {messages.length > 0 && (
                  <p className="text-sm text-gray-500">{STATE_LABELS[appState]}</p>
                )}
              </div>
            )}

            {/* Botón de micrófono */}
            {(!limitAlcanzado || sessionId) && (
              <div className="relative flex items-center justify-center">
                {appState === 'recording' && (
                  <>
                    <div className="absolute w-40 h-40 rounded-full bg-red-200 animate-ping opacity-30" />
                    <div className="absolute w-32 h-32 rounded-full bg-red-300 animate-pulse opacity-40" />
                  </>
                )}
                {appState === 'speaking' && (
                  <div className="absolute w-36 h-36 rounded-full bg-calm-200 animate-pulse opacity-50" />
                )}

                <button
                  onClick={handleMicButton}
                  disabled={appState === 'processing' || sessionClosed}
                  className={`relative w-28 h-28 rounded-full shadow-lg transition-all duration-200
                             flex items-center justify-center text-white
                             ${sessionClosed ? 'bg-primary-600 opacity-60 cursor-not-allowed' : STATE_COLORS[appState]}`}
                >
                  {appState === 'idle' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                  {appState === 'recording' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  )}
                  {appState === 'processing' && (
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                  {appState === 'speaking' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072" />
                    </svg>
                  )}
                </button>
              </div>
            )}

            {/* Mensaje de cierre */}
            {sessionClosed && bloqueCierre}

            {/* Etiqueta de estado */}
            {(!limitAlcanzado || sessionId) && !sessionClosed && (
              <p className="text-sm text-gray-400 text-center">
                {appState === 'idle' && messages.length === 0 && 'Toca el micrófono para empezar'}
                {appState === 'idle' && messages.length > 0 && 'Toca para responder'}
                {appState === 'recording' && (cierrePendiente
                  ? 'Termina de hablar y toca el botón; después cerraremos la sesión.'
                  : 'Toca el botón para terminar')}
                {appState === 'processing' && 'AVI está pensando...'}
                {appState === 'speaking' && 'Toca para interrumpir'}
              </p>
            )}

            {/* Aviso 1 minuto antes del cierre por tiempo */}
            {avisoTiempo && !sessionClosed && (
              <div className="w-full max-w-xs bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-center">
                <p className="text-sm font-semibold text-amber-700">¿Sigues ahí?</p>
                <p className="text-xs text-amber-700 mt-0.5">{avisoTiempo}</p>
              </div>
            )}

            {(!limitAlcanzado || sessionId) && !sessionClosed && (
              <p className="text-xs text-gray-300 text-center">
                AVI no reemplaza a tu terapeuta
                {limiteActual !== null && !sessionId && (
                  <> · Sesiones AVI disponibles: {Math.max(0, limiteActual - sesionesUsadas)} de {limiteActual}</>
                )}
              </p>
            )}

            {/* Botón Terminar sesión */}
            {messages.length > 0 && !sessionClosed && (
              <>
              <button
                onClick={handlePatientClose}
                disabled={closing || !sessionId || cierrePendiente}
                className="w-full max-w-xs py-3.5 rounded-2xl border-2 border-gray-900
                           text-gray-900 font-semibold text-sm bg-white hover:bg-gray-100
                           transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {closing ? 'Generando tu resumen...' : cierrePendiente ? 'Cerrando al terminar…' : '⏹ Terminar la sesión'}
              </button>
              {/* Presionó "Terminar" por error: puede cancelarlo (AVI también lo detecta si lo dice) */}
              {cierrePendiente && !closing && (
                <button onClick={cancelarCierre} className="text-xs text-primary-600 hover:underline">
                  No, quiero seguir
                </button>
              )}
              </>
            )}
            </>
            )}
          </div>
          </>
        )}
      </div>

      {/* ── SECCIÓN PENDIENTES — 20% (solo si hay cuestionarios asignados) ── */}
      {hasPendientes && (
        <div className="flex-[1] border-t border-gray-100 bg-white px-4 py-3 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Tu terapeuta te pide completar
          </p>
          <div className="space-y-2">
            {pendientes.map(p => (
              <Link
                key={p.id}
                href={`/patient/cuestionario/${p.id}`}
                className="flex items-center justify-between bg-indigo-50 border border-indigo-200
                           rounded-xl px-4 py-3 hover:bg-indigo-100 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-indigo-800">{p.title}</p>
                  <p className="text-xs text-indigo-500 mt-0.5">
                    Asignado {new Date(p.assigned_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <span className="text-indigo-400 text-lg">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
