// ─────────────────────────────────────────────────────────────
// Diccionario de terminología por empresa en CONVENIO (fuente única)
//
// Cada empresa elige en Configuración Admin (convenio_empresas.terminologia):
//   'paciente'    → paciente / terapeuta / terapia
//   'consultante' → consultante / consultor / consultoría   (29 oct 2026; grado entre terapeuta y asesor)
//   'asesorado'   → asesorado / asesor / asesoría   (default de las empresas)
//
// Variables del inventario de textos:
//   <user> <users> <User> <Users>   paciente(s)  / consultante(s) / asesorado(s)
//   <pro>  <pros>  <Pro>  <Pros>    terapeuta(s) / consultor(es)  / asesor(es)
//   <serv> <servs> <Serv> <Servs>   terapia(s)   / consultoría(s) / asesoría(s)
//
// Quién la define (política 14 oct 2026, src/lib/terminologia-paciente.ts):
//   - Empresa: la Persona Institucional (User/Superuser) en Administración › Configuración Admin
//   - Personas sin empresa: el terapeuta en Configuración › Cómo me nombran (profiles.terminologia)
//   - Pantallas generales del terapeuta: una sola palabra (terminologiaComun: asesorado > consultante > paciente)
// ─────────────────────────────────────────────────────────────
export type Terminologia = 'paciente' | 'consultante' | 'asesorado'

export const TERMINOLOGIAS: readonly Terminologia[] = ['paciente', 'consultante', 'asesorado']

export function esTerminologia(valor: unknown): valor is Terminologia {
  return TERMINOLOGIAS.includes(valor as Terminologia)
}

export const TERMINOLOGIA_DEFAULT: Terminologia = 'asesorado'

/** Personas sin empresa cuando el terapeuta no ha elegido en "Cómo me nombran" */
export const TERMINOLOGIA_SIN_EMPRESA: Terminologia = 'paciente'

export const TERMINOLOGIA_OPCIONES: { valor: Terminologia; nombre: string; ejemplo: string }[] = [
  { valor: 'paciente',    nombre: 'Paciente',    ejemplo: 'paciente · terapeuta · terapia' },
  { valor: 'consultante', nombre: 'Consultante', ejemplo: 'consultante · consultor · consultoría' },
  { valor: 'asesorado',   nombre: 'Asesorado',   ejemplo: 'asesorado · asesor · asesoría' },
]

export const VARIABLES = ['user', 'users', 'User', 'Users', 'pro', 'pros', 'Pro', 'Pros', 'serv', 'servs', 'Serv', 'Servs'] as const
export type Variable = (typeof VARIABLES)[number]

export const DICCIONARIO: Record<Terminologia, Record<Variable, string>> = {
  paciente: {
    user: 'paciente',  users: 'pacientes',  User: 'Paciente',  Users: 'Pacientes',
    pro:  'terapeuta', pros:  'terapeutas', Pro:  'Terapeuta', Pros:  'Terapeutas',
    serv: 'terapia',   servs: 'terapias',   Serv: 'Terapia',   Servs: 'Terapias',
  },
  consultante: {
    user: 'consultante', users: 'consultantes', User: 'Consultante', Users: 'Consultantes',
    pro:  'consultor',   pros:  'consultores',  Pro:  'Consultor',   Pros:  'Consultores',
    serv: 'consultoría', servs: 'consultorías', Serv: 'Consultoría', Servs: 'Consultorías',
  },
  asesorado: {
    user: 'asesorado', users: 'asesorados', User: 'Asesorado', Users: 'Asesorados',
    pro:  'asesor',    pros:  'asesores',   Pro:  'Asesor',    Pros:  'Asesores',
    serv: 'asesoría',  servs: 'asesorías',  Serv: 'Asesoría',  Servs: 'Asesorías',
  },
}

/** Valor guardado (o null / desconocido) → terminología válida */
export function normalizarTerminologia(valor: unknown): Terminologia {
  return esTerminologia(valor) ? valor : TERMINOLOGIA_DEFAULT
}

/**
 * Una sola palabra para varias empresas: la más restrictiva que aparezca
 * ('asesorado' > 'consultante' > 'paciente'; sin ninguna: 'paciente'), porque las
 * instituciones sin fines de lucro no pueden usar "paciente".
 */
export function terminologiaComun(lista: Terminologia[]): Terminologia {
  if (lista.includes('asesorado')) return 'asesorado'
  if (lista.includes('consultante')) return 'consultante'
  return 'paciente'
}

/** Solo "Paciente" es terapia: nombre y logo "AVI Therapy Companion"; las demás, "AVI Acompañamiento Virtual Interactivo" */
export function esTerapia(t: unknown): boolean {
  return normalizarTerminologia(t) === 'paciente'
}

/** Las 12 palabras de una terminología */
export function terminos(t: unknown): Record<Variable, string> {
  return DICCIONARIO[normalizarTerminologia(t)]
}

/** Nombre de AVI según la terminología: paciente → "AVI Therapy Companion"; consultante y asesorado → "AVI Acompañamiento Virtual Interactivo" */
export function nombreAvi(t: unknown): string {
  return esTerapia(t) ? 'AVI Therapy Companion' : 'AVI Acompañamiento Virtual Interactivo'
}

/** Reemplaza <user>, <Pros>, <servs>… en un texto. Ej.: aplicarTerminologia('Tu <pro>', 'asesorado') → 'Tu asesor' */
export function aplicarTerminologia(texto: string, t: unknown): string {
  const d = terminos(t)
  return texto.replace(/<(users?|Users?|pros?|Pros?|servs?|Servs?)>/g, (_, v: Variable) => d[v])
}
