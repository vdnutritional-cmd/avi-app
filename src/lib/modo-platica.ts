// Modo de platicar con AVI (hablada / escrita) que el paciente eligió en este inicio de sesión.
// Queda marcado en la pantalla de inicio de "Habla" (que se muestra siempre al entrar);
// se olvida al salir ("Cerrar sesión", "Salir" o por inactividad).
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
  try {
    localStorage.removeItem(CLAVE)
    localStorage.removeItem(CLAVE_BORRADOR)
  } catch { /* sin almacenamiento */ }
}

// Lo que el paciente lleva escrito y aún no envía (sesión escrita): no se pierde si va a
// "Resumen" y regresa. Se borra al enviarlo, al terminar la sesión y al salir.
const CLAVE_BORRADOR = 'avi_borrador_texto'

export function leerBorrador(): string {
  try { return localStorage.getItem(CLAVE_BORRADOR) ?? '' } catch { return '' }
}

export function guardarBorrador(texto: string) {
  try {
    if (texto) localStorage.setItem(CLAVE_BORRADOR, texto)
    else localStorage.removeItem(CLAVE_BORRADOR)
  } catch { /* sin almacenamiento */ }
}
