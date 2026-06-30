import { createClient } from '@/lib/supabase/server'

/**
 * Pantalla REFORMULA — muestra las reformulaciones de todas las sesiones.
 * Son frases para llevar: una por sesión, positivas y esperanzadoras.
 */
export default async function ReformulatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patterns } = await supabase
    .from('patterns')
    .select('reformulation, summary, predominant_emotions, created_at')
    .eq('patient_id', user!.id)
    .not('reformulation', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!patterns || patterns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4 pb-20">
        <div className="text-5xl">✨</div>
        <h2 className="text-lg font-semibold text-gray-700">Tus reformulaciones</h2>
        <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
          Después de cada sesión, AVI te dejará una frase para llevar: una nueva manera de ver lo que viviste.
        </p>
        <p className="text-xs text-gray-400">
          Termina una conversación en "Habla" para ver tu primera reformulación aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5 pb-24">
      <div className="pt-2 pb-1">
        <h2 className="text-lg font-semibold text-gray-800">Para llevar</h2>
        <p className="text-sm text-gray-400">Una frase de cada sesión, para recordar</p>
      </div>

      {patterns.map((p, i) => (
        <div key={i} className="space-y-3">
          {/* Frase principal */}
          <div className="bg-gradient-to-br from-primary-50 via-white to-calm-50
                          border border-primary-100 rounded-3xl p-6 shadow-sm">
            <p className="text-xs font-medium text-primary-500 mb-3 uppercase tracking-wide">
              ✨ {new Date(p.created_at).toLocaleDateString('es-MX', {
                day: 'numeric', month: 'long'
              })}
            </p>
            <p className="text-gray-800 text-base leading-relaxed font-medium italic">
              "{p.reformulation}"
            </p>

            {p.predominant_emotions && (p.predominant_emotions as string[]).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {(p.predominant_emotions as string[]).map((e, j) => (
                  <span key={j} className="text-xs bg-white text-calm-600 border border-calm-100 px-3 py-1 rounded-full">
                    {e}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
