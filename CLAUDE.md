# AVI Therapy Companion App — Contexto para Claude Code

> **Versión:** 1.0 (cerrada) · **Actualizado:** 10 octubre 2026  
> Este archivo es el punto de entrada para cualquier sesión de Claude Code en este proyecto.  
> Léelo completo antes de modificar cualquier archivo.

---

## ¿Qué es AVI?

**AVI Therapy Companion** es una plataforma SaaS clínica para terapeutas psicológicos en México.  
Tiene dos roles principales:

- **Terapeuta** — gestiona su consultorio, pacientes, expedientes clínicos y reportes
- **Paciente** — accede a AVI-Consúltame (chat terapéutico IA) y cuestionarios

Módulos transversales: **Administración** (superadmin), **Panel Institucional** (empresas con convenio) y **App móvil Expo** (AVI-TCA).

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 3 |
| Base de datos | Supabase (PostgreSQL + pgvector + RLS) |
| Auth | Supabase Auth (email/password + MFA TOTP) |
| IA — chat paciente | Anthropic `claude-haiku-4-5-20251001` (también patrones y Reporte de la Atención) |
| IA — análisis | `claude-sonnet-5` con RAG multi-perfil (expediente, HC, análisis clínicos); `claude-sonnet-4-6` en emociones/recursos de sesiones |
| IA — embeddings | OpenAI `text-embedding-3-small` (1536) |
| Voz | TTS **Amazon Polly** (Mia, es-MX) en `/api/voice/tts`; dictado con **Web Speech API** del navegador. ElevenLabs **no se usa** (`/api/voice/stt` es legado, sin llamadas) |
| Pagos | Stripe (checkout + webhooks) |
| Email | Resend |
| Push | Web Push API + Expo Push (app móvil) |
| Deploy | Vercel (auto-deploy desde `main`) |
| Dominio | avi-app.com.mx |

---

## Estructura de rutas principales

```
src/app/
├── page.tsx                        Landing page pública
├── pricing/page.tsx                Planes y precios
├── registro-consultorio/page.tsx   Registro público vía QR
├── install/page.tsx                Guía de instalación PWA

├── auth/
│   ├── login/                      Login con rate-limit (5 intentos)
│   ├── register/                   Registro terapeuta
│   ├── register-with-code/         Registro con código CONVENIO
│   ├── mfa/                        Verificación TOTP en login
│   ├── forgot-password/
│   └── reset-password/

├── patient/                        Panel del paciente
│   ├── chat/page.tsx               AVI-Consúltame (chat IA con voz)
│   ├── discover/page.tsx           Pantalla de crisis / descubre
│   ├── onboarding/page.tsx
│   └── cuestionario/[id]/page.tsx  Cuestionarios asignados

├── therapist/                      Panel del terapeuta
│   ├── layout.tsx                  Gate de suscripción + Sidebar + ReportesPanel
│   ├── dashboard/page.tsx
│   ├── patients/
│   │   ├── page.tsx                Lista de pacientes (buscador)
│   │   └── [patientId]/page.tsx    ★ Perfil completo del paciente (2300+ líneas)
│   ├── reportes/
│   │   ├── page.tsx                Server component → ReportesPageClient
│   │   ├── ReportesPageClient.tsx  Layout EHR desktop (sidebar + contenido)
│   │   └── reporte-atencion-print.ts  Utilidad compartida PDF 9 secciones
│   ├── asesorias/page.tsx          Estadísticas de asesorías mensuales
│   ├── estadisticas/page.tsx       Dashboard estadístico con filtros
│   ├── configuracion/
│   │   ├── terapia/page.tsx        Enfoque terapéutico (RAG multi-perfil)
│   │   ├── seguridad/page.tsx      Enrolamiento MFA
│   │   └── politica-baja/page.tsx
│   ├── auditoria/page.tsx          Log de accesos NOM-024
│   ├── mi-qr/page.tsx              QR de registro de consultorio
│   ├── fusionar-paciente/page.tsx
│   └── transferir-paciente/page.tsx

├── institucional/                  Panel empresa/convenio
│   ├── layout.tsx
│   ├── dashboard/page.tsx          AVI - Panel Institucional
│   ├── reporte-terapeuta/page.tsx
│   └── reporte-general/page.tsx

├── admin/                          Panel superadmin
│   ├── AdminSidebar.tsx            Sidebar admin (Volver a AVI + Cerrar sesión → `/`)
│   ├── page.tsx                    Panel de Control — SOLO INFORMATIVO (stats, pendientes, Control de Planes, pago caído, cumplimiento)
│   ├── ControlPlanesTabla.tsx      Tabla "Control de Planes y Contrataciones" (acordeones <details>, fila Total)
│   ├── terapeutas/page.tsx         ACCIONES: Aprobar gratis permanente, Companion, tier, revocar, desactivar/reactivar
│   ├── convenio/page.tsx           Códigos CONVENIO + logos de empresa
│   ├── convenio-empresas/page.tsx  Teléfono + logo + Personas Institucionales por empresa
│   ├── reportes/page.tsx
│   └── auditoria/page.tsx

└── api/                            API Routes (todas server-side)
    ├── chat/route.ts               IA chat paciente (Claude + RAG)
    ├── analysis/route.ts           Análisis clínico IA (Claude + RAG)
    ├── analisis-clinicos/route.ts  Expediente: McMaster + diagnóstico
    ├── cron/
    │   ├── bloquear-inactivos/     Cron diario 09:00 UTC — bloqueo por inactividad (15/30/45 días según frecuencia) → status 'inactive'
    │   └── desactivar-companion-expirados/  Cron diario 10:00 UTC — expira bundles companion
    ├── historia-clinica/route.ts   HC Original / HC Actualizada
    ├── expediente-analysis/route.ts
    ├── therapist/
    │   ├── reportes-init/          Empresas + pacientes activos (para panel reportes)
    │   ├── reporte-atencion/       Datos para PDF Reporte de la Atención
    │   ├── sesiones-lista/         Lista de sesiones del paciente
    │   ├── analisis-lista/         Lista de análisis del paciente
    │   ├── reporte-asesorias/      Estadísticas mensuales
    │   ├── fusionar-paciente/
    │   ├── transferir-paciente/
    │   └── paciente-empresa/
    ├── patient/
    │   └── contacto/route.ts       Contacto del paciente para la bienvenida (empresa o terapeuta)
    ├── institucional/
    │   └── baja-terapeuta/         GET/DELETE therapist_empresa (solo PI N1/N2 de su empresa)
    ├── stripe/
    │   ├── checkout/route.ts       Crea sesión Stripe (CONVENIO: solo valida código) / activa Companion
    │   └── webhook/route.ts        Activa suscripción + liga empresa + marca código (con pago confirmado)
    ├── auth/
    │   ├── login/route.ts          Auth con rate-limit + audit log + bloqueo de terapeuta desactivado
    │   ├── estado-cuenta/route.ts  GET (Bearer) → { desactivado, institucional } para la app móvil
    │   ├── logout/route.ts
    │   ├── registro-consultorio/   Crea paciente desde QR público
    │   └── confirm-patient/
    ├── admin/
    │   ├── convenio-codes/
    │   ├── convenio-empresas/
    │   ├── personas-institucionales/
    │   └── therapist-empresa/
    └── voice/ (tts + stt)          tts: Amazon Polly · stt: legado sin uso
```

---

## Componentes clave del panel terapeuta

### `src/app/therapist/patients/[patientId]/page.tsx`
El archivo más grande (~2300 líneas). Es un **client component** que maneja:
- Estado global del tab activo (`activeTab: PatientTab`)
- **Sidebar EHR desktop:** `hidden md:block w-48` con navItems
- **Panel Nav móvil:** `md:hidden fixed top-4 right-4 z-30` botón + panel deslizante derecho (`translate-x-full → translate-x-0`)
- Tabs **AVI-Esencial:** `datos-generales`, `tipo-caso`, `sesiones`, `nota`, `presenciales`, `analisis`, `derivaciones-cierres`
- Tabs **AVI-Clínico** (requiere `tier === 'clinico'`): `individual`, `familiar`, `pareja`, `prediagnostico`, `analisis-clinicos`, `cuestionarios`, `impresiones`

### `src/app/therapist/layout.tsx`
- Fetch de perfil, suscripción, membresía institucional
- Gate: sin plan activo → `<ActivarPlan>`
- Renderiza: `<Sidebar>` + `<main>` + `<ReportesPanel>` + `<PushRegistrar>` + `<WhatsAppSupport>`

### `src/app/therapist/Sidebar.tsx`
- Colapsable en móvil (hamburger `fixed top-4 left-4 z-40`)
- Orden "Registro de pacientes": Mi QR → Fusionar → Transferir → Códigos
- "Reportes terapéuticos": `<Link>` desktop (`hidden md:flex`) + `<button>` dispatch evento móvil (`md:hidden`)
- Muestra tier y patient_slots en sección Suscripción

### `src/app/therapist/ReportesPanel.tsx`
- **Solo móvil** (`md:hidden`)
- Panel deslizante desde la derecha: `translate-x-full → translate-x-0`
- Se abre con `window.dispatchEvent(new CustomEvent('avi:openReportes'))`
- Misma tipografía que EHR sidebar: headers `text-[15px] primary-600`, items `px-2 py-2 text-sm`
- Pre-carga el expediente al montar para que la impresión sea inmediata

### `src/app/therapist/reportes/ReportesPageClient.tsx`
- **Solo desktop** (`hidden md:block`)
- Sidebar izquierdo con los reportes agrupados en Esencial / AVI-Clínico
- Selector de empresa/logo en la parte superior
- Pasa `headerOpts = { terapeutaNombre, logoUrl, side }` a **todas** las funciones de impresión

---

## `print-utils.ts` — Funciones de impresión PDF

**Archivo:** `src/app/therapist/patients/[patientId]/print-utils.ts`

### Regla fundamental
**NUNCA** usar `window.open()` — bloqueado por pop-up blocker.  
Siempre usar `printHtmlViaIframe(html)`.

### `buildReportHeader(opts: ReportHeaderOptions)`
Encabezado compartido para los 10 reportes. Genera:
1. **Línea meta** (arriba): fecha a la izquierda + logo de empresa o nombre terapeuta a la derecha
2. **Bloque AVI brand**: cuadro morado "AVI" + "AVI Therapy Companion" + subtítulo del reporte, con línea azul `#2d3a8c` al pie y 12pt de padding-bottom + 10px spacer

```typescript
export interface ReportHeaderOptions {
  terapeutaNombre: string
  logoUrl?: string | null
  side?: 'logo' | 'name'   // 'logo' muestra imagen de empresa; 'name' muestra nombre terapeuta
  subtitle?: string         // nombre del reporte (aparece bajo "AVI Therapy Companion")
}
```

### CSS base compartido — patrón obligatorio para reportes nuevos
```css
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: letter; margin: 1cm 1.8cm 1.2cm; }
html, body { margin: 0 !important; padding: 0 !important; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a1a; line-height: 1.3; }
```
Los 6 reportes que usan `sharedCSS()` ya lo tienen. Los demás lo tienen inline.  
**El `html, body { margin: 0 !important }` es crítico** — sin él, el browser agrega 8px de margen en el iframe y puede forzar una segunda página en blanco.

### Funciones de impresión (10 reportes)

| Función | Subtítulo del reporte |
|---|---|
| `imprimirNotaInicialDesdeReportes(pid, headerOpts?)` | Registro de Entrevista Inicial |
| `imprimirSesionesDesdeReportes(pid, sesionId?, headerOpts?)` | Bitácora de Sesiones Presenciales |
| `imprimirAnalisisDesdeReportes(pid, analisisId, headerOpts?)` | Análisis Clínico y Propuesta Técnica |
| `imprimirDatosGeneralesDesdeReportes(pid, headerOpts?, preloaded?)` | Registro clínico — Datos generales |
| `imprimirHCOriginalDesdeReportes(pid, headerOpts?)` | Historia Clínica |
| `imprimirHCActualizadaDesdeReportes(pid, headerOpts?)` | Historia Clínica |
| `imprimirReporteValorativoDesdeReportes(pid, headerOpts?)` | Reporte Valorativo |
| `imprimirIntegracionPlanDesdeReportes(pid, headerOpts?)` | Integración y Plan de Intervención |
| `imprimirReporteProcesoDesdeReportes(pid, headerOpts?)` | Reporte de Proceso |
| `imprimirReporteAtencion(data)` — en `reporte-atencion-print.ts` | Reporte de la Atención |

> **Importante:** todas las funciones `...DesdeReportes` aceptan `headerOpts?: Partial<ReportHeaderOptions>`. Siempre pasar `headerOpts` desde `ReportesPageClient.tsx` y `ReportesPanel.tsx` para que el logo de empresa aparezca en el reporte.

---

## Base de datos Supabase — tablas principales

| Tabla | Descripción |
|---|---|
| `profiles` | Usuarios (role: therapist / patient / admin), therapy_profile, `is_active` (desactivar terapeuta: no inicia sesión). `bloqueo_manual` existe pero no se usa. El WhatsApp del terapeuta está en **auth `user_metadata.whatsapp_phone`**, no en profiles |
| `subscriptions` | Plan del terapeuta: status, plan, tier (esencial/clinico), patient_slots. Constraint `subscriptions_plan_check`: `paid, free, valora, unit, companion` — **ampliarlo si se agrega un tipo de plan nuevo** |
| `therapist_patients` | Relación terapeuta-paciente. `is_active` + `status`: `active` · `archived` (fusionado/transferido) · `inactive` (bloqueado por inactividad, cron) · `blocked` (bloqueado manualmente). CHECK ampliado en migración `20261009` |
| `case_notes` | Nota inicial + análisis IA por paciente |
| `therapist_session_notes` | Sesiones presenciales (objetivo, desarrollo, acuerdo, seguimiento) |
| `patient_expediente` | Expediente clínico completo (Individual, Familiar, Pareja, Análisis Clínicos, HC, info_*) |
| `patient_questionnaires` | Cuestionarios asignados (McMaster FAD) |
| `convenio_codes` | Códigos de descuento CONVENIO (`code`, `plan_id`, `used_by`, `expires_at`, `is_active`) |
| `convenio_empresas` | Empresas convenio (nombre, logo_url, `telefono`, is_active) |
| `therapist_empresa` | Relación terapeuta ↔ empresa |
| `therapist_slot_bundles` | Paquetes de slots (`source_type`: convenio/regular/free_approved · `empresa_id`: null=independientes · `patient_slots` · `status`) |
| `convenio_personas_institucionales` | Personas institucionales (rol especial en empresa) |
| `document_chunks` | Chunks RAG con embeddings pgvector (therapy_profile filter) |
| `audit_log` | Log NOM-024: accesos a datos clínicos |
| `auth_attempts` | Rate-limit de login (5 intentos → bloqueo 15 min) |
| `push_subscriptions` | Web Push subscriptions del terapeuta |
| `expediente_versions` | Versionado de cambios en expediente |

### Clientes Supabase
- `src/lib/supabase/server.ts` — Server Components y API Routes (usa cookies)
- `src/lib/supabase/client.ts` — Client Components
- `src/lib/supabase/admin.ts` — Service role (bypass RLS, solo en server)

---

## Convenciones de código

### Tailwind
- Color primario AVI: clases `primary-*` (azul/morado) — definido en `tailwind.config`
- Responsive: mobile-first. `md:` = 768px+
- Sidebar EHR nav items: `px-2 py-2 text-sm` · Activo: `bg-primary-50 text-primary-700 font-medium border-r-2 border-primary-500`
- Headers de sección sidebar: `text-[15px] font-semibold text-primary-600 uppercase tracking-widest`
- Paneles deslizantes móvil: `translate-x-full → translate-x-0` con `transition-transform duration-200`

### TypeScript
- `npx tsc --noEmit` debe dar **0 errores** antes de cada commit
- Tipos de base de datos en `src/types/database.ts`
- Server Components: `async function` sin `'use client'`
- Client Components: `'use client'` + hooks de React

### Colores AVI en reportes PDF
- `#2d3a8c` — azul principal (títulos, bordes de sección, línea del header)
- `#5060a4` — azul subtítulo
- `#c026d3` — morado AVI brand (cuadro AVI, texto "AVI Therapy Companion")
- `#b0bbd4` / `#dde3ee` / `#eef1f9` — bordes y fondos suaves

### Auth y seguridad
- Rate limit en login: tabla `auth_attempts` (5 intentos → bloqueo 15 min)
- Timeout inactividad terapeuta: 15 min → redirect `/auth/login` (`InactivityGuard`)
- Audit log NOM-024: `logApiAccess()` en todas las rutas que acceden datos clínicos
- RLS activo en todas las tablas clínicas; DELETE físico bloqueado por política

---

## Variables de entorno requeridas

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=          # sin prefijo NEXT_PUBLIC_ para server/admin
SUPABASE_ANON_KEY=     # sin prefijo NEXT_PUBLIC_ para server
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=        # embeddings text-embedding-3-small (RAG)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_SUBJECT=
VAPID_PRIVATE_KEY=
AWS_ACCESS_KEY_ID=     # Amazon Polly (TTS)
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
ADMIN_EMAIL=           # superadmin
CRON_SECRET=
NEXT_PUBLIC_APP_URL=
# STRIPE_PRICE_* (packs, unit, valora, patrocinio) — ver src/lib/stripe/plans.ts
# ELEVENLABS_API_KEY sobra: ElevenLabs ya no se usa
```

---

## Flujo de planes y tiers

```
free_approved  → tier: null    → AVI-Esencial únicamente
esencial       → tier: null    → AVI-Esencial únicamente
clinico        → tier: clinico → AVI-Esencial + AVI-Clínico
convenio       → tier: clinico → AVI-Esencial + AVI-Clínico (vía código empresa)
companion      → tier: clinico → AVI-Esencial + AVI-Clínico (sin Stripe, vía código + fecha expiración)
```

La columna `tier` en `subscriptions` controla el acceso a tabs clínicos en el perfil del paciente y a reportes AVI-Clínico.

### AVI Therapy Companion Plans (gratis, sin Stripe)

`COMPANION_PLANS` en `src/lib/stripe/plans.ts`: `companion_5` (5 pacientes) y `companion_10` (10 pacientes).

- Se activan en `POST /api/stripe/checkout` con `convenioCode` — el checkout detecta `planType='companion'`, salta Stripe, crea la suscripción directamente en Supabase y devuelve `{ url: dashboardUrl }`.
- **Opción B:** Si el terapeuta ya tiene un plan activo distinto de `companion` (ej. `valora`), el checkout **no sobreescribe** la suscripción — solo crea un bundle en `therapist_slot_bundles`. La suscripción CONVENIO queda intacta.
- El cron `GET /api/cron/desactivar-companion-expirados` (10:00 UTC diario) desactiva bundles expirados y cancela la suscripción **solo si** `plan='companion'`.

### Regla de slots: pacientes independientes vs. CONVENIO (Opción B)

| Tipo de paciente | `empresa_id` | Límite |
|---|---|---|
| CONVENIO (empresa paga por sesión) | `!= null` | **Ilimitados** |
| Independiente (sin empresa) | `null` | Limitados al `patient_slots` del bundle Companion |

En `therapist/codes/page.tsx`: si existe un bundle activo con `empresa_id=null`, el contador usa `indepCount` (pacientes independientes) vs `bundle.patient_slots`. Sin bundle: comportamiento original.

En `therapist/patients/[patientId]/page.tsx`: state `hasCompanionBundle` — si es `true`, el paciente independiente no queda bloqueado aunque la suscripción no sea `active`/`trialing`.

### Códigos CONVENIO — cuándo se marcan como usados

| Plan | Dónde se marca el código | Si algo falla |
|---|---|---|
| **CONVENIO con pago** (`planType='valora'`, cualquier empresa) | En el **webhook** `checkout.session.completed` (metadata `convenio_code_id`) | Si el terapeuta no paga, el código queda libre |
| **Companion** (sin Stripe) | En el checkout, solo si sigue libre (`.is('used_by', null)`) | `releaseCode()` lo libera si falla la suscripción o el bundle |

Reglas del webhook (`handleCheckoutCompleted`):
- `therapist_empresa` se crea **solo con pago confirmado** (upsert, `ignoreDuplicates`). **Nunca se borra** por pagos fallidos: una renovación fallida conserva la empresa. Solo la quita la Baja de Terapeutas manual (PI N1/N2)
- Si ya existen bundles con ese `stripe_sub_id` → se omite (Stripe puede reenviar el evento)
- Los errores al insertar bundles se lanzan → Stripe reintenta
- "valora" es el **nombre del tipo de plan** CONVENIO, no la empresa: todo funciona por `empresa_id` para cualquier empresa

---

## Acceso por paciente — regla "la empresa paga"

**Fuente única:** `src/lib/acceso-paciente.ts` → `getAccesoTerapeuta()` + `accesoDePaciente()`.

| Paciente | Nivel | ¿Se bloquea? |
|---|---|---|
| CONVENIO (`empresa_id != null`) | Clínico | Nunca; no cuenta contra el cupo |
| Independiente (`empresa_id = null`) | Del plan del terapeuta (bundle Companion → Clínico; si no, `subscriptions.tier`) | Solo los primeros N por fecha de registro tienen acceso (N = cupo). Sin plan → todos bloqueados |

- El registro de pacientes **nunca** se detiene por cupo; el límite se aplica después, en el acceso.
- `therapist/layout.tsx` deja entrar sin plan propio si el terapeuta tiene una empresa CONVENIO activa.

### Tres motivos de bloqueo de un paciente
| Motivo | Dónde | Datos |
|---|---|---|
| Inactividad | Cron `bloquear-inactivos` | `is_active=false`, `status='inactive'` (+ abandono en `patient_derivaciones_cierres`) |
| Manual (🚫 Bloquear en Mis pacientes) | `togglePaciente` | `is_active=false`, `status='blocked'`; Reactivar → `status='active'` |
| Sin convenio y sin cupo/plan | Calculado | **No se guarda**; lo calcula `acceso-paciente.ts` |

"Mis pacientes" muestra el motivo en la sección Bloqueados. La tabla Control de Planes solo cuenta el tercer tipo.

### Terapeuta desactivado (`profiles.is_active = false`)
- **Login web** (`api/auth/login`): 403 + `signOut`, con el mensaje "Tu cuenta de terapeuta está desactivada… WhatsApp 33 1883 0312".
- **Excepción:** si es Persona Institucional activa, sigue el flujo normal (MFA incluido) y entra **solo** a `/institucional`. `therapist/layout.tsx` lo redirige ahí y `institucional/layout.tsx` deshabilita las opciones de terapeuta.
- **Sesión ya abierta:** `therapist/layout.tsx` muestra `CuentaDesactivada.tsx`, o redirige a `/institucional` si es PI.
- **App móvil (`avi-tca`):** consulta `GET /api/auth/estado-cuenta` en `_layout.tsx` y aplica la misma regla.

### Personas Institucionales — niveles (`src/lib/niveles-institucionales.ts`)
| Nivel | Acceso |
|---|---|
| N3 | Panel Institucional |
| N2 | Panel + Reporte Institucional General + Baja de Terapeutas |
| N1 | N2 + Reporte por Terapeuta |

`opera_como_terapeuta` es independiente del nivel. Usar `permisosPI(niveles)` en el sidebar, las tarjetas y las páginas.

### Otras librerías compartidas (`src/lib/`)
| Archivo | Uso |
|---|---|
| `companion.ts` | `activarCompanion()` — fuente única (checkout + Admin › Terapeutas), Opción B |
| `registro-email.ts` | Verifica el correo antes de registrar (sin revelar el terapeuta de un paciente) |
| `empresas-terapeuta.ts` | Empresas CONVENIO activas de un terapeuta |
| `sesiones-por-institucion.ts` | `institucionRowsDesde()` — % por institución que suman 100% (mayor residuo) |
| `patient-contacto.ts` | Contacto del paciente para la bienvenida y el chat |

---

## Administración AVI — información vs. acción

- **Panel de Control (`/admin`) es solo informativo.** No lleva botones que cambien datos; solo enlaces. "Pendientes de aprobación" remite a Terapeutas.
- **Control de Planes y Contrataciones**, por terapeuta:
  - Pacientes en Convenio: acordeón en dos columnas (paciente | empresa), ordenado por empresa, con subtotal.
  - Plan contratado.
  - Pacientes sin Convenio registrados: con acceso + bloqueados por cupo del mes.
  - Pacientes Bloqueados: por cupo, registrados en el mes y aún sin acceso.
- **Terapeutas (`/admin/terapeutas`)** concentra las acciones:
  - "Pendientes" y "Sin acceso" se dividen en **Registro Temporal** (Código CONVENIO / Companion con vencimiento) y **Registro Permanente** (Aprobar `free_approved` — autorización exclusiva del Administrador AVI).
  - "Con acceso activo" muestra "Control de acceso con registro temporal / permanente".
- **Gratis permanente** = `status 'free_approved'`, `plan 'free'`, con el cupo y nivel elegidos. Solo se puede aprobar a quien está en Pendientes (sin fila en `subscriptions`) o en Sin acceso (`cancelled`/`past_due`).
  - Asignar Companion a un `free_approved` solo agrega un bundle: al vencer, el terapeuta vuelve a gratis permanente.
- **Revocar acceso** = `subscriptions.status='cancelled'`. **Desactivar** = `profiles.is_active=false`; requiere 0 pacientes activos e impide iniciar sesión.

---

## Contacto del paciente (bienvenida y chat AVI)

**Fuente única:** `src/lib/patient-contacto.ts` → `getPatientContacto(patientId)` (solo servidor, usa service role). Devuelve `destino` ya redactado:

| Paciente | `destino` |
|---|---|
| Con empresa CONVENIO | "tu terapeuta o a [empresa] al [convenio_empresas.telefono]" (sin "al ..." si no hay teléfono) |
| Sin empresa | "tu terapeuta al [WhatsApp del terapeuta]" (o solo "tu terapeuta") |

- **Bienvenida** (`patient/onboarding/page.tsx`): texto con `{{CONTACTO}}`, se completa vía `GET /api/patient/contacto`
- **Chat AVI** (`api/chat/route.ts`): agrega un bloque de system `## CONTACTO DEL PACIENTE`; el prompt base (`recuperate-system-prompt.ts`) solo dice que se invite a contactar a quien indica esa sección → el prompt base sigue cacheado
- **Nunca** escribir nombres ni teléfonos de una empresa fijos en el código: se capturan en Admin › Empresas en CONVENIO
- Cambios al prompt de AVI deben revisarse con el terapeuta supervisor

---

## RAG multi-perfil

Los chunks de documentación terapéutica están indexados con `therapy_profile`:
- `tcc` — Beck, TCC
- `familiar` — Sistémico-familiar
- `trec` — TREC / Ellis
- `personalismo` — Personalismo

El perfil del terapeuta (`profiles.therapy_profile`) filtra los chunks relevantes en cada análisis. Se configura en `/therapist/configuracion/terapia`.

---

## Panel de Reportes — flujo completo

El terapeuta accede a reportes desde dos superficies:

### Desktop — `ReportesPageClient.tsx`
1. Al montar: llama `/api/therapist/reportes-init` → obtiene `empresas` (con `logo_url`) y `pacientesActivos`
2. Auto-selecciona el primer logo disponible → construye `headerOpts = { terapeutaNombre, logoUrl, side: 'logo' }`
3. Al seleccionar paciente + reporte → llama la función `...DesdeReportes` correspondiente pasando `headerOpts`
4. La función `...DesdeReportes` carga datos de Supabase y llama la función base → `buildReportHeader()` → `printHtmlViaIframe()`

### Móvil — `ReportesPanel.tsx`
- Se abre con `CustomEvent('avi:openReportes')`
- Mismo flujo que desktop; mismo `headerOpts`

### Desde ImpresionesTab (perfil del paciente)
- `ImpresionesTab.tsx` construye su propio `headerOpts` cargando empresas vía `/api/therapist/reportes-init`
- Llama directamente `imprimirHistoriaClinicaV2(...)`, `imprimirReporteValorativo(...)`, etc. (funciones base, no los wrappers `...DesdeReportes`)

---

## Comandos útiles

```bash
# Verificar TypeScript antes de commit
npx tsc --noEmit

# Dev local
npm run dev

# Indexar documentos RAG
npx ts-node scripts/index-fuentes.ts

# Build para verificar errores de compilación
npm run build
```

---

## Git workflow

- Branch principal: `main` → auto-deploy a Vercel
- Convención de commits: `feat:`, `fix:`, `style:`, `chore:`, `refactor:`
- Siempre `tsc --noEmit` antes de push
- **Último commit V1.0:** `9ddb2e1`
- **Último commit Sprint 12 Companion:** `dd614c6`
- **Último commit fixes Stripe CONVENIO + contacto por empresa:** `9f5ee22` (06 oct 2026)
- **Último commit respaldado:** `89cfffc` (10 oct 2026) — Control de Planes, motivo de bloqueo, terapeuta desactivado, Admin › Terapeutas Temporal/Permanente
- Confirmar el deploy: `vercel ls` / `vercel inspect go.avi-app.com.mx` (CLI con sesión en la Mac)
- Migraciones nuevas: archivo en `supabase/migrations/AAAAMMDD_nombre.sql`; el SQL lo corre José Luis en Supabase SQL Editor **antes** de subir código que dependa de él
- Al cerrar cada sesión: actualizar `../AVI - Bitácora de Desarrollo.md` (y el índice de `../AVI - SQL Migración Supabase.md` si hubo migración) y este archivo

---

## Archivos de contexto en Obsidian Vault (carpeta padre)

| Archivo | Contenido |
|---|---|
| `AVI - Bitácora de Desarrollo.md` | Historial completo de sprints y decisiones técnicas |
| `AVI - Arquitectura General.md` | Diagrama y descripción de la arquitectura |
| `AVI - Plan Maestro Producto.md` | Roadmap V2.0+ (app nativa, NOM-024 Fase 3) |
| `AVI - SQL Migración Supabase.md` | SQL de todas las migraciones aplicadas |
| `AVI - Análisis de Costos.md` | Costos de APIs y proyecciones |
