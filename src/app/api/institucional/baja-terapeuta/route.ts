// ─────────────────────────────────────────────────────────────
// /api/institucional/baja-terapeuta
//
// Acceso: Personas Institucionales con nivel N1 o N2 únicamente.
// Solo pueden afectar la empresa a la que pertenecen como PI.
//
// GET  ?empresa_id=xxx  → lista terapeutas activos de esa empresa
// DELETE { therapistId, empresaId } → quita therapist_empresa row
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Verifica que el usuario activo sea un PI con nivel N1 o N2 para la empresa dada.
 *  Retorna el registro PI si pasa, o null si no está autorizado. */
async function requirePI_N1N2(empresaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Solo terapeutas
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'therapist') return null

  // Debe tener un registro activo N1 o N2 para ESA empresa
  const admin = createAdminClient()
  const { data: pi } = await admin
    .from('convenio_personas_institucionales')
    .select('id, nivel, empresa_id')
    .eq('therapist_id', user.id)
    .eq('empresa_id', empresaId)
    .eq('is_active', true)
    .in('nivel', ['N1', 'N2'])
    .maybeSingle()

  return pi ?? null
}

// ── GET — listar terapeutas activos en therapist_empresa para la empresa ─────
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get('empresa_id')
  if (!empresaId) return NextResponse.json({ error: 'empresa_id requerido' }, { status: 400 })

  const pi = await requirePI_N1N2(empresaId)
  if (!pi) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const admin = createAdminClient()

  // Terapeutas vinculados a esta empresa
  const { data: rows, error } = await admin
    .from('therapist_empresa')
    .select('therapist_id, profiles!therapist_id(full_name, email)')
    .eq('empresa_id', empresaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Contar pacientes activos de cada terapeuta en esta empresa
  const terapeutas = await Promise.all(
    (rows ?? []).map(async (r: any) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      const { count } = await admin
        .from('therapist_patients')
        .select('*', { count: 'exact', head: true })
        .eq('therapist_id', r.therapist_id as string)
        .eq('empresa_id', empresaId)
        .eq('is_active', true)
      return {
        therapistId:      r.therapist_id as string,
        nombre:           p?.full_name ?? p?.email ?? r.therapist_id,
        email:            p?.email ?? '',
        pacientesActivos: count ?? 0,
      }
    })
  )

  // Ordenar por nombre
  terapeutas.sort((a, b) => a.nombre.localeCompare(b.nombre))

  return NextResponse.json({ terapeutas })
}

// ── DELETE — dar de baja (quitar de therapist_empresa) ───────────────────────
export async function DELETE(req: NextRequest) {
  const body = await req.json() as { therapistId: string; empresaId: string }
  const { therapistId, empresaId } = body

  if (!therapistId || !empresaId) {
    return NextResponse.json({ error: 'therapistId y empresaId requeridos' }, { status: 400 })
  }

  // El PI solo puede actuar sobre SU propia empresa
  const pi = await requirePI_N1N2(empresaId)
  if (!pi) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const admin = createAdminClient()

  // Verificar que el terapeuta realmente está en therapist_empresa para esta empresa
  const { data: existing } = await admin
    .from('therapist_empresa')
    .select('id')
    .eq('therapist_id', therapistId)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'El terapeuta no está registrado en esta empresa' }, { status: 404 })
  }

  const { error } = await admin
    .from('therapist_empresa')
    .delete()
    .eq('therapist_id', therapistId)
    .eq('empresa_id', empresaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    mensaje: 'Terapeuta dado de baja de la empresa correctamente.',
  })
}
