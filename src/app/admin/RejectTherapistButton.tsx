'use client'

interface Props {
  therapistId: string
  displayName: string
  action: (formData: FormData) => Promise<void>
}

export default function RejectTherapistButton({ therapistId, displayName, action }: Props) {
  return (
    <form action={action}>
      <input type="hidden" name="therapistId" value={therapistId} />
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`¿Eliminar a "${displayName}" de AVI? Esta acción no se puede deshacer.`)) {
            e.preventDefault()
          }
        }}
        className="border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
      >
        ✗ No aprobar
      </button>
    </form>
  )
}
