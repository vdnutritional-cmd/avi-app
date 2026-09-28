import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { retrieveChunksByProfile } from '@/lib/rag/retrieve-chunks'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function extractText(content: Anthropic.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === 'text' && block.text.trim().length > 0) return block.text.trim()
  }
  return ''
}

// ── POST /api/session-insights ─────────────────────────────────────────────
// type: 'emociones' | 'recursos'
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { type, patientId, sessionDesarrollo, sessionNotes: sessionObservaciones, sessionObjetivo } = body

    if (!type || !patientId) {
      return NextResponse.json({ error: 'Faltan parámetros: type y patientId' }, { status: 400 })
    }

    // Perfil terapéutico del terapeuta (para RAG)
    const { data: therapistProfile } = await supabase
      .from('profiles')
      .select('therapy_profile')
      .eq('id', user.id)
      .single()
    const therapyProfile = therapistProfile?.therapy_profile ?? 'famsis'

    // ── EMOCIONES IDENTIFICADAS ─────────────────────────────────────────────
    if (type === 'emociones') {
      if (!sessionDesarrollo?.trim()) {
        return NextResponse.json({ error: 'Se requiere el campo "Desarrollo de la sesión" para generar emociones.' }, { status: 400 })
      }

      const fuentesTexto = await retrieveChunksByProfile(sessionDesarrollo.slice(0, 1500), therapyProfile, 8)

      const prompt = [
        'Eres un terapeuta clínico especializado. A continuación se describe el desarrollo de una sesión presencial.',
        'Tu tarea es identificar y listar las emociones que el paciente manifiesta o subyacen en el relato, desde la perspectiva del enfoque terapéutico activo.',
        '',
        '## Desarrollo de la sesión',
        sessionDesarrollo,
        '',
        sessionObjetivo ? `## Objetivo de la sesión\n${sessionObjetivo}` : '',
        '',
        fuentesTexto ? `## Referencia bibliográfica del enfoque\n${fuentesTexto.slice(0, 2000)}` : '',
        '',
        'Redacta en párrafo breve o lista concisa las emociones identificadas en el paciente durante esta sesión.',
        'Sé clínico, preciso y directo. No repitas el relato; solo las emociones y su contexto mínimo.',
      ].filter(Boolean).join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      })

      return NextResponse.json({ resultado: extractText(response.content) })
    }

    // ── RECURSOS PERSONALES ─────────────────────────────────────────────────
    if (type === 'recursos') {
      if (!sessionObservaciones?.trim()) {
        return NextResponse.json({ error: 'Se requiere el campo "Observaciones / Acuerdos / Tareas" para generar recursos personales.' }, { status: 400 })
      }

      // Cargar contexto del paciente: expediente + nota inicial + sesiones previas
      const [expedienteRes, relacionRes, sesionesRes] = await Promise.all([
        supabase.from('patient_expediente').select('*').eq('therapist_id', user.id).eq('patient_id', patientId).maybeSingle(),
        supabase.from('therapist_patients')
          .select('initial_note, initial_note_motivo, initial_note_subyacente, initial_note_premisas, factores_proteccion_sel')
          .eq('therapist_id', user.id).eq('patient_id', patientId).single(),
        supabase.from('therapist_session_notes')
          .select('session_number, session_date, session_objetivo, session_desarrollo, notes')
          .eq('therapist_id', user.id).eq('patient_id', patientId)
          .order('session_number', { ascending: true }),
      ])

      const exp = expedienteRes.data
      const rel = relacionRes.data
      const sesiones = sesionesRes.data ?? []

      // Construir bloque de datos generales del paciente
      const datosGenerales = [
        exp?.asesorado_nombre ? `Nombre: ${exp.asesorado_nombre}` : '',
        exp?.asesorado_edad ? `Edad: ${exp.asesorado_edad}` : '',
        exp?.asesorado_sexo ? `Sexo: ${exp.asesorado_sexo}` : '',
        exp?.asesorado_escolaridad ? `Escolaridad: ${exp.asesorado_escolaridad}` : '',
        exp?.asesorado_ocupacion ? `Ocupación: ${exp.asesorado_ocupacion}` : '',
        exp?.estado_civil ? `Estado civil: ${exp.estado_civil}` : '',
        exp?.tipo_caso ? `Tipo de caso: ${exp.tipo_caso}` : '',
      ].filter(Boolean).join(' | ')

      const notaInicial = [
        rel?.initial_note_motivo ? `Motivo de consulta: ${rel.initial_note_motivo}` : '',
        rel?.initial_note_subyacente ? `Motivo subyacente: ${rel.initial_note_subyacente}` : '',
        rel?.initial_note_premisas ? `Premisas: ${rel.initial_note_premisas}` : '',
        rel?.initial_note ? `Desarrollo inicial: ${rel.initial_note}` : '',
        rel?.factores_proteccion_sel ? `Factores de protección: ${JSON.stringify(rel.factores_proteccion_sel)}` : '',
      ].filter(Boolean).join('\n')

      // Solo las últimas 5 sesiones previas para no saturar el contexto
      const sesionesPrevias = sesiones.slice(-5).map(s =>
        `Sesión ${s.session_number}: Objetivo: ${s.session_objetivo ?? 'n/d'} | Desarrollo: ${(s.session_desarrollo ?? '').slice(0, 300)} | Acuerdos: ${(s.notes ?? '').slice(0, 200)}`
      ).join('\n---\n')

      const ragQuery = `${sessionObservaciones} ${rel?.initial_note_motivo ?? ''}`
      const fuentesTexto = await retrieveChunksByProfile(ragQuery.slice(0, 1500), therapyProfile, 8)

      const prompt = [
        'Eres un terapeuta clínico especializado. Tu tarea es identificar los recursos personales con que cuenta el paciente para llevar a cabo los acuerdos y tareas de la sesión.',
        '',
        datosGenerales ? `## Datos generales del paciente\n${datosGenerales}` : '',
        '',
        notaInicial ? `## Nota inicial\n${notaInicial.slice(0, 1000)}` : '',
        '',
        sesionesPrevias ? `## Sesiones presenciales previas (resumen)\n${sesionesPrevias.slice(0, 1500)}` : '',
        '',
        sessionDesarrollo ? `## Desarrollo de la sesión actual\n${sessionDesarrollo.slice(0, 600)}` : '',
        '',
        `## Observaciones / Acuerdos / Tareas de esta sesión\n${sessionObservaciones}`,
        '',
        fuentesTexto ? `## Referencia bibliográfica del enfoque\n${fuentesTexto.slice(0, 2000)}` : '',
        '',
        'Redacta en párrafo breve o lista concisa los recursos personales (capacidades, habilidades, apoyos, fortalezas, experiencias previas) con que cuenta el paciente para realizar las tareas y acuerdos descritos.',
        'Sé clínico, preciso y fundamentado en los datos del caso. No repitas los acuerdos; describe los recursos.',
      ].filter(Boolean).join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      })

      return NextResponse.json({ resultado: extractText(response.content) })
    }

    return NextResponse.json({ error: `Tipo desconocido: ${type}` }, { status: 400 })

  } catch (err) {
    console.error('[session-insights]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
