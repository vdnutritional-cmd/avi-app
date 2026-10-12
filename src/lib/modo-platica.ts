// Modo de platicar con AVI (hablada / escrita) que el paciente ya eligió en este inicio de sesión.
// Se recuerda al ir a "Resumen" y regresar a "Habla"; se olvida al salir
// ("Cerrar sesión", "Salir" o por inactividad) y entonces se vuelve a preguntar.
// Solo navegador: si el almacenamiento no está disponible, simplemente se pregunta de nuevo.
const CLAVE = 'avi_modo_platica'

export type ModoPlatica = 'hablada' | 'escrita'

export function leerModoElegido(): ModoPlatica | null {
  try {
    const v = localStorage.getItem(CLAVE)
    return v === 'hablada' || v === 'escrita' ? v : null
  } catch { return null }
}

export function guardarModoElegido(modo: ModoPlatica) {
  try { localStorage.setItem(CLAVE, modo) } catch { /* sin almacenamiento */ }
}

export function olvidarModoElegido() {
  try { localStorage.removeItem(CLAVE) } catch { /* sin almacenamiento */ }
}
