import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly'

/**
 * POST /api/voice/tts
 * Convierte texto a voz usando Amazon Polly (voz Mia, español mexicano, Neural).
 */

const polly = new PollyClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { text } = await request.json()
    if (!text?.trim()) return NextResponse.json({ error: 'Texto vacío' }, { status: 400 })

    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: 'Mia',
      Engine: 'neural',
      LanguageCode: 'es-MX',
    })

    const response = await polly.send(command)

    if (!response.AudioStream) {
      return NextResponse.json({ error: 'No se recibió audio de Polly' }, { status: 500 })
    }

    // Convertir el stream de Polly a Buffer
    const chunks: Uint8Array[] = []
    for await (const chunk of response.AudioStream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    const audioBuffer = Buffer.concat(chunks)

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Error en /api/voice/tts (Polly):', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
