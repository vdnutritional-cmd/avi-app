// ─────────────────────────────────────────────────────────────
// Filas de "Sesiones por institución" (Mi estadística, Reporte
// Institucional General, Reporte por Terapeuta y su PDF).
//
// Los porcentajes son enteros que suman exactamente 100% (método del
// mayor residuo): con 3 instituciones de 33.3% cada una, el redondeo
// simple daba 33+33+33 = 99%.
// ─────────────────────────────────────────────────────────────
export interface InstitucionRow { nombre: string; total: number; pct: number }

export function institucionRowsDesde(sesionesPorEmpresa: Record<string, number>): InstitucionRow[] {
  const rows = Object.entries(sesionesPorEmpresa)
    .map(([nombre, total]) => ({ nombre, total, pct: 0 }))
    .sort((a, b) => b.total - a.total)

  const totalSesiones = rows.reduce((a, r) => a + r.total, 0)
  if (totalSesiones === 0) return rows

  const exactos = rows.map(r => (r.total / totalSesiones) * 100)
  rows.forEach((r, i) => { r.pct = Math.floor(exactos[i]) })
  let faltan = 100 - rows.reduce((a, r) => a + r.pct, 0)
  const porResiduo = rows.map((_, i) => i).sort((a, b) => (exactos[b] % 1) - (exactos[a] % 1))
  for (const i of porResiduo) {
    if (faltan <= 0) break
    rows[i].pct++
    faltan--
  }
  return rows
}
