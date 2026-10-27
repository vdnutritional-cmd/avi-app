import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { logApiAccess } from '@/lib/audit/log-access'
import { registrarUso } from '@/lib/ia/registrar-uso'
import { autorizarTerapeuta } from '../autorizar'

// ─────────────────────────────────────────────────────────────
// POST /api/transcribir-sesion/resumen — Sprint 13 (27 oct 2026)
// JSON { transcripcion, patientId? } → { resumen }
// Resumen clínico de 300 a 400 palabras de la transcripción completa de la sesión.
// ─────────────────────────────────────────────────────────────
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const MODELO = 'claude-sonnet-4-6'

const SYSTEM = 'Eres un asistente clínico. A partir de esta transcripción de sesión terapéutica, redacta un resumen de 300 a 400 palabras. Destaca principalmente las respuestas, emociones y temas relevantes del paciente. No concluyas ni asumas nada solo resume ajustandote a las 300 o 400 palabras y sin truncar tu resumen; es decir que quede completo el resumen ajustado a un máximo de 400 palabras. Usa lenguaje clínico neutro. No incluyas nombres propios.'

export async function POST(req: NextRequest) {
  const { transcripcion, patientId } = await req.json().catch(() => ({}))
  const auth = await autorizarTerapeuta(typeof patientId === 'string' ? patientId : null)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (typeof transcripcion !== 'string' || !transcripcion.trim()) {
    return NextResponse.json({ error: 'No se escuchó nada en la grabación.' }, { status: 400 })
  }

  try {
    const response = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Transcripción de la sesión:\n\n${transcripcion.trim()}` }],
    })
    registrarUso('resumen_transcripcion', MODELO, response.usage, { therapistId: auth.user.id, patientId })
    const resumen = response.content.flatMap(b => b.type === 'text' ? [b.text] : []).join('').trim()
    logApiAccess(auth.supabase, auth.user.id, '/api/transcribir-sesion/resumen', 'POST', { patientId })
    return NextResponse.json({ resumen })
  } catch (e) {
    console.error('[transcribir-sesion/resumen]', e)
    return NextResponse.json({ error: 'No se pudo generar el resumen.' }, { status: 502 })
  }
}
