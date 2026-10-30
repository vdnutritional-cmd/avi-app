'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TERMINOLOGIA_OPCIONES, type Terminologia } from '@/lib/terminologia'

export default function ComoMeNombranForm({ inicial, userId }: { inicial: Terminologia; userId: string }) {
  const router = useRouter()
  const [terminologia, setTerminologia] = useState<Terminologia>(inicial)
  const [guardada, setGuardada] = useState<Terminologia>(inicial)
  const [saving, setSaving]     = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError]       = useState('')

  async function handleSave() {
    setSaving(true); setGuardado(false); setError('')
    const { error: err } = await createClient().from('profiles').update({ terminologia }).eq('id', userId)
    setSaving(false)
    if (err) { setError('No se pudo guardar. Intenta de nuevo.'); return }
    setGuardada(terminologia)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2500)
    router.refresh()   // el menú lateral toma la palabra nueva
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Cómo me nombran</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          Por transparencia y cumplimiento, por favor define cómo deseas que AVI se refiera a ti y a las personas
          que atiendes de forma personal: como Terapeuta y Paciente, como Consultor y Consultante o como Asesor y Asesorado.
        </p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl px-5 py-5 space-y-3 shadow-sm">
        {TERMINOLOGIA_OPCIONES.map(o => (
          <label key={o.valor}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
              terminologia === o.valor ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-200'
            }`}>
            <input type="radio" name="terminologia" checked={terminologia === o.valor}
              onChange={() => setTerminologia(o.valor)} className="accent-purple-700" />
            <span className="text-sm font-medium text-gray-800">{o.nombre}</span>
            <span className="text-xs text-gray-500">({o.ejemplo})</span>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving || terminologia === guardada}
          className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {guardado && <span className="text-sm text-green-600">✓ Guardado</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>

      {/* Política de uso */}
      <div className="bg-primary-50 border border-primary-100 rounded-2xl px-5 py-4 space-y-2">
        <p className="text-sm font-semibold text-primary-700">Política de uso de la terminología</p>
        <ul className="text-xs text-gray-600 leading-relaxed list-disc pl-4 space-y-1">
          <li>
            <strong>Personas de una empresa en Convenio:</strong> usan las palabras que definió su empresa.
            Esta opción define el menú principal.
          </li>
          <li>
            <strong>Personas sin empresa en Convenio y que tú atiendes en lo personal:</strong> usan lo que tú aquí elijas.
          </li>
        </ul>
      </div>
    </div>
  )
}
