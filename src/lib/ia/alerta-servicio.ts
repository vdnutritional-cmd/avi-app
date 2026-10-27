// Aviso al administrador de AVI cuando un servicio de IA externo deja de responder por
// cuenta, pago o límite del plan (27 oct 2026; primero Groq, la transcripción de sesión).
// Correo a ADMIN_EMAIL como máximo una vez cada 6 h por servicio y motivo; cada aviso queda en audit_log.
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resend, EMAIL_FROM } from '@/lib/email'

export type MotivoFalla = 'pago' | 'limite' | 'clave'

const CADA_MS = 6 * 60 * 60 * 1000

const QUE_HACER: Record<MotivoFalla, string> = {
  pago:   'Parece un problema de pago o de saldo. Entra a la consola del servicio › Billing y revisa el método de pago, el saldo y el límite de gasto.',
  limite: 'Se alcanzó el límite de uso del plan. Si se repite seguido, conviene subir de plan en la consola del servicio › Billing.',
  clave:  'La clave de la API no es válida o fue revocada. Genera otra en la consola del servicio y actualízala en Vercel (y en .env.local).',
}

export function avisarFallaServicioIA(servicio: string, motivo: MotivoFalla, detalle: string) {
  const avisar = async () => {
    const db = createAdminClient()
    const operacion = `ALERTA:${servicio}:${motivo}`
    const { data: ultimo } = await db.from('audit_log').select('created_at')
      .eq('operacion', operacion).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < CADA_MS) return

    await db.from('audit_log').insert({
      usuario_id: null, operacion, tabla: 'servicio_ia', registro_id: null,
      datos_despues: { servicio, motivo, detalle: detalle.slice(0, 500) },
    })
    const para = process.env.ADMIN_EMAIL
    if (!para || !process.env.RESEND_API_KEY) return
    await resend.emails.send({
      from: EMAIL_FROM,
      to: para,
      subject: `⚠️ AVI: ${servicio} no está respondiendo (${motivo})`,
      text: [
        `${servicio} rechazó una petición de AVI y los terapeutas no pueden usar esa función.`,
        '',
        `Qué hacer: ${QUE_HACER[motivo]}`,
        '',
        `Respuesta del servicio: ${detalle.slice(0, 500)}`,
        '',
        'Los terapeutas conservan su grabación en el navegador y pueden reintentar cuando se resuelva.',
        'Este aviso se envía como máximo una vez cada 6 horas.',
      ].join('\n'),
    }).catch(e => console.error('[alerta-servicio] correo', e))
  }
  try {
    after(avisar)
  } catch {
    void avisar()
  }
}
