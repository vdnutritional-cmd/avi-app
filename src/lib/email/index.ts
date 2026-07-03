import { Resend } from 'resend'

// Cliente Resend — usar solo en Server Components / API routes
export const resend = new Resend(process.env.RESEND_API_KEY)

export const EMAIL_FROM = 'AVI <noreply@avi-app.com.mx>'
