import { NextRequest, NextResponse } from 'next/server'
import { logApiAccess } from '@/lib/audit/log-access'
import { registrarUsoAudio } from '@/lib/ia/registrar-uso'
import { avisarFallaServicioIA, type MotivoFalla } from '@/lib/ia/alerta-servicio'
import { autorizarTerapeuta } from './autorizar'

// ─────────────────────────────────────────────────────────────
// POST /api/transcribir-sesion — Sprint 13 (27 oct 2026)
// FormData { audio: Blob (WebM/Opus o MP4 en iPhone), patientId? } → { texto }
// Transcribe UN tramo de la grabación con Groq Whisper (whisper-large-v3-turbo, español).
// Guarda los segundos de audio en ia_uso (costo real de Groq). Si Groq falla por pago, límite
// o clave, avisa al administrador (correo) y le dice al terapeuta que reintente más tarde.
// La grabación llega en tramos de ~4 min porque Vercel no acepta peticiones de más de 4.5 MB;
// el resumen se pide después a /api/transcribir-sesion/resumen con todo el texto.
// El audio no se guarda: solo pasa por aquí hacia Groq.
// ─────────────────────────────────────────────────────────────
export const maxDuration = 60

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MAX_BYTES = 4 * 1024 * 1024 + 400 * 1024   // margen bajo el límite de 4.5 MB de Vercel
// turbo: ~$0.04 por hora de audio (large-v3: ~$0.111), decisión de José Luis del 27 oct
const MODELO = 'whisper-large-v3-turbo'

/** Por qué rechazó Groq la petición: pago/saldo, límite del plan o clave. null = falla pasajera (red, 5xx…) */
function motivoFalla(status: number, cuerpo: string): MotivoFalla | null {
  const t = cuerpo.toLowerCase()
  if (/billing|payment|credit|balance|spend|insufficient|restricted|suspend|past due/.test(t)) return 'pago'
  if (status === 402) return 'pago'
  if (status === 401) return 'clave'
  if (status === 403) return 'pago'
  if (status === 429) return 'limite'
  return null
}

const MENSAJE_FALLA: Record<MotivoFalla, string> = {
  pago:   'El servicio de transcripción no está disponible por el momento. AVI ya fue avisado; tu grabación se conserva: reintenta más tarde.',
  limite: 'Se alcanzó el límite de transcripción por ahora. Tu grabación se conserva: reintenta en unos minutos.',
  clave:  'El servicio de transcripción no está disponible por el momento. AVI ya fue avisado; tu grabación se conserva: reintenta más tarde.',
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const audio = form?.get('audio')
  const patientId = (form?.get('patientId') as string | null) || null

  const auth = await autorizarTerapeuta(patientId)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: 'Falta el audio.' }, { status: 400 })
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El tramo de audio es demasiado grande.' }, { status: 413 })
  }
  if (!process.env.GROQ_API_KEY) {
    avisarFallaServicioIA('Groq', 'clave', 'Falta GROQ_API_KEY en las variables de entorno')
    return NextResponse.json({ error: MENSAJE_FALLA.clave, servicio: true }, { status: 503 })
  }

  const ext = audio.type.includes('mp4') ? 'mp4' : 'webm'
  const envio = new FormData()
  envio.append('file', audio, `sesion.${ext}`)
  envio.append('model', MODELO)
  envio.append('language', 'es')
  envio.append('response_format', 'verbose_json')   // trae la duración del audio

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: envio,
  })
  if (!res.ok) {
    const cuerpo = await res.text().catch(() => '')
    console.error('[transcribir-sesion] Groq', res.status, cuerpo)
    const motivo = motivoFalla(res.status, cuerpo)
    if (motivo) {
      avisarFallaServicioIA('Groq', motivo, `HTTP ${res.status}: ${cuerpo}`)
      return NextResponse.json({ error: MENSAJE_FALLA[motivo], servicio: true }, { status: 503 })
    }
    return NextResponse.json({ error: 'No se pudo transcribir el audio.' }, { status: 502 })
  }
  const { text, duration } = await res.json() as { text?: string; duration?: number }

  registrarUsoAudio('transcripcion_audio', MODELO, duration, { therapistId: auth.user.id, patientId })
  logApiAccess(auth.supabase, auth.user.id, '/api/transcribir-sesion', 'POST', { patientId, bytes: audio.size, segundos: duration })
  return NextResponse.json({ texto: (text ?? '').trim() })
}
