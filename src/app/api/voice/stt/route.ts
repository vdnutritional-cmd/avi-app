import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/voice/stt
 * Convierte audio a texto usando ElevenLabs Scribe.
 * Recibe un FormData con el archivo de audio.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio no recibido' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY!

    // Preparar FormData para ElevenLabs Scribe
    const elevenLabsForm = new FormData()
    elevenLabsForm.append('file', audioFile, 'audio.webm')
    elevenLabsForm.append('model_id', 'scribe_v1')
    elevenLabsForm.append('language_code', 'es') // Español para mejor precisión

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: elevenLabsForm,
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('ElevenLabs STT error:', response.status, err)
      return NextResponse.json({ error: `ElevenLabs ${response.status}: ${err}` }, { status: 500 })
    }

    const result = await response.json()
    console.log('ElevenLabs STT result:', JSON.stringify(result))
    const transcript = result.text ?? result.transcript ?? ''

    return NextResponse.json({ transcript })
  } catch (error) {
    console.error('Error en /api/voice/stt:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
