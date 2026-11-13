// /patient/privacidad — Mi privacidad y consentimiento (8 nov 2026). Derecho de Acceso (ARCO):
// la persona ve su opción vigente de la Escucha de AVI, el Consentimiento que firmó (texto exacto
// guardado), los datos de cada firma y el historial; puede descargarlo en PDF. Pantalla y PDF con el mismo
// formato que el reporte del <pro> (src/lib/consentimiento-reporte.ts, 13 nov 2026). Solo lectura:
// el cambio lo habilita su <pro> (Derechos ARCO) y llega a /patient/consentimiento.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiAccess } from '@/lib/audit/log-access'
import { getTerminologiaPaciente } from '@/lib/terminologia-paciente'
import { terminos } from '@/lib/terminologia'
import { dispositivoDe, nombreOpcion, escuchaPermitida } from '@/lib/consentimiento'
import { filasFirma, notaFirma, fechaHoraFirma, SELLO_FIRMA, type DatosReporteConsentimiento } from '@/lib/consentimiento-reporte'
import { NOMBRE_ORIGEN } from '@/lib/consentimiento'
import { estadoConsentimiento, historialFirmas } from '@/lib/consentimiento-servidor'
import TextoLegal from '@/components/TextoLegal'
import DescargarConsentimiento from './DescargarConsentimiento'

export const dynamic = 'force-dynamic'

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-MX', {
  timeZone: 'America/Mexico_City', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export default async function PrivacidadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const [estado, firmas, terminologia, { data: perfil }] = await Promise.all([
    estadoConsentimiento(admin, user.id),
    historialFirmas(admin, user.id),
    getTerminologiaPaciente(admin, user.id),
    admin.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle(),
  ])
  // Encabezado del PDF: su <pro> y el logo de su empresa (vínculo activo más reciente, como empresaDeLaPersona)
  const { data: vinculos } = await admin.from('therapist_patients')
    .select('therapist_id, empresa_id, is_active, created_at')
    .eq('patient_id', user.id).neq('status', 'archived').order('created_at', { ascending: false })
  const rel = (vinculos ?? []).find(v => v.is_active) ?? vinculos?.[0]
  const [{ data: pro }, { data: empresa }] = await Promise.all([
    rel ? admin.from('profiles').select('full_name').eq('id', rel.therapist_id).maybeSingle() : Promise.resolve({ data: null }),
    rel?.empresa_id ? admin.from('convenio_empresas').select('logo_url').eq('id', rel.empresa_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  logApiAccess(supabase, user.id, '/patient/privacidad', 'GET')
  const w = terminos(terminologia)
  const vigente = firmas[0] ?? null
  const reporte: DatosReporteConsentimiento | null = vigente ? {
    nombre: perfil?.full_name || perfil?.email || user.email || '—',
    email: perfil?.email ?? user.email ?? null,
    terminologia,
    textoVigente: vigente.texto_firmado,
    firmas: firmas.map(f => ({
      version: f.version, opcion: f.opcion_escucha, origen: f.origen, firmado_at: f.firmado_at,
      ip: f.ip, dispositivo: dispositivoDe(f.user_agent), sha256: f.texto_sha256,
    })),
  } : null

  return (
    <div className="max-w-lg mx-auto px-5 py-6 space-y-5">
      <Link href="/patient/chat" className="text-sm text-gray-500 hover:text-gray-700">← Regresar</Link>
      <h1 className="text-xl font-bold text-gray-800">🔒 Mi privacidad y consentimiento</h1>

      {!vigente || !reporte ? (
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 space-y-2">
          <p className="text-sm text-gray-600">Aún no firmas el Consentimiento Informado actual de AVI.</p>
          <Link href="/patient/consentimiento" className="inline-block text-sm font-semibold text-primary-600 hover:text-primary-800">Elegir mi opción y firmar →</Link>
        </div>
      ) : (
        <>
          {/* Opción vigente */}
          <div className={`rounded-2xl border px-5 py-4 space-y-1 ${escuchaPermitida(vigente.opcion_escucha) ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Registro de mis sesiones con mi {w.pro}</p>
            <p className="text-base font-semibold text-gray-800">{nombreOpcion(vigente.opcion_escucha, terminologia)}</p>
            <p className="text-xs text-gray-500">Desde el {fechaHora(vigente.firmado_at)}</p>
          </div>

          {estado.solicitud && (
            <Link href="/patient/consentimiento"
              className="block bg-amber-50 border-2 border-amber-200 rounded-2xl px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100">
              Tu {w.pro} te habilitó el cambio de tu opción. Elegir y firmar →
            </Link>
          )}
          {!estado.alDia && !estado.solicitud && (
            <Link href="/patient/consentimiento"
              className="block bg-amber-50 border-2 border-amber-200 rounded-2xl px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100">
              Hay una versión nueva del Consentimiento Informado. Elegir y firmar →
            </Link>
          )}

          <DescargarConsentimiento datos={reporte} proNombre={(pro as { full_name?: string } | null)?.full_name ?? '—'}
            logoUrl={(empresa as { logo_url?: string | null } | null)?.logo_url ?? null} />

          {/* Mismo contenido que el PDF: texto exacto que firmé + firma electrónica + historial */}
          <details className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
            <summary className="text-sm font-semibold text-gray-700 cursor-pointer">Ver el Consentimiento que firmé (versión {vigente.version})</summary>
            <TextoLegal texto={vigente.texto_firmado} className="mt-4" />
          </details>

          <div className="bg-white border-2 border-primary-300 rounded-2xl px-4 py-4 space-y-3">
            <p className="text-sm font-semibold text-primary-700">Firma electrónica del {w.user}</p>
            <span className="inline-block text-[11px] font-bold text-emerald-700 border border-emerald-600 rounded px-2 py-0.5">{SELLO_FIRMA}</span>
            <dl className="divide-y divide-primary-100 border border-primary-100 rounded-xl text-sm">
              {filasFirma(reporte).map(([k, v]) => (
                <div key={k} className="px-3 py-2">
                  <dt className="text-xs font-semibold text-primary-700">{k}</dt>
                  <dd className="text-gray-700 break-all">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11px] text-gray-500 leading-relaxed text-justify">{notaFirma(terminologia)}</p>
          </div>

          {reporte.firmas.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-primary-700">Historial de firmas ({reporte.firmas.length})</p>
              <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
                {reporte.firmas.map((f, i) => (
                  <div key={f.firmado_at} className="px-4 py-3 text-sm space-y-0.5">
                    <p className="font-medium text-gray-800">
                      {nombreOpcion(f.opcion, terminologia)}
                      {i === 0 && <span className="ml-2 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Vigente</span>}
                    </p>
                    <p className="text-xs text-gray-500">{fechaHoraFirma(f.firmado_at)} · Versión {f.version} · {NOMBRE_ORIGEN[f.origen]}</p>
                    <p className="text-xs text-gray-400 break-all">IP {f.ip ?? '—'} · {f.dispositivo}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 leading-relaxed">
            Para cambiar tu opción, revocar tu consentimiento o ejercer tus Derechos ARCO, solicítalo a tu {w.pro}.
          </p>
        </>
      )}
    </div>
  )
}
