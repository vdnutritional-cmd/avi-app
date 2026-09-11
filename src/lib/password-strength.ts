/**
 * NOM-024 — Validación y fortaleza de contraseña
 */

export interface PasswordResult {
  valid:    boolean
  score:    0 | 1 | 2 | 3 | 4   // 0=muy débil 1=débil 2=regular 3=fuerte 4=muy fuerte
  label:    string
  color:    string               // Tailwind text color
  barColor: string               // Tailwind bg color
  errors:   string[]
}

const RULES = [
  { re: /.{8,}/,         msg: 'Mínimo 8 caracteres' },
  { re: /[A-Z]/,         msg: 'Al menos 1 letra mayúscula' },
  { re: /[a-z]/,         msg: 'Al menos 1 letra minúscula' },
  { re: /[0-9]/,         msg: 'Al menos 1 número' },
  { re: /[^A-Za-z0-9]/, msg: 'Al menos 1 carácter especial (!@#$%...)' },
]

export function checkPassword(password: string): PasswordResult {
  const errors = RULES.filter(r => !r.re.test(password)).map(r => r.msg)
  const passed = RULES.length - errors.length
  const valid  = errors.length === 0

  // Score 0-4 según cuántas reglas pasan + longitud bonus
  let score = passed as 0 | 1 | 2 | 3 | 4
  if (valid && password.length >= 16) score = 4
  else if (valid) score = 3
  else if (passed >= 4) score = 2
  else if (passed >= 2) score = 1
  else score = 0

  const LABELS     = ['Muy débil', 'Débil', 'Regular', 'Fuerte', 'Muy fuerte']
  const COLORS     = ['text-red-500', 'text-orange-500', 'text-yellow-500', 'text-green-500', 'text-emerald-600']
  const BAR_COLORS = ['bg-red-400',   'bg-orange-400',   'bg-yellow-400',   'bg-green-400',   'bg-emerald-500']

  return { valid, score, label: LABELS[score], color: COLORS[score], barColor: BAR_COLORS[score], errors }
}
