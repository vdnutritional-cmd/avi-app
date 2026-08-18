const VIDEOS = [
  {
    id: '6F8uq80IFIg',
    titulo: 'Vista y funciones generales de AVI',
    descripcion: 'Recorrido completo por la plataforma: acceso, módulos principales y flujo de trabajo con tus pacientes.',
    numero: 1,
  },
  {
    id: 'FpKTnPaivPI',
    titulo: 'Cómo administrar a tus pacientes con AVI',
    descripcion: 'Conoce todas las funcionalidades y alcance de AVI para administrar y hacer la evaluación clínica de tus pacientes.',
    numero: 2,
  },
  {
    id: 'hESY7xfHCaE',
    titulo: 'Creación de cuentas temporales para pacientes nuevos',
    descripcion: 'Aprende cómo crear una Cuenta Temporal para un nuevo paciente y poder registrar, desde la Sesión Inicial, toda la información y detalles del paciente.',
    numero: 3,
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
              <p className="text-xs font-semibold text-primary-500 uppercase tracking-wide mb-1">
                Tutorial {video.numero}
              </p>
              <h2 className="text-sm font-semibold text-gray-800">{video.titulo}</h2>
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
