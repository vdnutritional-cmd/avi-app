const VIDEOS = [
  // ── Videos cortos (sin número de tutorial) ───────────────────────────────
  {
    id: 'adzDVQED6XE',
    titulo: '¿Cómo genero un código para cada paciente?',
    descripcion: 'Breve explicación de cómo generar un código para que tus pacientes puedan entrar y usar AVI.',
    duracion: '0:29 seg',
    numero: null,
  },
  {
    id: 'iDqr7B-kSes',
    titulo: '¿Cómo ayudo a mi paciente entrar a AVI?',
    descripcion: 'Sigue un procedimiento muy rápido para que tu paciente pueda entrar a AVI.',
    duracion: '2:29 min',
    numero: null,
  },
  // ── Tutoriales completos ──────────────────────────────────────────────────
  {
    id: '6F8uq80IFIg',
    titulo: 'Vista y funciones generales de AVI',
    descripcion: 'Recorrido completo por la plataforma: acceso, módulos principales y flujo de trabajo con tus pacientes.',
    numero: 1,
    duracion: '8:46 min',
  },
  {
    id: 'FpKTnPaivPI',
    titulo: 'Cómo administrar a tus pacientes con AVI',
    descripcion: 'Conoce todas las funcionalidades y alcance de AVI para administrar y hacer la evaluación clínica de tus pacientes.',
    numero: 2,
    duracion: '12:36 min',
  },
  {
    id: 'hESY7xfHCaE',
    titulo: 'Creación de cuentas temporales para pacientes nuevos',
    descripcion: 'Aprende cómo crear una Cuenta Temporal para un nuevo paciente y poder registrar, desde la Sesión Inicial, toda la información y detalles del paciente.',
    numero: 3,
    duracion: '7:38 min',
  },
  {
    id: 'zyVogCXln5c',
    titulo: 'Cómo registrar las sesiones rápidamente y hacer el Análisis de los Casos',
    descripcion: 'Te presentamos una forma de registrar en menos de 5 minutos tus sesiones en AVI y cómo se realiza el Análisis de los Casos.',
    numero: 4,
    duracion: '15:24 min',
  },
  // Aquí se irán agregando más videos
]

export default function TutorialesPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Consejos prácticos y Tutoriales</h1>
        <p className="text-gray-500 mt-1">Videos de capacitación para terapeutas AVI</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {VIDEOS.map(video => (
          <div key={video.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
            {/* Video embed */}
            <div className="w-full aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${video.id}`}
                title={video.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>

            {/* Info */}
            <div className="p-4 flex-1">
              {video.numero !== null ? (
                // Tutoriales completos: etiqueta "Tutorial N (duración)" + título en negro
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1">
                    <span style={{ color: '#b243d5' }}>Tutorial {video.numero}</span>
                    {video.duracion && (
                      <span style={{ color: '#b243d5' }} className="ml-1 font-normal">({video.duracion})</span>
                    )}
                  </p>
                  <h2 className="text-sm font-semibold text-gray-800">{video.titulo}</h2>
                </>
              ) : (
                // Videos cortos: solo nombre + duración en color AVI
                <h2 className="text-sm font-semibold mb-0.5">
                  <span style={{ color: '#b243d5' }}>{video.titulo}</span>
                  {video.duracion && (
                    <span style={{ color: '#b243d5' }} className="ml-1.5 font-normal text-xs">({video.duracion})</span>
                  )}
                </h2>
              )}
              {video.descripcion && (
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{video.descripcion}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
