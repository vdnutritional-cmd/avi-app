'use client'

interface Props {
  therapistId: string
  displayName: string
  action: (formData: FormData) => Promise<void>
}

export default function DeleteTherapistButton({ therapistId, displayName, action }: Props) {
  return (
    <form action={action}>
      <input type="hidden" name="therapistId" value={therapistId} />
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`¿Eliminar definitivamente a "${displayName}"?\n\nEsta acción borrará al terapeuta, su perfil y todos sus datos de AVI. No se puede deshacer.`)) {
            e.preventDefault()
          }
        }}
        className="border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors"
      >
        🗑 Eliminar
      </button>
    </form>
  )
}
