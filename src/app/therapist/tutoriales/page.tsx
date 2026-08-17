const VIDEOS = [
  {
    id: '6F8uq80IFIg',
    titulo: 'Vista y funciones generales de AVI',
    descripcion: 'Recorrido completo por la plataforma: acceso, módulos principales y flujo de trabajo con tus pacientes.',
    numero: 1,
  },
  // Aquí se irán agregando más videos
]

export default function TutorialesPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Consejos prácticos y Tutoriales</h1>
        <p className="text-gray-500 mt-1">Videos de capacitación para terapeutas AVI</p>
      </div>

      <div className="space-y-8">
        {VIDEOS.map(video => (
          <div key={video.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Video embed */}
            <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 */ }}>
              <iframe
                src={`https://www.youtube.com/embed/${video.id}`}
                title={video.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>

            {/* Info */}
            <div className="p-5">
              <p className="text-xs font-semibold text-primary-500 uppercase tracking-wide mb-1">
                Tutorial {video.numero}
              </p>
              <h2 className="text-base font-semibold text-gray-800">{video.titulo}</h2>
              {video.descripcion && (
                <p className="text-sm text-gray-500 mt-1">{video.descripcion}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
