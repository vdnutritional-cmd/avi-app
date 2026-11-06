// Supabase devuelve como máximo 1,000 filas por consulta. Los reportes con periodo largo
// (año o total acumulado, src/lib/periodo.ts) pueden pasar de eso: se piden por páginas.
// `armar` debe crear la consulta nueva en cada llamada (con su orden estable, si importa).
const PAGINA = 1000

export async function todasLasFilas<T>(
  armar: () => { range: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }> },
): Promise<{ data: T[] }> {
  const filas: T[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await armar().range(desde, desde + PAGINA - 1)
    // Igual que una consulta normal en estos reportes: si falla, se muestra lo que haya
    if (error) { console.error('[todasLasFilas]', error); break }
    filas.push(...(data ?? []))
    if (!data || data.length < PAGINA) break
  }
  return { data: filas }
}
