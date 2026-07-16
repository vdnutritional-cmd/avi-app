'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Primera semana de uso: 3 sesiones. Semanas siguientes: 2 sesiones.
const LIMITE_PRIMERA_SEMANA = 3
const LIMITE_SESIONES_SEMANA = 2

type AppState =
  | 'idle'        // Esperando que el paciente hable
  | 'recording'   // Grabando voz del paciente
  | 'processing'  // Transcribiendo + enviando a Claude
  | 'speaking'    // AVI está hablando

interface Message {
  role: 'user' | 'assistant'
  content: string
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

  // Verificar límite de sesiones esta semana
  useEffect(() => {
    async function checkLimite() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const hace7dias = new Date()
      hace7dias.setDate(hace7dias.getDate() - 6)
      hace7dias.setHours(0, 0, 0, 0)

      // Sesiones usadas en los últimos 7 días
      const { count } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', user.id)
        .gte('started_at', hace7dias.toISOString())

      // Verificar si están dentro de los primeros 7 días desde el registro
      const { data: consent } = await supabase
        .from('patient_consents')
        .select('informed_consent_at')
        .eq('patient_id', user.id)
        .single()

      const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000
      const esPrimeraSemana = consent?.informed_consent_at
        ? (Date.now() - new Date(consent.informed_consent_at).getTime()) < SIETE_DIAS_MS
        : false

      const limite = esPrimeraSemana ? LIMITE_PRIMERA_SEMANA : LIMITE_SESIONES_SEMANA

      const usadas = count ?? 0
      setSesionesUsadas(usadas)
      setLimiteActual(limite)
      if (usadas >= limite) setLimitAlcanzado(true)
    }
    checkLimite()
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
  const [limiteActual, setLimiteActual] = useState(LIMITE_SESIONES_SEMANA)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef<string>('')   // Acumula el texto mientras el usuario habla
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Refs para acceder a valores actuales desde event listeners (evitan closures obsoletos)
  const sessionIdRef = useRef<string | null>(null)
  const sessionClosedRef = useRef(false)
  const hasMessagesRef = useRef(false)

  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])
  useEffect(() => { sessionClosedRef.current = sessionClosed }, [sessionClosed])
  useEffect(() => { hasMessagesRef.current = messages.length > 0 }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cierre automático por abandono — sendBeacon sobrevive el cierre de app/pestaña
  useEffect(() => {
    function dispararCierre() {
      const sid = sessionIdRef.current
      if (!sid || sessionClosedRef.current || !hasMessagesRef.current) return
      const payload = new Blob(
        [JSON.stringify({ sessionId: sid })],
        { type: 'application/json' }
      )
      navigator.sendBeacon('/api/patterns', payload)
    }

    function handleVisibility() {
      if (document.visibilityState === 'hidden') dispararCierre()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', dispararCierre)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', dispararCierre)
    }
  }, [])

  // Detener audio si está sonando
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [])

  // Reproducir respuesta de AVI con ElevenLabs
  const speakResponse = useCallback(async (text: string) => {
    // Se mantiene en 'processing' (amarillo) mientras descarga el audio
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

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        setAppState('idle')
      }
      audio.onerror = () => {
        setAppState('idle')
      }

      // Solo cambia a azul CUANDO el audio realmente empieza
      await audio.play()
      setAppState('speaking')
    } catch {
      setAppState('idle')
    }
  }, [])

  // Enviar mensaje a Claude y reproducir respuesta
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
        body: JSON.stringify({ message: transcript, sessionId }),
      })

      if (!response.ok) throw new Error('Error chat')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullResponse = ''
      let shouldAutoClose = false

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
            if (data.sessionId) setSessionId(data.sessionId)
            if (data.crisis) setCrisis(true)
            if (data.autoClose) shouldAutoClose = true
          }
        }
      }

      // Limpiar marcadores del texto visible y hablado
      const cleanResponse = fullResponse
        .replace('[SESION_TERMINADA]', '')
        .replace('[CRISIS_DETECTADA]', '')
        .trim()

      // Agregar respuesta al transcript visual
      setMessages(prev => [...prev, { role: 'assistant', content: cleanResponse }])

      // Reproducir con ElevenLabs
      await speakResponse(cleanResponse)

      // Si AVI cerró la sesión, siempre decir el mensaje del terapeuta antes de cerrar
      if (shouldAutoClose) {
        await speakMensajeCierre()
        await closeSession()
      }

    } catch (e) {
      setErrorMsg(`Error al conectar con AVI: ${e instanceof Error ? e.message : 'desconocido'}`)
      setAppState('idle')
    }
  }, [sessionId, speakResponse])

  // Iniciar reconocimiento de voz con Web Speech API (gratuito, nativo del navegador)
  // continuous = true: sigue escuchando hasta que el usuario presione el botón de parar
  function startRecording() {
    if (appState !== 'idle') return
    setErrorMsg(null)
    stopAudio()
    transcriptRef.current = ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setErrorMsg('Tu navegador no soporta reconocimiento de voz. Usa Chrome.')
      return
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'es-MX'
    recognition.continuous = true      // No se detiene solo — espera al botón
    recognition.interimResults = true  // Muestra texto mientras habla (opcional)
    recognitionRef.current = recognition

    recognition.onstart = () => setAppState('recording')

    // Acumula solo los resultados finales (no los intermedios)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcriptRef.current += event.results[i][0].transcript + ' '
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setErrorMsg('Permite el acceso al micrófono en tu navegador.')
        setAppState('idle')
      }
      // Otros errores (no-speech, network) los ignoramos en modo continuo
    }

    // onend se dispara cuando el usuario presiona parar (stopRecording llama a recognition.stop())
    recognition.onend = async () => {
      const transcript = transcriptRef.current.trim()
      if (transcript) {
        setAppState('processing')
        await sendMessage(transcript)
      } else {
        setErrorMsg('No escuché nada. Intenta hablar más cerca del micrófono.')
        setAppState('idle')
      }
    }

    recognition.start()
  }

  // Detener reconocimiento — el usuario presiona el botón cuando termina de hablar
  function stopRecording() {
    if (appState !== 'recording') return
    recognitionRef.current?.stop()
    // No cambiamos a 'processing' aquí — onend lo hace después de recopilar el transcript
  }

  // Mensaje de cierre garantizado — siempre se dice al terminar, sin excepción
  const speakMensajeCierre = useCallback(async () => {
    const mensaje = 'Gracias por usar AVI. Recuerda contactar a tu terapeuta personal o llama a VALORA al 33 1363 0266 y solicita una cita.'
    setMessages(prev => [...prev, { role: 'assistant', content: mensaje }])
    await speakResponse(mensaje)
  }, [speakResponse])

  // Generar patrones (cierre técnico)
  async function closeSession() {
    if (!sessionId || closing) return
    setClosing(true)
    try {
      const res = await fetch('/api/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (res.ok) setSessionClosed(true)
    } finally {
      setClosing(false)
      setAppState('idle')  // siempre regresa al botón lila al cerrar
    }
  }

  // Cierre iniciado por el paciente — mensaje garantizado, luego cierra
  async function handlePatientClose() {
    if (!sessionId || closing) return
    stopAudio()
    setAppState('processing')
    await speakMensajeCierre()
    await closeSession()
  }

  const handleMicButton = () => {
    if (appState === 'idle') startRecording()
    else if (appState === 'recording') stopRecording()
    else if (appState === 'speaking') {
      stopAudio()
      setAppState('idle')
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] relative">

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

      {/* Pantalla de crisis — cubre todo y detiene la sesión */}
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

          <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
            Si deseas continuar cuando estés más tranquilo/a, puedes regresar a AVI después.
          </p>

          <button
            onClick={() => setCrisis(false)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Entendido, ya estoy seguro/a
          </button>
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
      <div className={`flex flex-col items-center justify-center gap-8 px-8
        ${showTranscript && messages.length > 0 ? 'py-6' : 'flex-1'}`}>

        {/* Límite de sesiones alcanzado */}
        {limitAlcanzado && !sessionId && (
          <div className="flex flex-col items-center gap-4 text-center max-w-xs">
            <div className="text-5xl">🌙</div>
            <h3 className="text-lg font-semibold text-gray-700">Has llegado a tu límite semanal</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Usaste tus {limiteActual} sesiones de esta semana. Regresa el próximo lunes para continuar con AVI.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 w-full">
              <p className="text-sm text-blue-700 leading-relaxed">
                Mientras tanto, contacta a <strong>TU TERAPEUTA</strong> o llama a <strong>VALORA</strong> al <strong>33 1363 0266</strong>
              </p>
            </div>
            <p className="text-xs text-gray-300">
              Sesiones esta semana: {sesionesUsadas} / {limiteActual}
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

        {/* Botón de micrófono — oculto si límite alcanzado y no hay sesión activa */}
        {(!limitAlcanzado || sessionId) && (
        <div className="relative flex items-center justify-center">
          {/* Anillo animado cuando graba */}
          {appState === 'recording' && (
            <>
              <div className="absolute w-40 h-40 rounded-full bg-red-200 animate-ping opacity-30" />
              <div className="absolute w-32 h-32 rounded-full bg-red-300 animate-pulse opacity-40" />
            </>
          )}
          {/* Anillo cuando AVI habla */}
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

        {/* Mensaje de cierre — reemplaza etiqueta de estado cuando termina la sesión */}
        {sessionClosed && (
          <div className="text-center max-w-xs space-y-2 px-2">
            <p className="text-sm text-blue-600 leading-relaxed">
              Te invitamos a contactar a <strong>TU TERAPEUTA</strong> personal<br />
              o llama a <strong>VALORA</strong> al <strong>33 1363 0266</strong> y solicita una cita.
            </p>
            <p className="text-xs text-blue-400">
              ✓ Sesión guardada — ve a <strong>&quot;Reformúlate&quot;</strong> para ver una propuesta de cómo verte
            </p>
          </div>
        )}

        {/* Etiqueta de estado — solo cuando la sesión está activa */}
        {(!limitAlcanzado || sessionId) && !sessionClosed && (
        <p className="text-sm text-gray-400 text-center">
          {appState === 'idle' && messages.length === 0 && 'Toca el micrófono para empezar'}
          {appState === 'idle' && messages.length > 0 && 'Toca para responder'}
          {appState === 'recording' && 'Toca el botón para terminar'}
          {appState === 'processing' && 'AVI está pensando...'}
          {appState === 'speaking' && 'Toca para interrumpir'}
        </p>
        )}

        {(!limitAlcanzado || sessionId) && !sessionClosed && (
        <p className="text-xs text-gray-300 text-center">
          AVI no reemplaza a tu terapeuta
        </p>
        )}

        {/* Botón Terminar sesión — visible solo cuando hay conversación */}
        {messages.length > 0 && !sessionClosed && (
          <button
            onClick={handlePatientClose}
            disabled={closing || !sessionId || appState === 'processing'}
            className="w-full max-w-xs py-3.5 rounded-2xl border-2 border-red-300
                       text-red-500 font-semibold text-sm bg-red-50 hover:bg-red-100
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {closing ? 'Generando tu resumen...' : '⏹ Terminar la sesión'}
          </button>
        )}
      </div>
    </div>
  )
}
