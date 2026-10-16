'use client'

// ─────────────────────────────────────────────────────────────
// Palabra del menú del terapeuta para sus pantallas generales (cliente).
// La calcula therapist/layout.tsx (getTerminologiaTerapeuta) y la reparte aquí,
// así las pantallas no consultan al servidor ni muestran un instante otra palabra.
// Política: src/lib/terminologia-paciente.ts · Inventario de Terminología, página 8.
// ─────────────────────────────────────────────────────────────
import { createContext, useContext } from 'react'
import { terminos, TERMINOLOGIA_SIN_EMPRESA, type Terminologia } from '@/lib/terminologia'

const TerminologiaMenuContext = createContext<Terminologia>(TERMINOLOGIA_SIN_EMPRESA)

export function TerminologiaMenuProvider({ terminologia, children }: { terminologia: Terminologia; children: React.ReactNode }) {
  return <TerminologiaMenuContext.Provider value={terminologia}>{children}</TerminologiaMenuContext.Provider>
}

/** Las 12 palabras del menú del terapeuta: w.user, w.Users, w.pro… */
export function useTerminologiaMenu() {
  return terminos(useContext(TerminologiaMenuContext))
}

/** La terminología misma ('paciente' | 'asesorado'), p. ej. para buildReportHeader */
export function useTerminologiaMenuValor(): Terminologia {
  return useContext(TerminologiaMenuContext)
}
