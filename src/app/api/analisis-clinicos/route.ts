import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { retrieveChunksFromBooks } from '@/lib/rag/retrieve-chunks'

export const maxDuration = 120

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function extractText(content: Anthropic.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === 'text' && block.text.trim().length > 0) {
      return block.text.trim()
    }
  }
  return ''
}

// ── POST /api/analisis-clinicos ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const { type, patientId, valores, resultados } = body

    if (!type || !patientId) {
      return NextResponse.json({ error: 'Faltan parámetros: type y patientId' }, { status: 400 })
    }

    // ── MCMASTER: Interpretación con RAG ──────────────────────────────────────
    if (type === 'mcmaster_interpretacion') {
      // 1. Nota inicial del paciente
      const { data: relation } = await supabase
        .from('therapist_patients')
        .select('initial_note, initial_note_motivo, initial_note_subyacente, initial_note_premisas')
        .eq('therapist_id', user.id)
        .eq('patient_id', patientId)
        .single()

      if (!relation) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

      const notaInicial = [
        relation.initial_note           ? `DESARROLLO DEL CASO:\n${relation.initial_note}`                         : '',
        relation.initial_note_motivo    ? `MOTIVO DE CONSULTA:\n${relation.initial_note_motivo}`                   : '',
        relation.initial_note_subyacente ? `MOTIVO SUBYACENTE:\n${relation.initial_note_subyacente}`              : '',
        relation.initial_note_premisas  ? `PREMISAS CLÍNICAS:\n${relation.initial_note_premisas}`                  : '',
      ].filter(Boolean).join('\n\n') || '(Sin nota inicial registrada)'

      // 2. Datos expediente para contexto adicional
      const { data: expediente } = await supabase
        .from('patient_expediente')
        .select('tipo_caso, asesorado_nombre')
        .eq('therapist_id', user.id)
        .eq('patient_id', patientId)
        .maybeSingle()

      const nombreAsesorado = expediente?.asesorado_nombre ?? ''
      const tipoCaso = expediente?.tipo_caso ?? ''

      // 3. RAG: recuperar chunks del Modelo McMaster
      const ragQuery = [
        notaInicial.slice(0, 3000),
        valores ? `Valores McMaster obtenidos: ${JSON.stringify(valores)}` : '',
      ].filter(Boolean).join('\n\n')

      const fuentes = await retrieveChunksFromBooks(
        ragQuery,
        ['Modelo McMaster Familias'],
        8
      )

      // 4. Formatear resultados para el prompt
      const FACTORES_LABELS: Record<number, string> = {
        1: 'Involucramiento afectivo funcional',
        2: 'Involucramiento afectivo disfuncional',
        3: 'Patrones de comunicación disfuncional',
        4: 'Patrones de comunicación funcional',
        5: 'Resolución de problemas',
        6: 'Patrones de control de conducta',
      }

      const factoresTexto = resultados
        ? Object.entries(resultados as Record<string, { funcional: number; disfuncional: number } | null>)
            .filter(([, v]) => v !== null)
            .map(([id, v]) => {
              const label = FACTORES_LABELS[Number(id)] ?? `Factor ${id}`
              return `  - ${label}: Funcional ${(v as { funcional: number; disfuncional: number }).funcional}% / Disfuncional ${(v as { funcional: number; disfuncional: number }).disfuncional}%`
            })
            .join('\n')
        : '(Sin resultados calculados)'

      const efResumen = resultados
        ? (() => {
            const vals = Object.values(resultados as Record<string, { funcional: number; disfuncional: number } | null>)
              .filter(Boolean) as { funcional: number; disfuncional: number }[]
            if (vals.length === 0) return ''
            const rf = vals.reduce((s, v) => s + v.funcional, 0) / vals.length
            const rd = vals.reduce((s, v) => s + v.disfuncional, 0) / vals.length
            const eff = (rf + rd) / 2
            return `RF promedio: ${rf.toFixed(1)}% | RD promedio: ${rd.toFixed(1)}% | EFF: ${eff.toFixed(1)}% → ${eff >= 60 ? 'Funcional' : 'Disfuncional'}`
          })()
        : ''

      // 5. Construir prompt
      const prompt = [
        'Eres supervisor clínico especializado en terapia familiar con amplio conocimiento del Modelo McMaster.',
        'Redacta una interpretación clínica de los resultados del Análisis McMaster para este caso.',
        '',
        'INSTRUCCIONES:',
        '- Interpreta cada factor con criterio clínico, no solo como número.',
        '- Señala las áreas de fortaleza y las áreas de riesgo o disfuncionalidad.',
        '- Relaciona los resultados con el contexto del caso (nota inicial).',
        '- Proporciona 2-3 sugerencias de intervención concretas fundamentadas en el Modelo McMaster.',
        '- Lenguaje profesional, directo y clínico. Extiéndete lo necesario para cubrir todos los factores.',
        '- Responde directamente con la interpretación, sin título ni encabezado.',
        '',
        ...(fuentes ? ['FUENTE CLÍNICA (Modelo McMaster de Familias):', fuentes, ''] : []),
        '── DATOS DEL CASO ──',
        nombreAsesorado ? `Asesorado: ${nombreAsesorado}` : '',
        tipoCaso        ? `Tipo de caso: ${tipoCaso}`     : '',
        '',
        '── NOTA INICIAL ──',
        notaInicial,
        '',
        '── RESULTADOS MCMASTER ──',
        factoresTexto,
        ...(efResumen ? ['', efResumen] : []),
      ].filter(v => v !== undefined).join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = extractText(response.content)
      console.log('[mcmaster_interpretacion] stop_reason:', response.stop_reason, '| chars:', text.length)

      if (!text) {
        return NextResponse.json(
          { error: 'El modelo no generó contenido. Verifica que haya información clínica disponible.' },
          { status: 422 }
        )
      }

      return NextResponse.json({ interpretacion: text })
    }

    return NextResponse.json({ error: `Tipo no reconocido: ${type}` }, { status: 400 })

  } catch (error) {
    console.error('[analisis-clinicos] Error general:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
