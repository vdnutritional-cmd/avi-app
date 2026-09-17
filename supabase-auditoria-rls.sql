-- ============================================================
-- Sprint 23 — Panel /admin/auditoria: RLS para lectura admin
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Agregar política de lectura para el administrador de la plataforma
-- El admin se identifica por el email definido en ADMIN_EMAIL (env var)
-- En producción: pepe.vargas.papa@gmail.com

CREATE POLICY "audit_log_admin_read" ON public.audit_log
  FOR SELECT
  USING (
    (auth.jwt() ->> 'email') = 'pepe.vargas.papa@gmail.com'
  );

-- Política de INSERT para service_role (triggers SECURITY DEFINER ya la tienen implícita,
-- pero el middleware usa anon/user key — necesita permiso de insert)
-- Nota: si el middleware está en Edge Runtime, usa el anon key del usuario autenticado.
-- El SECURITY DEFINER del trigger lo maneja. Para el insert directo del middleware:
CREATE POLICY "audit_log_authenticated_insert" ON public.audit_log
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
