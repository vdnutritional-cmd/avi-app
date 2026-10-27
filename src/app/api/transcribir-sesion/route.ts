import { NextRequest, NextResponse } from 'next/server'
import { logApiAccess } from '@/lib/audit/log-access'
import { autorizarTerapeuta } from './autorizar'

// ─────────────────────────────────────────────────────────────
// POST /api/transcribir-sesion — Sprint 13 (27 oct 2026)
// FormData { audio: Blob (WebM/Opus o MP4 en iPhone), patientId? } → { texto }
// Transcribe UN tramo de la grabación con Groq Whisper (whisper-large-v3, español).
// La grabación llega en tramos de ~4 min porque Vercel no acepta peticiones de más de 4.5 MB;
// el resumen se pide después a /api/transcribir-sesion/resumen con todo el texto.
// El audio no se guarda: solo pasa por aquí hacia Groq.
// ─────────────────────────────────────────────────────────────
export const maxDuration = 60

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MAX_BYTES = 4 * 1024 * 1024 + 400 * 1024   // margen bajo el límite de 4.5 MB de Vercel

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
    return NextResponse.json({ error: 'Falta configurar GROQ_API_KEY.' }, { status: 500 })
  }

  const ext = audio.type.includes('mp4') ? 'mp4' : 'webm'
  const envio = new FormData()
  envio.append('file', audio, `sesion.${ext}`)
  envio.append('model', 'whisper-large-v3')
  envio.append('language', 'es')
  envio.append('response_format', 'json')

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: envio,
  })
  if (!res.ok) {
    console.error('[transcribir-sesion] Groq', res.status, await res.text().catch(() => ''))
    return NextResponse.json({ error: 'No se pudo transcribir el audio.' }, { status: 502 })
  }
  const { text } = await res.json() as { text?: string }

  logApiAccess(auth.supabase, auth.user.id, '/api/transcribir-sesion', 'POST', { patientId, bytes: audio.size })
  return NextResponse.json({ texto: (text ?? '').trim() })
}
