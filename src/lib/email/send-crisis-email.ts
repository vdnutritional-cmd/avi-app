import { createClient } from '@supabase/supabase-js'
import { resend, EMAIL_FROM } from './index'

interface CrisisEmailParams {
  patientId: string
  sessionId: string
}

export async function sendCrisisEmail({ patientId, sessionId }: CrisisEmailParams) {
  // Usar service role para leer datos entre cuentas (bypass RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Obtener nombre del paciente
  const { data: patient } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', patientId)
    .single()

  const patientName = patient?.full_name ?? 'Un paciente'

  // 2. Encontrar al terapeuta del paciente
  const { data: relation } = await supabase
    .from('therapist_patients')
    .select('therapist_id')
    .eq('patient_id', patientId)
    .eq('is_active', true)
    .single()

  if (!relation?.therapist_id) {
    console.warn('sendCrisisEmail: no se encontró terapeuta para paciente', patientId)
    return
  }

  // 3. Obtener email y nombre del terapeuta
  const { data: therapist } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', relation.therapist_id)
    .single()

  if (!therapist?.email) {
    console.warn('sendCrisisEmail: terapeuta sin email', relation.therapist_id)
    return
  }

  const patientUrl = `${process.env.NEXT_PUBLIC_APP_URL}/therapist/patients/${patientId}`
  const therapistName = therapist.full_name ?? 'Terapeuta'

  // 4. Enviar email
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: therapist.email,
    subject: `⚠️ Crisis detectada — ${patientName}`,
    html: crisisEmailHtml({ patientName, therapistName, patientUrl, sessionId }),
  })

  if (error) {
    console.error('sendCrisisEmail: error al enviar:', error)
    return
  }

  console.log(`sendCrisisEmail: email enviado a ${therapist.email} por crisis de ${patientName}`)
}

// ── Template HTML ─────────────────────────────────────────────────────────────

function crisisEmailHtml({
  patientName,
  therapistName,
  patientUrl,
  sessionId,
}: {
  patientName: string
  therapistName: string
  patientUrl: string
  sessionId: string
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Crisis detectada — AVI</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#7c3aed;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">AVI</p>
              <p style="margin:6px 0 0;font-size:13px;color:#ddd6fe;">Acompañamiento Virtual Interactivo</p>
            </td>
          </tr>

          <!-- Alerta -->
          <tr>
            <td style="padding:28px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:16px 20px;">
                    <p style="margin:0;font-size:22px;font-weight:700;color:#dc2626;">⚠️ Crisis detectada</p>
                    <p style="margin:6px 0 0;font-size:14px;color:#b91c1c;">
                      Se detectó una situación de crisis en la sesión de <strong>${patientName}</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:24px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">
                Hola <strong>${therapistName}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
                AVI identificó señales de crisis durante la conversación con <strong>${patientName}</strong>.
                Te recomendamos revisar la sesión y contactar a tu paciente a la brevedad.
              </p>

              <!-- Botón CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#7c3aed;border-radius:10px;">
                    <a href="${patientUrl}"
                       style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                      Ver perfil del paciente →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
                ID de sesión: <code>${sessionId}</code>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Este mensaje fue generado automáticamente por AVI.<br/>
                Si tienes dudas, escríbenos a
                <a href="mailto:noreply@avi-app.com.mx" style="color:#7c3aed;">noreply@avi-app.com.mx</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#d1d5db;">
                Línea de la Vida (crisis): <strong>800 911 2000</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
