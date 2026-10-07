// ─────────────────────────────────────────────────────────────
// Verificación de correo antes de registrar (terapeuta o paciente).
// Supabase no permite dos cuentas con el mismo correo, pero su signUp no
// avisa (reenvía la confirmación y parece "éxito"), y crear un paciente con
// un correo existente NUNCA debe tocar la cuenta existente.
//
// Privacidad (LFPDPPP / NOM-024): nunca se revela con qué terapeuta está
// un paciente; solo si es del mismo terapeuta o de otro.
// Solo servidor (service role).
// ─────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CuentaExistente {
  userId: string
  role: string | null
}

export async function buscarCuentaPorEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  email: string,
): Promise<CuentaExistente | null> {
  const normalizado = email.trim().toLowerCase()
  if (!normalizado) return null

  const { data: perfil } = await admin
    .from('profiles')
    .select('id, role')
    .ilike('email', normalizado.replace(/[\\%_]/g, '\\$&'))   // _ y % son comodines en ilike
    .limit(1)
    .maybeSingle()
  if (perfil) return { userId: perfil.id as string, role: (perfil.role as string) ?? null }

  // Cuenta en Auth sin perfil (ej. registro sin confirmar)
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) break
    const u = data.users.find(x => x.email?.toLowerCase() === normalizado)
    if (u) return { userId: u.id, role: (u.user_metadata?.role as string) ?? null }
    if (data.users.length < 200) break
  }
  return null
}

/** Mensaje para un registro de paciente cuyo correo ya existe; null si el correo está libre. */
export async function mensajeEmailPacienteExistente(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  email: string,
  therapistId: string,
): Promise<string | null> {
  const cuenta = await buscarCuentaPorEmail(admin, email)
  if (!cuenta) return null

  if (cuenta.role !== 'patient') {
    return 'Este correo ya está registrado en AVI. Usa otro correo para el registro.'
  }

  const { data: vinculo } = await admin
    .from('therapist_patients')
    .select('id')
    .eq('patient_id', cuenta.userId)
    .eq('therapist_id', therapistId)
    .limit(1)
    .maybeSingle()

  return vinculo
    ? 'Este correo ya está registrado como paciente de este terapeuta. Inicia sesión con tu correo y contraseña.'
    : 'Este correo ya está registrado con otro terapeuta de AVI. Para cambiarlo de terapeuta, solicita una transferencia.'
}
