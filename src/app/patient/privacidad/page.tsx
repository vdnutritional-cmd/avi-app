// /patient/privacidad — Mi privacidad y consentimiento (8 nov 2026). Derecho de Acceso (ARCO):
// la persona ve su opción vigente de la Escucha de AVI, el Consentimiento que firmó (texto exacto
// guardado), los datos de cada firma y el historial; puede descargarlo en PDF. Solo lectura:
// el cambio lo habilita su <pro> (Derechos ARCO) y llega a /patient/consentimiento.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiAccess } from '@/lib/audit/log-access'
import { getTerminologiaPaciente } from '@/lib/terminologia-paciente'
import { terminos } from '@/lib/terminologia'
import { dispositivoDe, nombreOpcion, NOMBRE_ORIGEN, escuchaPermitida } from '@/lib/consentimiento'
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
    admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ])
  logApiAccess(supabase, user.id, '/patient/privacidad', 'GET')
  const w = terminos(terminologia)
  const vigente = firmas[0] ?? null

  return (
    <div className="max-w-lg mx-auto px-5 py-6 space-y-5">
      <Link href="/patient/chat" className="text-sm text-gray-500 hover:text-gray-700">← Regresar</Link>
      <h1 className="text-xl font-bold text-gray-800">🔒 Mi privacidad y consentimiento</h1>

      {!vigente ? (
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

          {/* Firmas */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mis firmas</p>
            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
              {firmas.map((f, i) => (
                <div key={f.id} className="px-4 py-3 text-sm space-y-0.5">
                  <p className="font-medium text-gray-800">
                    {nombreOpcion(f.opcion_escucha, terminologia)}
                    {i === 0 && <span className="ml-2 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Vigente</span>}
                  </p>
                  <p className="text-xs text-gray-500">{fechaHora(f.firmado_at)} · Versión {f.version} · {NOMBRE_ORIGEN[f.origen]}</p>
                  <p className="text-xs text-gray-400">IP {f.ip ?? '—'} · {dispositivoDe(f.user_agent)}</p>
                </div>
              ))}
            </div>
          </div>

          <DescargarConsentimiento
            nombre={perfil?.full_name ?? user.email ?? ''}
            texto={vigente.texto_firmado}
            datos={[
              ['Fecha y hora', fechaHora(vigente.firmado_at)],
              ['Versión', String(vigente.version)],
              ['Opción elegida', nombreOpcion(vigente.opcion_escucha, terminologia)],
              ['Dirección IP', vigente.ip ?? '—'],
              ['Dispositivo', dispositivoDe(vigente.user_agent)],
              ['Huella del texto (SHA-256)', vigente.texto_sha256],
            ]}
          />

          {/* Texto exacto que firmé */}
          <details className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
            <summary className="text-sm font-semibold text-gray-700 cursor-pointer">Ver el Consentimiento que firmé</summary>
            <TextoLegal texto={vigente.texto_firmado} className="mt-4" />
          </details>

          <p className="text-xs text-gray-500 leading-relaxed">
            Para cambiar tu opción, revocar tu consentimiento o ejercer tus Derechos ARCO, solicítalo a tu {w.pro}.
          </p>
        </>
      )}
    </div>
  )
}
