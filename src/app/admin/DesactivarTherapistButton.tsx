'use client'

interface Props {
  therapistId: string
  displayName: string
  action: (formData: FormData) => Promise<void>
}

export default function DesactivarTherapistButton({ therapistId, displayName, action }: Props) {
  return (
    <form action={action}>
      <input type="hidden" name="therapistId" value={therapistId} />
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(
            `¿Desactivar a "${displayName}"?\n\n` +
            `El terapeuta dejará de aparecer en reportes.\n` +
            `Su expediente y datos clínicos se conservan (NOM-024).\n\n` +
            `Primero se verificará que no tenga pacientes activos.`
          )) {
            e.preventDefault()
          }
        }}
        className="border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors"
      >
        🔒 Desactivar
      </button>
    </form>
  )
}
