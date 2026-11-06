// Periodo de los reportes estadísticos (5 nov 2026): Mi estadística, Mis Asesorías, Reporte General y
// Reporte por <Pro> (Administración y AVI Administración). Viaja en el mismo parámetro `mes` de la URL,
// así los filtros, pestañas y selectores que ya lo conservan siguen funcionando:
//   mes=2026-10                  → un mes
//   mes=2026                     → acumulado del año
//   mes=total                    → acumulado total (desde el primer registro)
//   mes=2026-09-01_2026-10-31    → rango de fechas (inicio y fin incluidos)
// Sin parámetro (o inválido) → el mes actual. Toda la información del reporte usa [inicio, fin).

export type TipoPeriodo = 'mes' | 'anio' | 'total' | 'rango'

export interface Periodo {
  /** Valor para el parámetro `mes` */
  clave: string
  tipo: TipoPeriodo
  /** YYYY-MM-DD incluido */
  inicio: string
  /** YYYY-MM-DD excluido (día siguiente al último) */
  fin: string
  /** Para mostrar: "octubre de 2026", "Año 2026 (acumulado)", "Acumulado total", "1 sep 2026 – 31 oct 2026" */
  etiqueta: string
  /** Mes o año anterior / siguiente (null en total y rango, o si el siguiente aún no empieza) */
  anterior: string | null
  siguiente: string | null
}

/** Fecha de hoy en la Ciudad de México (YYYY-MM-DD) */
export function hoyMX(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' })
}

const pad = (n: number) => String(n).padStart(2, '0')

function fechaValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const f = new Date(Date.UTC(y, m - 1, d))
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
}

function diaSiguiente(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

export function fechaCorta(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function nombreMesLargo(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

export function esPeriodoValido(valor: string | null | undefined): boolean {
  if (!valor) return false
  if (valor === 'total' || /^\d{4}$/.test(valor)) return true
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) return true
  const [a, b] = valor.split('_')
  return !!b && fechaValida(a) && fechaValida(b) && a <= b
}

export function resolverPeriodo(valor: string | null | undefined, hoy: string = hoyMX()): Periodo {
  const [hy, hm] = hoy.split('-').map(Number)
  const mesActual = `${hy}-${pad(hm)}`
  const v = esPeriodoValido(valor) ? valor! : mesActual

  if (v === 'total') {
    return { clave: v, tipo: 'total', inicio: '2000-01-01', fin: '2100-01-01', etiqueta: 'Acumulado total', anterior: null, siguiente: null }
  }

  if (/^\d{4}$/.test(v)) {
    const y = Number(v)
    return {
      clave: v, tipo: 'anio', inicio: `${y}-01-01`, fin: `${y + 1}-01-01`,
      etiqueta: `Año ${y} (acumulado)`,
      anterior: String(y - 1),
      siguiente: y + 1 <= hy ? String(y + 1) : null,
    }
  }

  if (v.includes('_')) {
    const [a, b] = v.split('_')
    return { clave: v, tipo: 'rango', inicio: a, fin: diaSiguiente(b), etiqueta: `${fechaCorta(a)} – ${fechaCorta(b)}`, anterior: null, siguiente: null }
  }

  const [y, m] = v.split('-').map(Number)
  const ant = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`
  const sig = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`
  return {
    clave: v, tipo: 'mes', inicio: `${y}-${pad(m)}-01`, fin: `${sig}-01`,
    etiqueta: nombreMesLargo(y, m),
    anterior: ant,
    siguiente: sig <= mesActual ? sig : null,
  }
}

/** Último día incluido del periodo (YYYY-MM-DD) */
export function ultimoDia(p: Periodo): string {
  const [y, m, d] = p.fin.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}
