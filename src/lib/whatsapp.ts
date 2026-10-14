// Enlaces de WhatsApp (wa.me). Los teléfonos se capturan libres ("33 1363 0266",
// "+52 33…"): se dejan solo los dígitos y a los de 10 dígitos se les antepone 52 (México).
export const AVI_WHATSAPP = '523318830312'   // José Luis — 33 1883 0312

/** Teléfono → número para wa.me, o null si no parece válido */
export function numeroWhatsApp(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '')
  if (digitos.length === 10) return `52${digitos}`
  return digitos.length >= 11 && digitos.length <= 15 ? digitos : null
}

export function enlaceWhatsApp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}
