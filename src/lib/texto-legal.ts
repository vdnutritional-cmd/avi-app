// Formato sencillo de los textos legales (Consentimiento Informado, Tu privacidad importa):
//   "# " título · "## " apartado · "- " viñeta · "  - " sub-viñeta · línea vacía = párrafo · **negrita**
// Lo dibujan src/components/TextoLegal.tsx (pantalla) y textoLegalHtml() (PDF).

export type Bloque =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'apartado'; texto: string }
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'lista'; items: { texto: string; sub: string[] }[] }

export function bloquesDe(texto: string): Bloque[] {
  const bloques: Bloque[] = []
  for (const trozo of texto.split(/\n\s*\n/)) {
    const lineas = trozo.split('\n').filter(l => l.trim())
    if (lineas.length === 0) continue
    let parrafo: string[] = []
    let lista: { texto: string; sub: string[] }[] | null = null
    const cerrarParrafo = () => { if (parrafo.length) { bloques.push({ tipo: 'parrafo', texto: parrafo.join(' ') }); parrafo = [] } }
    const cerrarLista = () => { if (lista) { bloques.push({ tipo: 'lista', items: lista }); lista = null } }
    for (const linea of lineas) {
      if (linea.startsWith('## ')) { cerrarParrafo(); cerrarLista(); bloques.push({ tipo: 'apartado', texto: linea.slice(3) }) }
      else if (linea.startsWith('# ')) { cerrarParrafo(); cerrarLista(); bloques.push({ tipo: 'titulo', texto: linea.slice(2) }) }
      else if (/^\s+- /.test(linea) && lista?.length) { lista[lista.length - 1].sub.push(linea.trim().slice(2)) }
      else if (linea.startsWith('- ')) { cerrarParrafo(); (lista ??= []).push({ texto: linea.slice(2), sub: [] }) }
      else { cerrarLista(); parrafo.push(linea.trim()) }
    }
    cerrarParrafo(); cerrarLista()
  }
  return bloques
}

/** Partes de un renglón: texto normal y **negritas** */
export function partesNegrita(texto: string): { texto: string; negrita: boolean }[] {
  return texto.split(/(\*\*[^*]+\*\*)/).filter(Boolean)
    .map(p => p.startsWith('**') && p.endsWith('**') ? { texto: p.slice(2, -2), negrita: true } : { texto: p, negrita: false })
}

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const enLinea = (s: string) => partesNegrita(s).map(p => p.negrita ? `<strong>${escapar(p.texto)}</strong>` : escapar(p.texto)).join('')

export function textoLegalHtml(texto: string): string {
  return bloquesDe(texto).map(b => {
    if (b.tipo === 'titulo') return `<h2>${enLinea(b.texto)}</h2>`
    if (b.tipo === 'apartado') return `<h3>${enLinea(b.texto)}</h3>`
    if (b.tipo === 'parrafo') return `<p>${enLinea(b.texto)}</p>`
    return `<ul>${b.items.map(i => `<li>${enLinea(i.texto)}${i.sub.length ? `<ul>${i.sub.map(s => `<li>${enLinea(s)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ul>`
  }).join('\n')
}
