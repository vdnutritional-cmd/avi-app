// Dibuja un texto legal (Consentimiento Informado, Tu privacidad importa) en el formato de src/lib/texto-legal.ts
import { bloquesDe, partesNegrita } from '@/lib/texto-legal'

function Linea({ texto }: { texto: string }) {
  return <>{partesNegrita(texto).map((p, i) => p.negrita ? <strong key={i} className="font-semibold text-gray-800">{p.texto}</strong> : <span key={i}>{p.texto}</span>)}</>
}

export default function TextoLegal({ texto, className = '' }: { texto: string; className?: string }) {
  return (
    <div className={`space-y-3 text-sm text-gray-600 leading-relaxed ${className}`}>
      {bloquesDe(texto).map((b, i) => {
        if (b.tipo === 'titulo') return <h3 key={i} className="text-base font-bold text-gray-800 pt-2"><Linea texto={b.texto} /></h3>
        if (b.tipo === 'apartado') return <h4 key={i} className="text-sm font-bold text-gray-800 pt-2"><Linea texto={b.texto} /></h4>
        if (b.tipo === 'parrafo') return <p key={i} className="text-justify"><Linea texto={b.texto} /></p>
        return (
          <ul key={i} className="list-disc pl-5 space-y-1">
            {b.items.map((it, j) => (
              <li key={j}>
                <Linea texto={it.texto} />
                {it.sub.length > 0 && (
                  <ul className="list-[circle] pl-5 mt-1 space-y-1">
                    {it.sub.map((s, k) => <li key={k}><Linea texto={s} /></li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}
