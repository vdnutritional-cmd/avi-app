/**
 * SPRINT 1 — Placeholder del chat de Recupérate.
 * El chat completo (con Claude API) se construye en Sprint 2.
 */
export default function PatientChatPage() {
  return (
    <div className="flex flex-col h-full items-center justify-center p-8 text-center space-y-4">
      <div className="text-6xl">💬</div>
      <h2 className="text-xl font-bold text-gray-800">Habla</h2>
      <p className="text-gray-500 text-sm max-w-xs">
        Este es tu espacio seguro. Aquí puedes expresar lo que sientes sin juicios.
        La IA te acompañará con base en el personalismo y la terapia familiar.
      </p>
      <div className="bg-primary-50 border border-primary-100 rounded-2xl px-6 py-4 text-sm text-primary-700">
        El chat con IA se activa en Sprint 2 🚀
      </div>
      <p className="text-xs text-gray-400">
        AVI no reemplaza a tu terapeuta. Es un apoyo entre sesiones.
      </p>
    </div>
  )
}
