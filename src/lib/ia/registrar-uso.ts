import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Medición real del costo de IA (19 oct 2026): guarda en ia_uso los tokens que Anthropic
 * reporta en cada respuesta (`usage`). No cuesta tokens; se guarda con after() al terminar
 * la petición para no retrasar la respuesta. Un error aquí nunca interrumpe el análisis.
 */
export interface UsoAnthropic {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

export function registrarUso(
  tipo: string,
  modelo: string,
  usage: UsoAnthropic | null | undefined,
  ids: { therapistId?: string | null; patientId?: string | null } = {},
) {
  if (!usage) return
  const registrar = async () => {
    const { error } = await createAdminClient().from('ia_uso').insert({
      tipo,
      modelo,
      therapist_id:       ids.therapistId ?? null,
      patient_id:         ids.patientId ?? null,
      input_tokens:       usage.input_tokens ?? 0,
      output_tokens:      usage.output_tokens ?? 0,
      cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_tokens:  usage.cache_read_input_tokens ?? 0,
    })
    if (error) console.error('[ia_uso] No se pudo registrar', tipo, error.message)
  }
  try {
    after(registrar)
  } catch {
    // Fuera de una petición (p. ej. dentro de otro after() o un script): registrar directo
    void registrar()
  }
}
