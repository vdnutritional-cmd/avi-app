import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Combina clases de Tailwind sin conflictos */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formatea una fecha ISO a texto legible en español */
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

/** Genera un extracto de texto */
export function excerpt(text: string, maxLength = 120): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '…'
}

/** Valida si un código de autorización tiene formato correcto (8 chars alfanumérico) */
export function isValidAuthCode(code: string): boolean {
  return /^[A-Z2-9]{8}$/.test(code.toUpperCase())
}
