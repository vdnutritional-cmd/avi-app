// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/personas-institucionales — CRUD de Personas Institucionales
// Solo accesible por el administrador (verifica ADMIN_EMAIL).
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarCuentaPorEmail } from '@/lib/registro-email'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'pepe.vargas.papa@gmail.com'
const MAX_PERSONAS = 5

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

// ── GET /api/admin/personas-institucionales?empresa_id=xxx ────────────────────
export async function GET(req: NextRequest) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  if (!empresa_id) return NextResponse.json({ error: 'empresa_id requerido' }, { status: 400 })

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('convenio_personas_institucionales')
    .select('id, empresa_id, therapist_id, nivel, opera_como_terapeuta, is_active, created_at, profiles(full_name, email)')
    .eq('empresa_id', empresa_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const personas = (data ?? []).map(p => ({
    id:                   p.id,
    empresa_id:           p.empresa_id,
    therapist_id:         p.therapist_id,
    nivel:                p.nivel,
    opera_como_terapeuta: p.opera_como_terapeuta,
    is_active:            p.is_active,
    created_at:           p.created_at,
    nombre: (p.profiles as { full_name?: string; email?: string } | null)?.full_name ?? '',
    email:  (p.profiles as { full_name?: string; email?: string } | null)?.email    ?? '',
  }))

  return NextResponse.json({ personas })
}

// ── POST /api/admin/personas-institucionales ──────────────────────────────────
// Body: { empresa_id, therapist_id | email, nivel, opera_como_terapeuta }
// Con `email` se puede registrar a una persona que NO está asignada a la empresa
// (17 oct 2026): debe tener cuenta de terapeuta/asesor en AVI, porque Administración
// solo admite esas cuentas (institucional/layout.tsx). No la liga a la empresa
// como terapeuta (therapist_empresa): solo le da acceso a Administración.
export async function POST(req: NextRequest) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { empresa_id, nivel, opera_como_terapeuta, email } = body
  let { therapist_id } = body

  if (!empresa_id || (!therapist_id && !email) || !nivel) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }
  if (!['N1', 'N2', 'N3'].includes(nivel)) {
    return NextResponse.json({ error: 'Nivel inválido' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (!therapist_id) {
    const correo = String(email).trim().toLowerCase()
    const cuenta = await buscarCuentaPorEmail(admin, correo)
    if (!cuenta) {
      return NextResponse.json({
        error: `No hay ninguna cuenta en AVI con el correo ${correo}. Pídele que primero se registre como terapeuta o asesor en AVI.`,
      }, { status: 404 })
    }
    if (cuenta.role !== 'therapist') {
      return NextResponse.json({
        error: `El correo ${correo} está registrado en AVI, pero no como terapeuta o asesor. Una Persona Institucional necesita una cuenta de terapeuta o asesor.`,
      }, { status: 400 })
    }
    therapist_id = cuenta.userId
  }

  // Validar que el therapist_id exista como terapeuta
  const { data: therapistProfile } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', therapist_id)
    .eq('role', 'therapist')
    .single()

  if (!therapistProfile) {
    return NextResponse.json({ error: email
      ? 'La cuenta de ese correo aún no termina su registro en AVI (sin perfil de terapeuta o asesor).'
      : 'El terapeuta no existe o no tiene role=therapist' }, { status: 404 })
  }

  // Validar límite de 5 personas por empresa
  const { count } = await admin
    .from('convenio_personas_institucionales')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresa_id)

  if ((count ?? 0) >= MAX_PERSONAS) {
    return NextResponse.json({ error: `Límite de ${MAX_PERSONAS} personas institucionales por empresa alcanzado` }, { status: 400 })
  }

  const { data, error } = await admin
    .from('convenio_personas_institucionales')
    .insert({
      empresa_id,
      therapist_id,
      nivel,
      opera_como_terapeuta: opera_como_terapeuta ?? true,
    })
    .select()
    .single()

  if (error) {
    const msg = error.message.includes('unique')
      ? `${therapistProfile.full_name || therapistProfile.email} ya es persona institucional de esta empresa`
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({ persona: { ...data, nombre: therapistProfile.full_name, email: therapistProfile.email } })
}

// ── PATCH /api/admin/personas-institucionales ─────────────────────────────────
// Body: { id, nivel?, opera_como_terapeuta?, is_active? }
export async function PATCH(req: NextRequest) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, nivel, opera_como_terapeuta, is_active } = body

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (nivel              !== undefined) updates.nivel                = nivel
  if (opera_como_terapeuta !== undefined) updates.opera_como_terapeuta = opera_como_terapeuta
  if (is_active          !== undefined) updates.is_active            = is_active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('convenio_personas_institucionales')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// ── DELETE /api/admin/personas-institucionales ────────────────────────────────
// Body: { id }
export async function DELETE(req: NextRequest) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('convenio_personas_institucionales')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
