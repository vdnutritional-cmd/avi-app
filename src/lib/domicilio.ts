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

// Estados Unidos: 50 estados + Distrito de Columbia (6 nov 2026)
export const ESTADOS_USA = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Carolina del Norte',
  'Carolina del Sur', 'Colorado', 'Connecticut', 'Dakota del Norte', 'Dakota del Sur',
  'Delaware', 'Distrito de Columbia', 'Florida', 'Georgia', 'Hawái', 'Idaho', 'Illinois',
  'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Luisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Míchigan', 'Minnesota', 'Misisipi', 'Misuri', 'Montana', 'Nebraska',
  'Nevada', 'Nueva Jersey', 'Nueva York', 'Nuevo Hampshire', 'Nuevo México', 'Ohio',
  'Oklahoma', 'Oregón', 'Pensilvania', 'Rhode Island', 'Tennessee', 'Texas', 'Utah',
  'Vermont', 'Virginia', 'Virginia Occidental', 'Washington', 'Wisconsin', 'Wyoming',
]

// Colombia: 32 departamentos + Bogotá D.C. (6 nov 2026)
export const DEPARTAMENTOS_COLOMBIA = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá',
  'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca',
  'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño',
  'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
  'San Andrés, Providencia y Santa Catalina', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Vaupés', 'Vichada',
]

export const PAISES = ['México', 'USA', 'Colombia']

/** Estados (o departamentos) del país elegido; sin país, los de México */
export function estadosDePais(pais: string | null | undefined): string[] {
  if (pais === 'USA') return ESTADOS_USA
  if (pais === 'Colombia') return DEPARTAMENTOS_COLOMBIA
  return ESTADOS_MEXICO
}

/** "Departamento" en Colombia; "Estado" en México y USA */
export function etiquetaEstado(pais: string | null | undefined): string {
  return pais === 'Colombia' ? 'Departamento' : 'Estado'
}

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
