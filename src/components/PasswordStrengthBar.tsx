'use client'

import { checkPassword } from '@/lib/password-strength'

interface Props {
  password: string
  showErrors?: boolean
}

/**
 * Indicador visual de fortaleza de contraseña (NOM-024).
 * Uso: <PasswordStrengthBar password={password} showErrors />
 */
export default function PasswordStrengthBar({ password, showErrors = true }: Props) {
  if (!password) return null

  const { score, label, color, barColor, errors } = checkPassword(password)
  const segments = [0, 1, 2, 3]  // 4 segmentos de la barra

  return (
    <div className="mt-2 space-y-2">
      {/* Barra de fortaleza */}
      <div className="flex gap-1">
        {segments.map(i => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300
              ${i < score ? barColor : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {/* Etiqueta */}
      <p className={`text-xs font-medium ${color}`}>{label}</p>

      {/* Errores */}
      {showErrors && errors.length > 0 && (
        <ul className="text-xs text-gray-500 space-y-0.5 list-none">
          {errors.map((err, i) => (
            <li key={i} className="flex items-center gap-1">
              <span className="text-red-400">✗</span> {err}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
