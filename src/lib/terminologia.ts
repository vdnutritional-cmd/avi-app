// ─────────────────────────────────────────────────────────────
// Diccionario de terminología por empresa en CONVENIO (fuente única)
//
// Cada empresa elige en Empresas en CONVENIO (convenio_empresas.terminologia):
//   'paciente'  → paciente / terapeuta / terapia
//   'asesorado' → asesorado / asesor / asesoría   (default de las empresas)
//
// Variables del inventario de textos:
//   <user> <users> <User> <Users>   paciente(s)  / asesorado(s)
//   <pro>  <pros>  <Pro>  <Pros>    terapeuta(s) / asesor(es)
//   <serv> <servs> <Serv> <Servs>   terapia(s)   / asesoría(s)
//
// Quién la define (política 14 oct 2026, src/lib/terminologia-paciente.ts):
//   - Empresa: la Persona Institucional (User/Superuser) en Administración › Configuración Admin
//   - Personas sin empresa: el terapeuta en Configuración › Cómo me nombran (profiles.terminologia)
//   - Pantallas generales del terapeuta: una sola palabra; 'asesorado' si tiene alguna
// ─────────────────────────────────────────────────────────────
export type Terminologia = 'paciente' | 'asesorado'

export const TERMINOLOGIA_DEFAULT: Terminologia = 'asesorado'

/** Personas sin empresa cuando el terapeuta no ha elegido en "Cómo me nombran" */
export const TERMINOLOGIA_SIN_EMPRESA: Terminologia = 'paciente'

export const TERMINOLOGIA_OPCIONES: { valor: Terminologia; nombre: string; ejemplo: string }[] = [
  { valor: 'paciente',  nombre: 'Paciente',  ejemplo: 'paciente · terapeuta · terapia' },
  { valor: 'asesorado', nombre: 'Asesorado', ejemplo: 'asesorado · asesor · asesoría' },
]

export const VARIABLES = ['user', 'users', 'User', 'Users', 'pro', 'pros', 'Pro', 'Pros', 'serv', 'servs', 'Serv', 'Servs'] as const
export type Variable = (typeof VARIABLES)[number]

export const DICCIONARIO: Record<Terminologia, Record<Variable, string>> = {
  paciente: {
    user: 'paciente',  users: 'pacientes',  User: 'Paciente',  Users: 'Pacientes',
    pro:  'terapeuta', pros:  'terapeutas', Pro:  'Terapeuta', Pros:  'Terapeutas',
    serv: 'terapia',   servs: 'terapias',   Serv: 'Terapia',   Servs: 'Terapias',
  },
  asesorado: {
    user: 'asesorado', users: 'asesorados', User: 'Asesorado', Users: 'Asesorados',
    pro:  'asesor',    pros:  'asesores',   Pro:  'Asesor',    Pros:  'Asesores',
    serv: 'asesoría',  servs: 'asesorías',  Serv: 'Asesoría',  Servs: 'Asesorías',
  },
}

/** Valor guardado (o null / desconocido) → terminología válida */
export function normalizarTerminologia(valor: unknown): Terminologia {
  return valor === 'paciente' || valor === 'asesorado' ? valor : TERMINOLOGIA_DEFAULT
}

/** Una sola palabra para varias empresas: 'asesorado' si alguna lo es (sin ninguna: 'paciente') */
export function terminologiaComun(lista: Terminologia[]): Terminologia {
  return lista.includes('asesorado') ? 'asesorado' : 'paciente'
}

/** Las 12 palabras de una terminología */
export function terminos(t: unknown): Record<Variable, string> {
  return DICCIONARIO[normalizarTerminologia(t)]
}

/** Reemplaza <user>, <Pros>, <servs>… en un texto. Ej.: aplicarTerminologia('Tu <pro>', 'asesorado') → 'Tu asesor' */
export function aplicarTerminologia(texto: string, t: unknown): string {
  const d = terminos(t)
  return texto.replace(/<(users?|Users?|pros?|Pros?|servs?|Servs?)>/g, (_, v: Variable) => d[v])
}
