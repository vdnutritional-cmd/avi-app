// ─────────────────────────────────────────────────────────────
// Niveles de Personas Institucionales — acceso en "Administración Institucional"
//
//   N3: Panel Institucional
//   N2: Panel Institucional + Reporte Institucional General
//   N1: Panel Institucional + Reporte Institucional General + Reporte por Terapeuta
//   Baja de Terapeutas: N1 y N2
//
// "Opera como terapeuta" es independiente del nivel.
// Se aplica en el sidebar, en las tarjetas del Panel Institucional y en las
// páginas mismas (por empresa: un PI multi-empresa solo ve en cada reporte
// las empresas donde su nivel lo permite).
// ─────────────────────────────────────────────────────────────
export type NivelPI = 'N1' | 'N2' | 'N3'

export const NIVELES_REPORTE_GENERAL: NivelPI[]  = ['N1', 'N2']
export const NIVELES_REPORTE_TERAPEUTA: NivelPI[] = ['N1']
export const NIVELES_BAJA_TERAPEUTAS: NivelPI[]  = ['N1', 'N2']

export const NIVEL_LABELS: Record<NivelPI, string> = {
  N1: 'N1 — Panel + Reporte General + Reporte por Terapeuta',
  N2: 'N2 — Panel + Reporte Institucional General',
  N3: 'N3 — Solo Panel Institucional',
}

/** Permisos combinados de todos los registros activos de un PI (cualquier empresa). */
export function permisosPI(niveles: string[]) {
  const tiene = (permitidos: NivelPI[]) => niveles.some(n => permitidos.includes(n as NivelPI))
  return {
    reporteGeneral:  tiene(NIVELES_REPORTE_GENERAL),
    reporteTerapeuta: tiene(NIVELES_REPORTE_TERAPEUTA),
    bajas:           tiene(NIVELES_BAJA_TERAPEUTAS),
  }
}
