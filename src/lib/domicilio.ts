// Domicilio en partes (25 oct 2026): Estado y Municipio quedan en columnas propias para filtrar.
// `contacto_domicilio` sigue guardando el domicilio completo en una línea (lo leen los PDF y los análisis).

export const ESTADOS_MEXICO = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
  'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila de Zaragoza',
  'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero',
  'Hidalgo', 'Jalisco', 'Michoacán de Ocampo', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo',
  'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas',
  'Tlaxcala', 'Veracruz de Ignacio de la Llave', 'Yucatán', 'Zacatecas',
]

// Por ahora solo México; se agregarán más países
export const PAISES = ['México']

export const CAMPOS_DOMICILIO = [
  'domicilio_calle', 'domicilio_num_ext', 'domicilio_num_int', 'domicilio_colonia',
  'domicilio_municipio', 'domicilio_cp', 'domicilio_estado', 'domicilio_pais',
] as const

export type CampoDomicilio = typeof CAMPOS_DOMICILIO[number]
export type Domicilio = Record<CampoDomicilio, string>

export const domicilioVacio = (): Domicilio =>
  Object.fromEntries(CAMPOS_DOMICILIO.map(c => [c, ''])) as Domicilio

/** "Calle 123 Int. 4, Col. Centro, Guadalajara, C.P. 44100, Jalisco, México" — vacío si no hay partes (el país solo no cuenta). */
export function domicilioEnUnaLinea(d: Partial<Record<CampoDomicilio, string | null>>): string {
  const t = (k: CampoDomicilio) => (d[k] ?? '').trim()
  const tieneDatos = CAMPOS_DOMICILIO.some(k => k !== 'domicilio_pais' && t(k))
  if (!tieneDatos) return ''
  const calle = [t('domicilio_calle'), t('domicilio_num_ext'), t('domicilio_num_int') && `Int. ${t('domicilio_num_int')}`]
    .filter(Boolean).join(' ')
  return [
    calle,
    t('domicilio_colonia') && `Col. ${t('domicilio_colonia')}`,
    t('domicilio_municipio'),
    t('domicilio_cp') && `C.P. ${t('domicilio_cp')}`,
    t('domicilio_estado'),
    t('domicilio_pais'),
  ].filter(Boolean).join(', ')
}
