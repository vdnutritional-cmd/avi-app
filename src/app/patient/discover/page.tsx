import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

/**
 * Pantalla DESCUBRE — historial de patrones emocionales del paciente.
 * Muestra los resúmenes y patrones generados al cerrar cada sesión.
 */
export default async function DiscoverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patterns } = await supabase
    .from('patterns')
    .select('*')
    .eq('patient_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!patterns || patterns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4 pb-20">
        <div className="text-5xl">🔍</div>
        <h2 className="text-lg font-semibold text-gray-700">Descubre tus patrones</h2>
        <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
          Después de cada conversación con AVI, aquí verás un resumen de cómo te sentiste y los patrones emocionales que surgieron.
        </p>
        <p className="text-xs text-gray-400">
          Inicia una conversación en "Habla" para ver tu primera entrada aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="pt-2 pb-1">
        <h2 className="text-lg font-semibold text-gray-800">Tus sesiones</h2>
        <p className="text-sm text-gray-400">{patterns.length} conversación{patterns.length !== 1 ? 'es' : ''} registrada{patterns.length !== 1 ? 's' : ''}</p>
      </div>

      {patterns.map((p) => (
        <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
          {/* Fecha */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{formatDate(p.created_at)}</span>
            {p.crisis_detected && (
              <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                ⚠️ Conversación importante
              </span>
            )}
          </div>

          {/* Resumen */}
          {p.summary && (
            <div>
              <p className="text-sm text-gray-700 leading-relaxed">{p.summary}</p>
            </div>
          )}

          {/* Emociones predominantes */}
          {p.predominant_emotions && p.predominant_emotions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cómo te sentiste</p>
              <div className="flex flex-wrap gap-2">
                {(p.predominant_emotions as string[]).map((emotion, i) => (
                  <span key={i} className="text-xs bg-calm-50 text-calm-700 border border-calm-100 px-3 py-1 rounded-full">
                    {emotion}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Patrones emocionales */}
          {p.emotional_patterns && p.emotional_patterns.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Patrones detectados</p>
              <div className="flex flex-wrap gap-2">
                {(p.emotional_patterns as string[]).map((pattern, i) => (
                  <span key={i} className="text-xs bg-primary-50 text-primary-700 border border-primary-100 px-3 py-1 rounded-full">
                    {pattern}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reformulación */}
          {p.reformulation && (
            <div className="bg-gradient-to-r from-primary-50 to-calm-50 rounded-xl p-4 border border-primary-100">
              <p className="text-xs font-medium text-primary-600 mb-1">✨ Para llevar</p>
              <p className="text-sm text-gray-700 italic leading-relaxed">"{p.reformulation}"</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
