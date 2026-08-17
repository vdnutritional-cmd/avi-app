export default function TutorialesPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Consejos prácticos y Tutoriales</h1>
        <p className="text-gray-500 mt-1">Videos de capacitación para terapeutas AVI</p>
      </div>

      {/* Placeholder — se reemplazará con videos */}
      <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
        <p className="text-5xl mb-4">🎬</p>
        <p className="text-gray-500 font-medium">Los tutoriales estarán disponibles muy pronto</p>
        <p className="text-sm text-gray-400 mt-1">
          Aquí encontrarás videos de capacitación para aprovechar al máximo AVI.
        </p>
      </div>
    </div>
  )
}
