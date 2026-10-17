// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/convertir-paciente — Conversión de paciente a terapeuta (17 oct 2026)
// Caso: alguien se registró por error como paciente y en realidad es terapeuta;
// Supabase solo admite una cuenta por correo, así que no puede registrarse de nuevo.
//
//   GET  ?email=…              → vista previa: qué tiene esa cuenta (no cambia nada)
//   POST { email }             → convierte la MISMA cuenta (mismo correo y contraseña)
//
// Al convertir: cierra sus sesiones AVI abiertas (con su resumen), archiva sus vínculos
// como paciente (therapist_patients status 'archived', como Fusionar/Transferir: sale de
// "Mis pacientes" de su terapeuta) y cambia su rol a 'therapist'. No borra nada (NOM-024):
// expediente, sesiones y mensajes se conservan. Pierde su acceso como paciente.
// Acceso: solo el superadmin (ADMIN_EMAIL). Queda en audit_log.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarCuentaPorEmail } from '@/lib/registro-email'
import { cerrarSesionesAbiertas } from '@/lib/cerrar-sesion-avi'
import { logApiAccess } from '@/lib/audit/log-access'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'pepe.vargas.papa@gmail.com'
const RUTA = '/api/admin/convertir-paciente'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return { supabase, user }
}

type Admin = ReturnType<typeof createAdminClient>

/** Cuenta de paciente de ese correo, o el mensaje de por qué no se puede convertir */
async function buscarPaciente(admin: Admin, email: string) {
  const correo = email.trim().toLowerCase()
  const cuenta = await buscarCuentaPorEmail(admin, correo)
  if (!cuenta) return { error: `No hay ninguna cuenta en AVI con el correo ${correo}.`, status: 404 }
  if (cuenta.role === 'therapist') return { error: `El correo ${correo} ya es una cuenta de terapeuta o asesor.`, status: 400 }
  if (cuenta.role !== 'patient') return { error: `El correo ${correo} no es una cuenta de paciente.`, status: 400 }

  const { data: perfil } = await admin
    .from('profiles').select('id, full_name, email, role, registro_token, created_at')
    .eq('id', cuenta.userId).maybeSingle()
  if (!perfil || perfil.role !== 'patient') {
    return { error: `La cuenta de ${correo} aún no termina su registro en AVI.`, status: 404 }
  }
  return { perfil }
}

async function vistaPrevia(admin: Admin, patientId: string) {
  const [{ data: vinculos }, { count: sesiones }, { count: abiertas }, { count: expedientes }] = await Promise.all([
    admin.from('therapist_patients')
      .select('therapist_id, empresa_id, status, created_at, terapeuta:profiles!therapist_patients_therapist_id_fkey(full_name, email), convenio_empresas(nombre)')
      .eq('patient_id', patientId)
      .neq('status', 'archived')
      .order('created_at', { ascending: true }),
    admin.from('sessions').select('id', { count: 'exact', head: true }).eq('patient_id', patientId),
    admin.from('sessions').select('id', { count: 'exact', head: true }).eq('patient_id', patientId).eq('status', 'active'),
    admin.from('patient_expediente').select('patient_id', { count: 'exact', head: true }).eq('patient_id', patientId),
  ])
  return {
    vinculos: (vinculos ?? []).map(v => {
      const t = (Array.isArray(v.terapeuta) ? v.terapeuta[0] : v.terapeuta) as { full_name?: string; email?: string } | null
      const e = (Array.isArray(v.convenio_empresas) ? v.convenio_empresas[0] : v.convenio_empresas) as { nombre?: string } | null
      return {
        terapeuta: t?.full_name || t?.email || '—',
        empresa: e?.nombre ?? null,
        status: v.status as string,
        desde: v.created_at as string,
      }
    }),
    sesionesAvi: sesiones ?? 0,
    sesionesAbiertas: abiertas ?? 0,
    tieneExpediente: (expedientes ?? 0) > 0,
  }
}

// ── GET ?email= → vista previa ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await verifyAdmin()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = req.nextUrl.searchParams.get('email')
  if (!email?.trim()) return NextResponse.json({ error: 'Escribe un correo.' }, { status: 400 })

  const admin = createAdminClient()
  const r = await buscarPaciente(admin, email)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })

  logApiAccess(auth.supabase, auth.user.id, RUTA, 'GET', { patient_id: r.perfil.id })
  return NextResponse.json({
    cuenta: { id: r.perfil.id, nombre: r.perfil.full_name ?? '', email: r.perfil.email ?? email.trim().toLowerCase(), creado: r.perfil.created_at },
    ...(await vistaPrevia(admin, r.perfil.id)),
  })
}

// ── POST { email } → convertir ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email } = await req.json().catch(() => ({}))
  if (!email?.trim()) return NextResponse.json({ error: 'Escribe un correo.' }, { status: 400 })

  const admin = createAdminClient()
  const r = await buscarPaciente(admin, email)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  const { perfil } = r

  // 1. Cerrar sus sesiones AVI abiertas (con resumen) mientras aún es paciente
  await cerrarSesionesAbiertas(admin, { patientId: perfil.id })

  // 2. Archivar sus vínculos como paciente: sale de "Mis pacientes" de su terapeuta
  const { data: archivados, error: errVinculos } = await admin
    .from('therapist_patients')
    .update({ status: 'archived', is_active: false })
    .eq('patient_id', perfil.id)
    .neq('status', 'archived')
    .select('therapist_id')
  if (errVinculos) return NextResponse.json({ error: `No se pudieron archivar sus vínculos: ${errVinculos.message}` }, { status: 500 })

  // 3. Rol de terapeuta (con su QR de registro de pacientes)
  const { error: errPerfil } = await admin
    .from('profiles')
    .update({ role: 'therapist', ...(perfil.registro_token ? {} : { registro_token: crypto.randomUUID() }) })
    .eq('id', perfil.id)
  if (errPerfil) return NextResponse.json({ error: `No se pudo cambiar el rol: ${errPerfil.message}` }, { status: 500 })

  // 4. El rol también vive en auth user_metadata (lo leen algunas verificaciones)
  const { data: authUser } = await admin.auth.admin.getUserById(perfil.id)
  await admin.auth.admin.updateUserById(perfil.id, {
    user_metadata: { ...(authUser?.user?.user_metadata ?? {}), role: 'therapist' },
  })

  logApiAccess(auth.supabase, auth.user.id, RUTA, 'POST', {
    patient_id: perfil.id,
    vinculos_archivados: (archivados ?? []).map(v => v.therapist_id),
  })

  return NextResponse.json({ ok: true, nombre: perfil.full_name ?? '', vinculosArchivados: archivados?.length ?? 0 })
}
