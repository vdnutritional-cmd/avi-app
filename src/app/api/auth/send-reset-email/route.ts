import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resend, EMAIL_FROM } from '@/lib/email'

/**
 * POST /api/auth/send-reset-email
 * Genera un link de recuperación de contraseña via Supabase Admin SDK
 * y lo envía con Resend (evita depender del SMTP de Supabase).
 * Siempre responde { ok: true } para no revelar si el correo existe.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ ok: true }) // respuesta silenciosa

    const admin = createAdminClient()

    // Generar link de recuperación server-side
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
      },
    })

    if (error || !data?.properties?.action_link) {
      console.error('[send-reset-email] generateLink error:', error?.message)
      return NextResponse.json({ debug: 'generateLink failed', error: error?.message })
    }

    const resetLink = data.properties.action_link

    // Enviar email con Resend
    const { error: sendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: 'Recupera tu contraseña en AVI',
      html: resetEmailHtml({ resetLink }),
    })

    if (sendError) {
      console.error('[send-reset-email] Resend error:', sendError)
      return NextResponse.json({ debug: 'resend failed', error: JSON.stringify(sendError) })
    }

    return NextResponse.json({ ok: true, debug: 'sent', link: resetLink })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[send-reset-email] Error inesperado:', msg)
    return NextResponse.json({ ok: true }) // siempre respuesta silenciosa
  }
}

// ── Template HTML ──────────────────────────────────────────────────────────────

function resetEmailHtml({ resetLink }: { resetLink: string }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recupera tu contraseña — AVI</title>
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
              <p style="margin:6px 0 0;font-size:13px;color:#ddd6fe;">Acompañamiento Virtual Integral</p>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;">Hola,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en AVI.
                Toca el botón de abajo para crear una nueva contraseña.
              </p>

              <!-- Botón CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#7c3aed;border-radius:10px;">
                    <a href="${resetLink}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                      Crear nueva contraseña →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
                Este enlace expira en <strong>1 hora</strong>. Si no solicitaste recuperar tu contraseña,
                puedes ignorar este correo — tu cuenta está segura.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Este mensaje fue generado automáticamente por AVI.<br/>
                <a href="mailto:noreply@avi-app.com.mx" style="color:#7c3aed;">noreply@avi-app.com.mx</a>
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
