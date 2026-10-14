// ─────────────────────────────────────────────────────────────
// Niveles de Personas Institucionales — acceso en "Administración"
// Por dentro se guardan como N1/N2/N3; en pantalla se muestran con NIVEL_NOMBRES.
//
//   N3 (Community Manager): Panel de Control
//   N2 (User):       Panel de Control + Reporte General
//   N1 (Superuser):  Panel de Control + Reporte General + Reporte por Terapeuta
//   Baja de Terapeutas y Configuración Admin (terminología, teléfono y logo de la empresa): N1 y N2
//
// "Opera como terapeuta" es independiente del nivel.
// Se aplica en el sidebar, en las tarjetas del Panel de Control y en las
// páginas mismas (por empresa: un PI multi-empresa solo ve en cada reporte
// las empresas donde su nivel lo permite).
// ─────────────────────────────────────────────────────────────
export type NivelPI = 'N1' | 'N2' | 'N3'

export const NIVELES_REPORTE_GENERAL: NivelPI[]  = ['N1', 'N2']
export const NIVELES_REPORTE_TERAPEUTA: NivelPI[] = ['N1']
export const NIVELES_BAJA_TERAPEUTAS: NivelPI[]  = ['N1', 'N2']
export const NIVELES_CONFIGURACION: NivelPI[]    = ['N1', 'N2']

/** Nombre visible de cada nivel */
export const NIVEL_NOMBRES: Record<NivelPI, string> = {
  N1: 'Superuser',
  N2: 'User',
  N3: 'Community Manager',
}

export const NIVEL_LABELS: Record<NivelPI, string> = {
  N1: 'Superuser — Panel + Reporte General + Reporte por Terapeuta',
  N2: 'User — Panel + Reporte General',
  N3: 'Community Manager — Solo Panel de Control',
}

/** Nombre visible de un nivel guardado (N1/N2/N3) */
export const nombreNivel = (nivel: string) => NIVEL_NOMBRES[nivel as NivelPI] ?? nivel

/** Permisos combinados de todos los registros activos de un PI (cualquier empresa). */
export function permisosPI(niveles: string[]) {
  const tiene = (permitidos: NivelPI[]) => niveles.some(n => permitidos.includes(n as NivelPI))
  return {
    reporteGeneral:  tiene(NIVELES_REPORTE_GENERAL),
    reporteTerapeuta: tiene(NIVELES_REPORTE_TERAPEUTA),
    bajas:           tiene(NIVELES_BAJA_TERAPEUTAS),
    configuracion:   tiene(NIVELES_CONFIGURACION),
  }
}
