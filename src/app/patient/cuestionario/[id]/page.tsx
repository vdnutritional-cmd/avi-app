'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FAD_ITEMS } from '@/lib/questionnaires/mcmaster-fad'

interface QuestData {
  id: string
  title: string
  questionnaire_type: string
  status: string
}

const OPCIONES = [
  { value: 1, label: 'Totalmente de acuerdo' },
  { value: 2, label: 'De acuerdo' },
  { value: 3, label: 'En desacuerdo' },
  { value: 4, label: 'Totalmente en desacuerdo' },
]

// Preguntas por página (para no abrumar al paciente)
const POR_PAGINA = 10

export default function CuestionarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [quest, setQuest] = useState<QuestData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [responses, setResponses] = useState<Record<string, number>>({})
  const [pagina, setPagina] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [completado, setCompletado] = useState(false)

  useEffect(() => {
    async function fetchQuest() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth/login'); return }

      const { data, error } = await supabase
        .from('patient_questionnaires')
        .select('id, title, questionnaire_type, status')
        .eq('id', id)
        .eq('patient_id', user.id)
        .single()

      if (error || !data) { setNotFound(true); return }
      if (data.status === 'completed') { setCompletado(true) }
      setQuest(data)
    }
    fetchQuest()
  }, [id, router])

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] px-6 text-center space-y-4">
        <div className="text-5xl">🔍</div>
        <p className="text-gray-600">Cuestionario no encontrado.</p>
        <button onClick={() => router.push('/patient/chat')} className="text-primary-600 text-sm underline">
          Regresar
        </button>
      </div>
    )
  }

  if (completado) {
    return <PantallaGracias onRegresar={() => router.push('/patient/chat')} />
  }

  if (!quest) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <div className="text-gray-400 text-sm">Cargando cuestionario...</div>
      </div>
    )
  }

  // Seleccionar ítems según tipo
  const items = quest.questionnaire_type === 'mcmaster_fad' ? FAD_ITEMS : []
  const totalPaginas = Math.ceil(items.length / POR_PAGINA)
  const itemsPagina = items.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const paginaCompleta = itemsPagina.every(item => responses[String(item.id)] != null)
  const esUltimaPagina = pagina === totalPaginas - 1
  const totalRespondidas = Object.keys(responses).length
  const progreso = Math.round((totalRespondidas / items.length) * 100)

  function setRespuesta(itemId: number, valor: number) {
    setResponses(prev => ({ ...prev, [String(itemId)]: valor }))
  }

  async function handleEnviar() {
    if (!paginaCompleta) return
    if (!esUltimaPagina) {
      setPagina(p => p + 1)
      window.scrollTo(0, 0)
      return
    }

    // Verificar que todas las preguntas están respondidas
    const sinResponder = items.filter(i => responses[String(i.id)] == null)
    if (sinResponder.length > 0) {
      alert(`Faltan ${sinResponder.length} pregunta(s) por responder.`)
      return
    }

    setEnviando(true)
    try {
      const res = await fetch(`/api/patient/questionnaires/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      })
      if (!res.ok) throw new Error('Error al enviar')
      setCompletado(true)
    } catch {
      alert('Hubo un error al enviar tus respuestas. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Encabezado */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <button onClick={() => router.push('/patient/chat')} className="text-xs text-gray-400 mb-2 flex items-center gap-1">
          ← Regresar
        </button>
        <h1 className="text-base font-semibold text-gray-800">{quest.title}</h1>
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>{totalRespondidas} de {items.length} preguntas</span>
            <span>{progreso}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>
      </div>

      {/* Instrucciones — solo en primera página */}
      {pagina === 0 && (
        <div className="mx-4 mt-4 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 text-sm text-indigo-700 leading-relaxed">
          <strong>Instrucciones:</strong> Lee cada enunciado y elige la opción que mejor describe cómo es tu familia en general. No hay respuestas correctas ni incorrectas.
        </div>
      )}

      {/* Preguntas */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {itemsPagina.map((item, idx) => (
          <div key={item.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-4 shadow-sm">
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              <span className="font-semibold text-gray-400 mr-2">{pagina * POR_PAGINA + idx + 1}.</span>
              {item.text}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {OPCIONES.map(op => {
                const seleccionada = responses[String(item.id)] === op.value
                return (
                  <button
                    key={op.value}
                    onClick={() => setRespuesta(item.id, op.value)}
                    className={`text-xs py-2.5 px-3 rounded-xl border transition-all text-left leading-snug
                      ${seleccionada
                        ? 'bg-indigo-600 border-indigo-600 text-white font-medium'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                  >
                    {op.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Navegación */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-4 flex gap-3">
        {pagina > 0 && (
          <button
            onClick={() => { setPagina(p => p - 1); window.scrollTo(0, 0) }}
            className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
          >
            ← Anterior
          </button>
        )}
        <button
          onClick={handleEnviar}
          disabled={!paginaCompleta || enviando}
          className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-semibold
                     hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {enviando
            ? 'Enviando...'
            : esUltimaPagina
              ? 'Enviar cuestionario'
              : `Siguiente (${pagina + 1}/${totalPaginas})`
          }
        </button>
      </div>
    </div>
  )
}

function PantallaGracias({ onRegresar }: { onRegresar: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] px-6 text-center space-y-6">
      <div className="text-6xl">🙏</div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-gray-800">¡Gracias por completarlo!</h2>
        <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
          Tu terapeuta recibirá los resultados y los revisará en tu próxima sesión.
        </p>
      </div>
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-4 max-w-xs w-full">
        <p className="text-indigo-700 text-sm leading-relaxed">
          Tus respuestas han sido enviadas de forma segura y confidencial.
        </p>
      </div>
      <button
        onClick={onRegresar}
        className="py-3 px-8 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-2xl transition-colors text-sm"
      >
        Regresar a AVI
      </button>
    </div>
  )
}
