// SponsorsSection — muestra los logos de patrocinadores de AVI
// Para agregar un patrocinador: colocar su logo en /public/sponsors/
// y agregar una entrada al arreglo SPONSORS abajo.

interface Sponsor {
  name: string
  logo: string      // ruta relativa a /public (ej. '/sponsors/valora.png')
  url?: string      // sitio web del patrocinador (opcional)
}

// ── AGREGAR PATROCINADORES AQUÍ ───────────────────────────────
const SPONSORS: Sponsor[] = [
  { name: 'VD-Products', logo: '/sponsors/logo-vdproducts.png', url: 'https://vdproducts.net' },
]
// ─────────────────────────────────────────────────────────────

export default function SponsorsSection() {
  if (SPONSORS.length === 0) return null

  return (
    <section className="text-center py-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
        Con el apoyo de
      </p>
      <div className="flex flex-wrap items-center justify-center gap-10">
        {SPONSORS.map(sponsor =>
          sponsor.url ? (
            <a
              key={sponsor.name}
              href={sponsor.url}
              target="_blank"
              rel="noopener noreferrer"
              title={sponsor.name}
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sponsor.logo}
                alt={sponsor.name}
                className="h-10 object-contain"
              />
            </a>
          ) : (
            <span key={sponsor.name} className="opacity-60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sponsor.logo}
                alt={sponsor.name}
                className="h-10 object-contain"
              />
            </span>
          )
        )}
      </div>
    </section>
  )
}
