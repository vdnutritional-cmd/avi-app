# AVI Therapy Companion App — Contexto para Claude Code

> **Versión:** 1.1 (cerrada el 16 oct 2026: terminología Paciente/Asesorado completa) · **Actualizado:** 26 octubre 2026  
> Este archivo es el punto de entrada para cualquier sesión de Claude Code en este proyecto.  
> Léelo completo antes de modificar cualquier archivo.

---

## ¿Qué es AVI?

**AVI Therapy Companion** es una plataforma SaaS clínica para terapeutas psicológicos en México.  
Tiene dos roles principales:

- **Terapeuta** — gestiona su consultorio, pacientes, expedientes clínicos y reportes
- **Paciente** — accede a AVI "Platícame..." (chat terapéutico IA, hablado o escrito), su Resumen y cuestionarios

Módulos transversales: **SaaS Controller** (superadmin), **Administración** de las empresas con convenio (Personas Institucionales) y **App móvil Expo** (AVI-TCA).

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 3 |
| Base de datos | Supabase (PostgreSQL + pgvector + RLS) |
| Auth | Supabase Auth (email/password + MFA TOTP) |
| IA — chat paciente | Anthropic `claude-haiku-4-5-20251001` (también patrones y Reporte de la Atención) |
| IA — análisis | `claude-sonnet-5` con RAG por Enfoque terapéutico, uno o dos (expediente, análisis clínicos; la HC no usa RAG); `claude-sonnet-4-6` en emociones/recursos de sesiones |
| IA — embeddings | OpenAI `text-embedding-3-small` (1536) |
| Voz | TTS **Amazon Polly** (Mia, es-MX) en `/api/voice/tts`; dictado con **Web Speech API** del navegador. ElevenLabs **no se usa** (`/api/voice/stt` es legado, sin llamadas). En sesión **escrita** no se usa voz |
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

├── patient/                        Panel del paciente ("Platícame..." · barra: Habla | Resumen | Salir)
│   ├── chat/page.tsx               Chat AVI: elección Hablada/Escrita, voz o chat escrito (ver "Chat AVI del paciente")
│   ├── reformulate/page.tsx        "Resumen" (patrones de cada sesión)
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
│   ├── dashboard/page.tsx          AVI - Panel de Control
│   ├── reporte-terapeuta/page.tsx
│   └── reporte-general/page.tsx

├── admin/                          Panel superadmin
│   ├── institucional/              AVI Administración: Panel + reportes como Superuser (N1) de las empresas elegidas (+ "Sin empresa")
│   ├── AdminSidebar.tsx            Sidebar admin (Volver a AVI + Cerrar sesión → `/`)
│   ├── page.tsx                    Panel de Control AVI — SOLO INFORMATIVO (stats, pendientes, Control de Planes, pago caído, cumplimiento)
│   ├── ControlPlanesTabla.tsx      Tabla "Control de Planes y Contrataciones" (acordeones <details>, fila Total)
│   ├── conversion-paciente/page.tsx Conversión de paciente a terapeuta (misma cuenta; archiva vínculos, no borra nada)
│   ├── terapeutas/page.tsx         ACCIONES: Aprobar gratis permanente, Companion, tier, revocar, desactivar/reactivar
│   ├── convenio/page.tsx           Códigos CONVENIO + logos de empresa
│   ├── convenio-empresas/page.tsx  Agregar/activar empresa + Personas Institucionales (de la empresa, o por correo aunque no esté asignada; terminología, teléfono y logo: Configuración Admin)
│   ├── reportes/page.tsx
│   └── auditoria/page.tsx

└── api/                            API Routes (todas server-side)
    ├── chat/route.ts               IA chat paciente (Claude + RAG)
    ├── analysis/route.ts           Análisis clínico IA (Claude + RAG)
    ├── analisis-clinicos/route.ts  Expediente: McMaster + diagnóstico
    ├── cron/
    │   ├── bloquear-inactivos/     Cron diario 09:00 UTC — bloqueo por inactividad (15/30/45 días según frecuencia_config) → status 'inactive'
    │   ├── cerrar-sesiones-avi/    Cron diario 08:00 UTC — cierra y analiza sesiones AVI que quedaron abiertas
    │   ├── desactivar-companion-expirados/  Cron diario 10:00 UTC — expira bundles companion
    │   └── ajustar-enfoques/       Cron diario 10:30 UTC — quita enfoques no permitidos (fin de gracia de 30 días)
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
    │   ├── paciente-empresa/
    │   └── terminologia-persona/   { persona, terapeuta }: palabras para el perfil de una persona
    ├── patient/
    │   ├── contacto/route.ts       Contacto del paciente para la bienvenida (empresa o terapeuta)
    │   ├── sesiones-avi/route.ts   Sesiones AVI disponibles + ultimoModo (hablada/escrita)
    │   └── sesion-abierta/route.ts Sesión AVI abierta (≤ 30 min) para retomarla con su conversación
    ├── institucional/
    │   ├── alta-baja/              POST/DELETE therapist_empresa: Alta/Baja de <Pros> (PI User/Superuser de esa empresa, o superadmin)
    │   └── empresa-config/         Configuración Admin: terminología, teléfono, logo (mismo permiso)
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

- **Domicilio en partes** (25 oct 2026): calle, números, colonia, municipio, C.P., estado y país (`domicilio_*` en `patient_expediente`, `src/lib/domicilio.ts`), igual en el registro por QR. `contacto_domicilio` guarda el domicilio completo en una línea (lo leen los PDF y los análisis); de los pacientes anteriores se muestra como aviso para pasarlo a las partes. Religión: misma lista en el QR y en Datos Generales; lo escrito mal antes se ve vacío y se corrige en sesión
- **Sesiones presenciales:** la lista en pantalla va de la más reciente a la primera; el PDF, de la primera a la última
- **Datos Generales** (`DatosGeneralesTab`) recibe `initialData` de `page.tsx` (se carga una vez): al guardar avisa con `onSaved` y solo manda los campos que cambiaron — si no, al volver a la pestaña se veían datos viejos y el siguiente guardado borraba lo anterior

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
1. **Línea meta** (arriba): fecha a la izquierda + logo de la empresa (la del paciente) o nombre terapeuta a la derecha
2. **Bloque AVI brand**: logo de AVI según `terminologia` (asesorado → `public/logo-avi-acompanamiento.png`; paciente → `public/logo-avi-companion.png`, 22 pt de alto) + subtítulo del reporte, con línea azul `#2d3a8c` al pie y 12pt de padding-bottom + 10px spacer

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
| `profiles` | Usuarios (role: therapist / patient / admin), therapy_profile, `terminologia` ("Cómo me nombran": paciente/asesorado para sus personas sin empresa), `is_active` (desactivar terapeuta: no inicia sesión), `unlimited_avi_sessions` (excepción del límite; solo la cuenta de prueba). `bloqueo_manual` existe pero no se usa. El WhatsApp del terapeuta está en **auth `user_metadata.whatsapp_phone`**, no en profiles |
| `subscriptions` | Plan del terapeuta: status, plan, tier (esencial/clinico), patient_slots. Constraint `subscriptions_plan_check`: `paid, free, valora, unit, companion` — **ampliarlo si se agrega un tipo de plan nuevo** |
| `therapist_patients` | Relación terapeuta-paciente. `is_active` + `status`: `active` · `archived` (fusionado/transferido) · `inactive` (bloqueado por inactividad, cron) · `blocked` (bloqueado manualmente). CHECK ampliado en migración `20261009` |
| `sessions` | Sesiones AVI del paciente: `status` active/completed, `modo` (`hablada`/`escrita`; NULL = antes del 12 oct), `rag_personalista` (3 pasajes reutilizados en toda la sesión) |
| `messages` / `patterns` | Mensajes de cada sesión AVI / resumen al cerrar (lo que el paciente ve en "Resumen") |
| `case_notes` | Nota inicial + análisis IA por paciente |
| `therapist_session_notes` | Sesiones presenciales (objetivo, desarrollo, acuerdo, seguimiento) |
| `patient_expediente` | Expediente clínico completo (Individual, Familiar, Pareja, Análisis Clínicos, HC, info_*) |
| `patient_questionnaires` | Cuestionarios asignados (McMaster FAD) |
| `convenio_codes` | Códigos de descuento CONVENIO (`code`, `plan_id`, `used_by`, `expires_at`, `is_active`) |
| `convenio_empresas` | Empresas convenio (nombre, logo_url, `telefono`, `terminologia` paciente/asesorado, is_active). Terminología, teléfono y logo los configura la empresa en Configuración Admin |
| `therapist_empresa` | Relación terapeuta ↔ empresa |
| `therapist_slot_bundles` | Paquetes de slots (`source_type`: convenio/regular/free_approved · `empresa_id`: null=independientes · `patient_slots` · `status`) |
| `convenio_personas_institucionales` | Personas institucionales (rol especial en empresa) |
| `document_chunks` | Chunks RAG con embeddings pgvector (therapy_profile filter) |
| `audit_log` | Log NOM-024: accesos a datos clínicos |
| `auth_attempts` | Rate-limit de login (5 intentos → bloqueo 15 min) |
| `push_subscriptions` | Web Push subscriptions del terapeuta |
| `expediente_versions` | Versionado de cambios en expediente |
| `ia_uso` | Tokens reales de cada llamada a la IA (tipo, modelo, terapeuta, paciente, entrada/salida/caché). Solo servidor. Migración `20261019`. Promedios: `AVI - Análisis de Costos.md` |

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
- Timeout inactividad: terapeuta 15 min, paciente 30 min (`InactivityGuard timeoutMs`) → redirect `/auth/login`. Hablar/escuchar a AVI o escribir cuenta como actividad (evento `avi:actividad`)
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
- `therapist_empresa` se crea **solo con pago confirmado** (upsert, `ignoreDuplicates`). **Nunca se borra** por pagos fallidos: una renovación fallida conserva la empresa. Solo la quita la baja manual en Alta/Baja de <Pros> (PI User/Superuser). El alta también la puede hacer la empresa ahí (por correo), sin el SaaS Controller
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
| N3 — **Community Manager** | Panel de Control |
| N2 — **User** | Panel + Reporte General + Configuración Admin + Alta/Baja de <Pros> |
| N1 — **Superuser** | User + Reporte por Terapeuta |

Se guardan como N1/N2/N3; en pantalla siempre se muestra el nombre (`NIVEL_NOMBRES` / `nombreNivel()`).

`opera_como_terapeuta` es independiente del nivel. Usar `permisosPI(niveles)` en el sidebar, las tarjetas y las páginas.

Una Persona Institucional siempre es una cuenta `role='therapist'` (Administración no admite otras). El SaaS Controller también la agrega por correo en Empresas en CONVENIO aunque no estuviera asignada (`POST /api/admin/personas-institucionales` con `email`): queda asignada a la empresa (`therapist_empresa`), como en Alta/Baja.

### Otras librerías compartidas (`src/lib/`)
| Archivo | Uso |
|---|---|
| `companion.ts` | `activarCompanion()` — fuente única (checkout + Admin › Terapeutas), Opción B |
| `registro-email.ts` | Verifica el correo antes de registrar (sin revelar el terapeuta de un paciente) |
| `empresas-terapeuta.ts` | Empresas CONVENIO activas de un terapeuta |
| `sesiones-por-institucion.ts` | `institucionRowsDesde()` — % por institución que suman 100% (mayor residuo) |
| `patient-contacto.ts` | Contacto del paciente para la bienvenida y el chat |
| `limite-sesiones-avi.ts` | `getEstadoSesionesAvi()` — sesiones AVI permitidas (política por frecuencia) |
| `cerrar-sesion-avi.ts` | `procesarCierreSesion()` (patrones + completed) y `cerrarSesionesAbiertas()` |
| `terminologia.ts` | Diccionario `<user>/<pro>/<serv>` (paciente/terapeuta/terapia · asesorado/asesor/asesoría), `terminos()`, `aplicarTerminologia()`, `nombreAvi()` (asesorado → "AVI Acompañamiento Virtual Interactivo"; paciente → "AVI Therapy Companion") |
| `terminologia-paciente.ts` | Política: qué palabra ve cada quien (persona, terapeuta, pantallas generales). Solo servidor |
| `modo-platica.ts` | Modo elegido (hablada/escrita) y borrador sin enviar, en localStorage; se olvidan al salir |
| `fusionar-cuentas.ts` | `fusionarCuentas()` — fusión temporal → real: nota, expediente y cierres campo por campo (gana la real), presenciales juntas renumeradas por fecha, análisis y cuestionarios; si falla no archiva |
| `domicilio.ts` | `ESTADOS_MEXICO`, `PAISES` (por ahora solo México), `CAMPOS_DOMICILIO`, `domicilioEnUnaLinea()` |
| `ia/registrar-uso.ts` | `registrarUso(tipo, modelo, usage, ids)` — **toda llamada nueva a la IA debe registrar su uso** en `ia_uso` (con `after()`, sin costo de tokens) |
| `rag/retrieve-chunks.ts` | `retrievePasajesPersonalismo()` — 3 pasajes de 5 libros personalistas para el chat AVI |

---

## Nombres visibles (13 oct 2026)

| Menú | Contenido |
|---|---|
| **SaaS Controller** (`/admin`, superadmin) | Panel de Control AVI · ⚙️ **Configuración AVI** (acordeón: Terapeutas — solo registro temporal/Companion y permanente; Códigos CONVENIO; Empresas en CONVENIO — agregar empresa y Personas Institucionales) · AVI Administración (`/admin/institucional`: Panel, reportes, Configuración Admin y Alta/Baja de las empresas elegidas) · Reportes de Control · Auditoría |
| **Administración** (`/institucional`, Personas Institucionales, solo sus empresas) | Panel de Control · Reporte General · Reporte por Terapeuta · Configuración Admin · Alta/Baja de <Pros> |

## Terminología Paciente / Asesorado (14 oct 2026)

Por cuestión legal (instituciones Sin Fines de Lucro no pueden usar "paciente"). Inventario de textos en `../AVI - Inventario Terminología.md`.
- **Empresa:** la define la Persona Institucional User/Superuser en **Administración › Configuración Admin** (`/institucional/configuracion`, también teléfono y logo). El superadmin, en AVI Administración › Configuración Admin. API `/api/institucional/empresa-config` (permiso por empresa, logo subido desde el servidor). Empresas en CONVENIO del SaaS Controller ya no lo hace.
- **Persona con empresa:** la de su empresa (bienvenida, chat, y lo que ve el terapeuta dentro de ella). **Sin empresa:** "Cómo me nombran" del terapeuta (`/therapist/configuracion/terminologia`).
- **Menú y pantallas generales del terapeuta:** una sola palabra; "asesorado" si alguna empresa suya (o su elección) lo es. Nunca "pacientes/asesorados".
- **Logo:** se imprime en 140 × 48 px; de preferencia horizontal. Configuración Admin recorta sola los márgenes al subirlo (en el navegador, PNG de máx. 1200 px) y tiene "✂︎ Quitar márgenes al logo actual"; avisa si es chico, vertical o muy alargado.
- Aplicado hasta la página 13 del inventario (Correos y push: correo de crisis con la palabra de la persona; AVI = Acompañamiento Virtual **Interactivo**; Administración: palabra de la empresa; varias → `terminologiaComun()`; Login, registro y páginas públicas: texto fijo "terapeuta o asesor"; QR y código con la palabra de la persona/terapeuta; `/api/auth/terminologia` para Planes y precios; Bienvenida, Habla, cuestionario, menú, Dashboard, Mis pacientes, Asignación a Institución, Perfil AVI-ESENCIAL y AVI-CLÍNICO, Reportes y PDF, Registro de pacientes, Información: Mis Asesorías, Mi estadística, Auditorías, Tutoriales, Configuración: Política de baja). "Activar plan" y Planes y precios van juntas en la página de páginas públicas, con texto fijo.
- PDF de estadística (`PrintEstadisticasButton`, prop `terminologia`): en Mi estadística la del menú; en Administración `getTerminologiaEmpresas()` (asesorado si alguna empresa elegida lo es). `useTerminologiaMenuValor()` da la terminología misma para `buildReportHeader`.
- **Pantallas cliente generales del terapeuta:** `useTerminologiaMenu()` (`src/app/therapist/TerminologiaMenu.tsx`); el `layout` reparte la palabra del menú con `TerminologiaMenuProvider`. Pantallas servidor: `getTerminologiaTerapeuta()`. En el perfil, la palabra de la persona llega de `page.tsx` a cada pestaña por la prop `terminologia` (también vía `ExpedienteTab`).
- Pantallas cliente: la palabra llega del servidor (`/api/patient/sesiones-avi`, `/api/therapist/terminologia-persona`); la pantalla espera la respuesta para no mostrar un instante la palabra equivocada.
- **PDF:** cada función de `print-utils.ts` obtiene la palabra de la persona con `terminologiaDelReporte(patientId, headerOpts)` (usa `headerOpts.terminologia` si viene; si no, `/api/therapist/terminologia-persona`). `buildReportHeader` acepta `terminologia` ("<Pro>:"). Reporte de la Atención: la API devuelve `terminologia`. La pantalla de Reportes usa la palabra del menú.
- `factores-nota-inicial.ts`: descripciones con `<user>`/`<serv>`; `resolveFactores(..., terminologia)` las aplica.

## SaaS Controller — información vs. acción

- **Panel de Control AVI (`/admin`) es solo informativo.** No lleva botones que cambien datos; solo enlaces. "Pendientes de aprobación" remite a Terapeutas.
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

Una sola tabla, `document_chunks` (pgvector, 1536). `scripts/index-fuentes.ts` indexa las carpetas `docs-*` y les asigna `therapy_profiles`:

| Carpeta | Perfiles |
|---|---|
| `docs-familiar-sistemico` | `famsis`, `famsis_trec`, `famsis_cc` |
| `docs-trec` | `trec`, `famsis_trec`, `trec_cc` |
| `docs-cognitivo-conductual` | `cc`, `famsis_cc`, `trec_cc` |
| `docs-analisis` | `analisis` |
| `docs-personalismo` | **todos** los perfiles (base común) |

- El enfoque del terapeuta (`profiles.therapy_profile`: `famsis`, `trec`, `cc` o combinaciones) filtra los chunks de los análisis. Se configura en `/therapist/configuracion/terapia`.
- **Hasta 2 enfoques** (18 oct 2026, `8db7a04`): `retrieveChunksByProfile()` hace una búsqueda por enfoque + una de la base común (16 → 6 + 6 + 4; con uno, 12 + 4). Los libros de cada enfoque están en `ENFOQUES` / `LIBROS_BASE` de `retrieve-chunks.ts`: **al indexar un libro nuevo, agregarlo ahí**. Los prompts usan `instruccionEnfoque()` / `nombreEnfoques()` (con dos, la IA debe integrarlos).
- **Análisis Caso — Plan de 10 a 12 sesiones (AVI-CLÍNICO, `api/analysis` + `consultame-prompt.ts`):** sin Prediagnóstico → la IA genera el plan; Prediagnóstico ≥ última presencial (`prediag-mayor`) → **el servidor pega el Plan del Expediente exacto** en la marca `[[PLAN_DEL_EXPEDIENTE]]` (`crearInsertorPlan()`; la IA no lo copia); presenciales después del Prediagnóstico (`prediag-menor`) → plan actualizado. El Recordatorio de técnicas lleva una entrada por cada técnica del Plan, en orden (18 oct 2026, `563f7f2`)
- **ConsultoriaFuentes ya no existe** (era el RAG original de julio): no volver a nombrarlo en prompts. Ciclo Vital, Procesos Familiares (Satir + Minuchin) y McMaster siguen por libro fijo (instrumentos de Familiar). La Historia Clínica no usa RAG.
- `match_document_chunks` acepta `filter_profile` y `filter_books` (ILIKE por libro).
- **Chat AVI del paciente:** no usa el perfil del terapeuta, sino `retrievePasajesPersonalismo()`: 3 pasajes de Wojtyla, Burgos, Buber, Teología del Cuerpo y El amor humano (sin Supervisión de Casos), sin nombres de autores.

### Enfoques permitidos por empresa (27 oct 2026)
- `convenio_empresas.enfoques_permitidos` (migración `20261027`): la Persona Institucional User/Superuser (o el superadmin) los marca en **Configuración Admin**.
- Regla única en `src/lib/enfoques-permitidos.ts` → `getEnfoquesPermitidos()`:
  - **Plan pagado personal activo** (suscripción `paid`/`unit`/`valora`/`companion`, o bundle activo `regular`/`convenio`) → todos.
  - **Gratis permanente (`free_approved`) con empresas activas** → la unión de lo que autorizan.
  - **Plan pagado vencido hace menos de 30 días** (`DIAS_GRACIA`) → todos (periodo de gracia por si vuelve a pagar). `profiles.plan_pagado_visto_at` = última vez visto con plan pagado activo (lo renueva el servidor).
  - **Sin plan pagado y sin empresas activas** → todos. Siempre elige máximo 2.
- El terapeuta guarda por `POST /api/therapist/enfoque` (valida en el servidor). **Trigger `profiles_proteger_enfoque`** (migración `20261027b`): `therapy_profile` y `plan_pagado_visto_at` solo los cambia el service role; desde el navegador se rechazan. Todo cambio de enfoque va por el cliente admin.
- Cron diario `ajustar-enfoques` (10:30 UTC): quita los enfoques que ya no están permitidos (p. ej. al terminar la gracia).
- Al quitar un enfoque una empresa, en un alta/baja o al activar/desactivar una empresa, `ajustarEnfoquesDeTerapeutas()` le quita al terapeuta lo que ya no tenga permitido. Sin ninguno, el Dashboard le pide elegir de nuevo.
- Catálogo único de enfoques (nombres, descripciones, combinaciones): `src/lib/enfoques.ts`.

### Procedimiento: agregar libros (RAG) o un enfoque terapéutico nuevo (27 oct 2026)
Datos clave:
- `scripts/index-fuentes.ts` **borra todo `document_chunks` y reindexa todos los libros** en la base real. Costo de centavos; por unos minutos los análisis quedan sin pasajes, así que se corre en horario tranquilo.
- Los análisis buscan **por nombre de libro**: `doc_name` = nombre del archivo `.md` con `_` → espacios. Un libro indexado que no está en `ENFOQUES` / `LIBROS_BASE` de `retrieve-chunks.ts` **nunca se usa**.
- Las etiquetas `therapy_profiles` de los chunks ya no se usan para buscar (son del Sprint 24). El script las sigue escribiendo y necesita la carpeta en `DIR_PROFILE_MAP` para leerla.

**A) Libro nuevo en un enfoque existente o en la base común**
1. José Luis entrega el `.md` revisado. Se limpia como Beck: sin portada ni índice, y sin contenido incompatible con el personalismo.
2. Se pone en su carpeta `docs-*`.
3. Se agrega a la lista de su enfoque (`ENFOQUES`) o a la base común (`LIBROS_BASE`). Si es personalista y debe usarlo el chat del paciente, va además en `LIBROS_PERSONALISMO`.
4. Se corre `npx tsx scripts/index-fuentes.ts`.
5. Se verifica que el libro tenga chunks y que un análisis de prueba lo cite.
6. Se actualizan la Bitácora y la tabla de carpetas de arriba.

**B) Enfoque terapéutico nuevo**

José Luis entrega, revisado con el supervisor:
- Los libros.
- El nombre largo, el nombre corto y la descripción que ve el terapeuta.
- El marco teórico para el prompt: autores, conceptos y técnicas.
- Los Factores de riesgo y protección de la Nota Inicial: Individual, Familiar y Pareja × riesgo y protección = 6 listas, con título y descripción.

Cambios:
1. **Catálogo** `src/lib/enfoques.ts`: clave **sin "_"** (los perfiles combinados se unen con "_", ordenados) y textos. Con esto aparece solo en Configuración Admin y en Configuración › Enfoque terapéutico.
2. **SQL:** ampliar `convenio_empresas_enfoques_check` con la clave nueva. Decidir si las empresas lo reciben marcado o desmarcado; el default actual son los 3 originales.
3. **RAG:**
   - Carpeta `docs-<nuevo>`.
   - Agregarla a `DIR_PROFILE_MAP` de `index-fuentes.ts`.
   - Agregar el enfoque con su `nombre` y `libros` en `ENFOQUES` de `retrieve-chunks.ts`.
   - Reindexar.
4. **Prompts:** `MARCO_POR_ENFOQUE` en `src/lib/prompts/consultame-prompt.ts`. `instruccionEnfoque()` / `nombreEnfoques()` se adaptan solos.
5. **Nota Inicial:**
   - Las 6 listas, `SCHEMA_LABELS` y las columnas en `factores-nota-inicial.ts`.
   - Columnas `factores_riesgo_<x>` / `factores_proteccion_<x>` en `therapist_patients` (SQL).
   - El bloque del enfoque en `patients/[patientId]/page.tsx` (hoy hecho a mano, como `tfsActive`/`trecActive`/`tccActive`), con su guardado y carga.
   - La vista en `IndividualTab` / `FamiliarTab` / `ParejaTab`.
   - Los ciclos `['famsis','trec','cc']` de `print-utils.ts` y `api/therapist/reporte-atencion`.
   - **Recomendado antes del primer enfoque nuevo:** armar los bloques de la Nota Inicial desde el catálogo y guardar los factores en una sola columna `jsonb` por enfoque. Así cada enfoque nuevo solo pide su contenido y el SQL del paso 2.
6. **Documentos:** este archivo (tabla de carpetas), Bitácora, `AVI - SQL Migración Supabase.md`, `AVI - Arquitectura General.md` y el Inventario de Terminología (14.8, nombres de enfoques).

No cambian:
- Los análisis que usan el enfoque toman `profiles.therapy_profile` solos: Análisis de Caso, Prediagnóstico, Plan, Emociones y Recursos, Análisis Clínicos e Historia Clínica.
- El costo por análisis tampoco cambia: siempre 16 pasajes.
- El default `'famsis'` de las rutas sin enfoque configurado se queda.

**Orden:**
1. Contenido revisado.
2. Cambios en local.
3. SQL en Supabase (lo corre José Luis).
4. Reindexar.
5. Revisión en http://localhost:3000.
6. Commit y push con autorización.

---

## Chat AVI del paciente (`patient/chat/page.tsx` + `api/chat/route.ts`)

- **Elección al iniciar:** "¿Cómo quieres platicar hoy?" → Hablada / Escrita.
  - Queda marcada la última elección.
  - No cambia a mitad de la sesión; se guarda en `sessions.modo`.
  - Se recuerda al ir a Resumen y regresar; se vuelve a preguntar después de salir.
- **Tiempos (acordados con el supervisor):**

| Momento | Tiempo |
|---|---|
| App del paciente abierta | 30 min |
| Voz: AVI escuchando y el paciente callado | 10 min (aviso al 9; se envía lo grabado) |
| Voz: esperando a que toque el micrófono | 5 min (aviso al 4) |
| Escrita: sin escribir | 10 min (aviso al 9; cada tecla reinicia) |

- **Cierre en orden:**
  - Hay un solo canal de voz (`speak` en cadena).
  - "Terminar" nunca corta: "Cerrando al terminar…" y "No, quiero seguir" (`[CONTINUAR_SESION]`).
  - **Cerrar sesión / Salir** (`LogoutButton`, evento `avi:salir`) cierran primero la plática con su resumen y luego salen. "Terminar" deja al paciente dentro.
- **Retomar:** al regresar a Habla con una sesión abierta (≤ 30 min) se retoma la misma sesión, con su conversación y el borrador sin enviar.
- **Las sesiones abiertas se cierran** al iniciar la siguiente (`after()`) o en el cron diario. Ya no se cierran al bloquear la pantalla; solo el `pagehide` real manda un beacon.
- **Bloque fijo del prompt** (en caché de 1 h; Haiku solo cachea ≥ 4,096 tokens):
  - `RECUPERATE_SYSTEM_PROMPT`.
  - Contexto del paciente: Nota Inicial, 2 últimas presenciales y prediagnóstico **sin diagnóstico** (cliente admin).
  - Sesiones AVI anteriores: 2 resúmenes + 6 últimos mensajes.
  - Contacto.
  - Honestidad (voz o escrita).
  - Pasajes personalistas.
  - El historial (30 mensajes) va en caché de 5 min.
- **Costo medido:** ~$0.041–0.045 por sesión, igual hablada o escrita (ver `AVI - Análisis de Costos.md`).
- **Límite de sesiones:** `limite-sesiones-avi.ts`.
  - Semanal 3, cada 2 semanas 6, mensual 12, sin definir 5, entre sesiones presenciales; no se acumulan.
  - Paciente bloqueado o sin cupo → sin AVI.
- **Cualquier cambio al prompt de AVI** se revisa con el terapeuta supervisor.
- **App móvil — decisión 12 oct 2026 (ver `../AVI - Plan Maestro Producto.md` §2.7):**
  - **Una sola AVI, la PWA.** Toda mejora de paciente y terapeuta se hace en la PWA.
  - La app de tiendas (`avi-tca`, Expo) es **la misma app, idéntica, en Android y iPhone** (un solo código, mismas funciones; Android se publica primero). Solo es la puerta: registro, login, Face ID y push nativos, y después un WebView con la PWA.
  - **No duplicar funciones en la app.** El chat de paciente nativo (`avi-tca/app/(patient)/chat.tsx`) está roto con esta API y **se eliminará**.
  - **Sin precios ni pagos en la app** (ni Android ni iPhone): el terapeuta contrata siempre en la web (regla 3.1.1 de Apple).

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
npx tsx scripts/index-fuentes.ts   # borra y reindexa todo (ver procedimiento en RAG multi-perfil)

# Build para verificar errores de compilación
npm run build
```

---

## Git workflow

- **Antes de guardar y subir, José Luis revisa en http://localhost:3000** (`npm run dev`). Aplicar en local, decir qué revisar y **no hacer commit ni push hasta que lo autorice** — también fixes pequeños y este archivo (regla del 17 oct 2026)
- Branch principal: `main` → auto-deploy a Vercel
- Convención de commits: `feat:`, `fix:`, `style:`, `chore:`, `refactor:`
- Siempre `tsc --noEmit` antes de push
- **Último commit V1.0:** `9ddb2e1`
- **Después de V1.1:** `2b4070a` (26 oct 2026) — nombre de la app "AVI" y `nombreAvi()` por terminología; antes `14310cd` (26 oct 2026) — logos de AVI en reportes por terminología y logo de la empresa del paciente; `8258976` nuevo logo en la página de inicio; antes `427269f` (26 oct 2026) — Fusionar cuentas conserva toda la información, listas de pacientes activos; antes `99e2fa7` (25 oct 2026) — domicilio en partes (migración `20261025`); antes `e7f2719` Sesiones presenciales de la más reciente a la primera, `e006597` Religión en lista en el QR, `59d6576` título "AVI Therapy Companion"; antes `2199565` (19 oct 2026) — medición real de tokens (`ia_uso`) y Sintomatología a 3,000; antes `5ecbb89` (18 oct 2026) — Datos Generales guarda solo los campos cambiados; antes `563f7f2` — Plan del Expediente pegado por el servidor y Recordatorio = técnicas del Plan; antes `8db7a04` — análisis con el enfoque terapéutico (uno o dos), sin ConsultoriaFuentes; antes `06b377f` — recorte automático de márgenes del logo de empresa; antes `b11d44d` logo oficial en la página de inicio, `0e8ad84` protección de "No aprobar" y auditoría de accesos API, `5a54e0d` (17 oct) — Conversión de paciente a terapeuta y "Terapeutas registrados"; antes `9614fba` selector "Empresas a mostrar", `75dfc0b` Persona Institucional por correo asignada a la empresa, `84c3b0d` Persona Institucional por correo
- **Versión 1.1 cerrada el 16 oct 2026:** terminología Paciente/Asesorado en toda la app (inventario páginas 1–13; SaaS Controller sin cambio por decisión de José Luis). Último commit de código V1.1: `4333ad0`. Pendientes para V1.2 en `../AVI - Bitácora de Desarrollo.md`
- **Último commit Sprint 12 Companion:** `dd614c6`
- **Último commit fixes Stripe CONVENIO + contacto por empresa:** `9f5ee22` (06 oct 2026)
- **Respaldo del 10 oct:** `89cfffc` — Control de Planes, motivo de bloqueo, terapeuta desactivado, Admin › Terapeutas Temporal/Permanente
- **Último commit respaldado:** `2b4070a` (26 oct 2026) — nombre AVI por terminología; antes `14310cd` (26 oct 2026) — logos; antes `427269f` (26 oct 2026) — Fusionar cuentas; antes `99e2fa7` (25 oct 2026) — domicilio en partes, Religión en lista y título del QR; antes `2199565` (19 oct 2026) — medición real de costos de IA (`ia_uso`); antes `866b13c` (18 oct 2026) — respaldo de la sesión del 18 oct en la Bitácora (logo con recorte, RAG por enfoque, Plan de 10 a 12 sesiones, Datos Generales); antes `4333ad0` (16 oct 2026) — páginas sin sesión redirigen al login (no usar `user!.id` en páginas: el layout se renderiza en paralelo); antes `10a34eb` inventario página 13 (correos y push), antes `57233fa` "Interactivo"; antes `da2e34e` página 12 (Administración); antes `5e85f0f` página 11 (login, registro y páginas públicas); antes `56cd09b` página 10 (Política de baja); antes `bd5ff80` página 9 (Información), Reporte por período con encabezado común e iframe, subtítulos quitados en HC/Valorativo/Integración/Proceso; antes `d9d1879` página 8 (Registro de pacientes), `848c5be` logo en reportes AVI-CLÍNICO del teléfono, `3593675` página 7 (Reportes y PDF), `1526016` página 6 (Perfil AVI-CLÍNICO), `3810766` página 5, chat sin instante "terapeuta", menú lateral de 288 px; `43a59c2` inventario página 4, `3d2494d` Paquetes en CONVENIO con una sola empresa (WhatsApp de solicitudes, migración `20261014c`), `ac31736` Alta/Baja de <Pros> por la empresa y `bb25486` terminología (Configuración Admin, Cómo me nombran, inventario 1–3)
- **Respaldo del 13 oct:** `15ebffb` — nombres: SaaS Controller, Configuración AVI, Administración, niveles
- **Respaldo anterior:** `69954cd` (12 oct 2026) — chat AVI (tiempos, caché real 1h+5m, base personalista, política de sesiones, modo escrito, retomar sesión, sesiones anteriores), Administración Institucional AVI, transferir paciente seguro
- Confirmar el deploy: `vercel ls` / `vercel inspect go.avi-app.com.mx` (CLI con sesión en la Mac)
- `npx next build` modifica `tsconfig.json` solo (jsx, `.next/dev/types`): regresarlo con `git checkout tsconfig.json` antes de hacer commit
- `globals.css`: los colores por defecto usan `hsl(var(--foreground/--background))` — con `rgb()` el texto salía rojo
- Migraciones nuevas: archivo en `supabase/migrations/AAAAMMDD_nombre.sql`; el SQL lo corre José Luis en Supabase SQL Editor **antes** de subir código que dependa de él
- En localhost, `RESEND_API_KEY` de `.env.local` es un texto de ejemplo (`re_...`): los correos (recuperar contraseña, etc.) **no salen** y la pantalla igual dice "Revisa tu correo". Pedirlos desde producción
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
