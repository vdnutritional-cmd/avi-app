// ─────────────────────────────────────────────────────────────
// Consentimiento Informado v2 y "Tu privacidad importa" (8 nov 2026, migración 20261108).
// Redacción aprobada por José Luis (borrador en ../AVI - Consentimiento Informado (borrador v2).md).
// Fuente única del texto: lo muestran el registro por QR, el onboarding, /patient/consentimiento y
// /patient/privacidad, y el servidor lo arma igual para guardarlo con su huella (consentimiento-servidor.ts).
//
// Formato de los textos (lo dibuja src/components/TextoLegal.tsx y el PDF):
//   "## Título" = apartado · "- " = viñeta · "  - " = sub-viñeta · línea vacía = párrafo · **negrita**
//   <user>/<pro>/<serv>: terminología de la persona (aplicarTerminologia).
// Cambiar una palabra del texto = versión nueva: subir CONSENTIMIENTO_VERSION (todas las personas
// vuelven a firmar al entrar a AVI).
// ─────────────────────────────────────────────────────────────
import { aplicarTerminologia, type Terminologia } from './terminologia'

export const CONSENTIMIENTO_VERSION = 2

export type OpcionEscucha = 1 | 2 | 3
export const OPCIONES: readonly OpcionEscucha[] = [1, 2, 3]

export function esOpcionEscucha(v: unknown): v is OpcionEscucha {
  return v === 1 || v === 2 || v === 3
}

/** Opciones 2 y 3: el <pro> puede usar la Escucha de AVI */
export const escuchaPermitida = (opcion: OpcionEscucha | null | undefined) => opcion === 2 || opcion === 3

export type OrigenFirma = 'registro_qr' | 'primera_entrada' | 'reconsentimiento' | 'arco'

export const NOMBRE_ORIGEN: Record<OrigenFirma, string> = {
  registro_qr:      'Registro por QR',
  primera_entrada:  'Primera entrada a AVI',
  reconsentimiento: 'Nueva versión del Consentimiento',
  arco:             'Cambio por Derechos ARCO',
}

// ── Tu privacidad importa (le habla a la persona) ──
const PRIVACIDAD_INTRO = `**Te informamos que en tus pláticas virtuales con AVI** (hablando o escribiendo), tu <pro> no escucha ni lee la conversación. Solo ve un resumen de los temas que platicaste y de las emociones que surgieron.

Por otro lado, **en las sesiones presenciales o virtuales que tengas con tu <pro>**, tú decides cómo se registrará lo que platiquen. Elige una opción:`

const OPCION_TITULO: Record<OpcionEscucha, string> = {
  1: '1. Solo notas del <pro>.',
  2: '2. Escucha de AVI.',
  3: '3. Escucha de AVI y notas del <pro>.',
}

const OPCION_TEXTO: Record<OpcionEscucha, string> = {
  1: 'Tu <pro> toma notas por escrito de lo que platiquen. AVI no escucha las sesiones.',
  2: 'AVI (IA), junto con tu <pro>, escucha cada plática, donde AVI, sin opinar ni agregar nada, redacta un resumen de la conversación, permitiendo que el <pro> se enfoque plenamente en atenderte. Dicha conversación no se guarda en ningún lado, solo estará en una memoria temporal mientras se hace el resumen de la plática y, al concluir el resumen, se borra toda la conversación de la memoria temporal. Únicamente queda el resumen en las notas personales de tu <pro>, mismas que él o ella puede revisar y modificar de acuerdo con su criterio profesional. Tu <pro> eventualmente también puede tomar notas si así lo considera.',
  3: 'Una combinación de las 2 opciones anteriores: AVI hace el resumen y tu <pro> toma sus notas durante la sesión, generando con ello un proceso más eficiente y dinámico del registro de la situación y los síntomas vividos por ti, así como de las soluciones propuestas por tu <pro>.',
}

const PRIVACIDAD_ARCO = `**Tus Derechos ARCO.** Tienes derecho a **A**cceder a tus datos, **R**ectificarlos, **C**ancelarlos y **O**ponerte a su uso. Puedes cambiar la opción que elegiste en el momento que desees; únicamente requieres notificarle formalmente a tu <pro>, a efecto de que te habilite el cambio en tu app de AVI. Cada cambio queda registrado con su fecha.`

export interface TextosPrivacidad {
  intro: string
  opciones: { valor: OpcionEscucha; titulo: string; texto: string }[]
  arco: string
}

export function textosPrivacidad(t: Terminologia): TextosPrivacidad {
  const a = (s: string) => aplicarTerminologia(s, t)
  return {
    intro: a(PRIVACIDAD_INTRO),
    opciones: OPCIONES.map(o => ({ valor: o, titulo: a(OPCION_TITULO[o]), texto: a(OPCION_TEXTO[o]) })),
    arco: a(PRIVACIDAD_ARCO),
  }
}

/** Nombre corto de la opción (pantallas del <pro> y de la persona) */
export function nombreOpcion(opcion: OpcionEscucha, t: Terminologia): string {
  return aplicarTerminologia(OPCION_TITULO[opcion], t).replace(/\.$/, '')
}

// ── Consentimiento Informado (en primera persona) ──
const OPCION_CONSENTIMIENTO: Record<OpcionEscucha, string> = {
  1: '1. Solo notas de mi <pro>',
  2: '2. Escucha de AVI',
  3: '3. Escucha de AVI y notas de mi <pro>',
}

const CONSENTIMIENTO_I_II = `## I. Mi <serv> y el uso de AVI

Por este medio manifiesto que otorgo libre y voluntariamente mi consentimiento para recibir <serv> de mi <pro>, de forma presencial o virtual. Incluye entrevistas (la entrevista inicial y las sesiones de seguimiento), así como la aplicación de cuestionarios y pruebas que me proponga mi <pro> realizar con el fin de verificar o evaluar o diagnosticar mi situación personal; y hago constar que estoy de acuerdo y dispuesto(a) a colaborar para que me realicen las entrevistas y pruebas necesarias. Comprendo que el fin de estas entrevistas y pruebas es única y exclusivamente para mi beneficio personal, por lo que he recibido información completa sobre las evaluaciones que se realizarán y he podido hacer todas las preguntas o dudas de mi interés, mismas que se han respondido satisfactoriamente.

Sé que este servicio se apoya en **AVI (Acompañamiento Virtual Interactivo)**, una plataforma tecnológica que usa en algunos puntos inteligencia artificial y que mi <pro> utiliza para:
- llevar mi expediente;
- preparar reportes;
- acompañarme virtualmente entre sesiones, a través de mis pláticas virtuales con AVI.

Comprendo que puedo terminar la <serv> en cualquier momento.

## II. Pláticas virtuales con AVI

AVI **no es** un <pro>: no hace diagnósticos ni reemplaza a mi <pro>, y no es un servicio de emergencias. Si estoy en crisis o en peligro, llamaré a la **Línea de la Vida, 800 911 2000** (gratuita, 24 horas).

Al terminar cada plática virtual con AVI, AVI guarda un resumen de los temas y las emociones que surgieron. Mi <pro> solo puede ver el resumen para acompañarme mejor. Mi <pro> no escucha ni lee la conversación.

## III. Registro de mis sesiones con mi <pro> (Escucha de AVI)`

const CONSENTIMIENTO_ESCUCHA = `Sobre la Escucha de AVI, sé que:
- **Funcionamiento:**
  - Temporalmente se graba el audio de la sesión, hasta los primeros 50 minutos, en el dispositivo de mi <pro>.
  - El audio se convierte en texto y AVI hace un resumen de la conversación.
  - Al concluir el resumen, el audio se borra de la memoria temporal del dispositivo de mi <pro> y no se puede recuperar.
  - El proceso anterior también aplica en las sesiones que realice con mi <pro> de forma virtual, cuando así se requiera.
- **Qué permanece:** el audio y el texto completo no se guardan; se borran al terminar el resumen. Solo queda el resumen en las notas personales de mi <pro>, quien las revisa y las puede corregir. El resumen puede incluir los nombres propios que se mencionen en la sesión, para que se entienda la situación que se describe.
- **Quién lo procesa:** lo procesan dos servicios externos que la plataforma AVI contrata:
  - **Groq**, en Estados Unidos, que convierte la voz en texto;
  - **Anthropic**, en Estados Unidos, que redacta el resumen.
  - Ninguno de los dos usa mi información para entrenar sus sistemas.
- **Durante cada sesión:**
  - Mi <pro> me avisará al iniciar cada escucha.
  - Puedo pedirle en ese momento que no la use, o que la detenga, sin dar explicaciones.
- **Otras personas en la sesión:** si participan otras personas (pareja, familia), mi <pro> les pedirá su acuerdo antes de iniciar la escucha.`

const CONSENTIMIENTO_IV = `## IV. Mi expediente y la confidencialidad

Mi <pro> integra mi expediente con:
- mis datos generales;
- la entrevista inicial;
- las notas de las sesiones;
- los cuestionarios;
- los análisis y reportes que prepara con apoyo de AVI.

La información es **confidencial**. Mi <pro> solo podrá compartirla sin mi autorización en estos casos:
- cuando exista riesgo para mi vida o la de otras personas;
- cuando haya indicios de abuso o violencia contra un menor o una persona vulnerable;
- cuando una autoridad competente lo ordene conforme a la ley.

Si mi <pro> me propone derivar mi atención a otro profesional de la salud, compartirá mi expediente con él o ella solo si yo lo acepto.`

const CONSENTIMIENTO_EMPRESA = `Mi <serv> se da en convenio con **{{EMPRESA}}**. La empresa recibe información administrativa y estadística, tal como número de sesiones, asistencia y calificaciones de satisfacción, entre otras. **No recibe** el contenido de mis sesiones presenciales o virtuales con mi <pro>, de mis pláticas virtuales con AVI, ni de mi expediente.`

const CONSENTIMIENTO_V_VIII = `## V. Tratamiento de mis datos personales

Otorgo mi consentimiento expreso para el tratamiento de mis datos personales, incluidos los **datos sensibles de salud**. Su único fin es darme la <serv> y el acompañamiento descritos aquí.

Sé que mis datos se guardan en servidores en la nube. Algunos servicios externos que la plataforma AVI contrata los procesan solo para funcionar:
- inteligencia artificial: Anthropic y OpenAI;
- voz a texto: Groq;
- voz de AVI: Amazon;
- dictado de voz en las pláticas habladas con AVI: el servicio de voz del navegador de mi teléfono (Google o Apple);
- correo: Resend;
- base de datos y hospedaje: Supabase y Vercel.

AVI **no vende** mis datos ni los usa para otros fines.

Mi expediente, que posee mi <pro>, se conserva el tiempo que marca la normatividad de salud (al menos 5 años desde la última atención).

## VI. Mis Derechos ARCO y la revocación

Puedo en cualquier momento:
- **acceder** a mis datos, **rectificarlos**, **cancelarlos** u **oponerme** a su uso;
- **cambiar mi opción** de registro de sesiones;
- **revocar** este consentimiento.

Para hacerlo:
- Basta con una solicitud a mi <pro>, por escrito o en persona en su consultorio u oficina.
- Mi <pro> me habilitará el cambio en mi app de AVI, donde lo autorizaré de nuevo.
- Cada cambio queda registrado con su fecha.

La revocación no afecta lo que se hizo antes con mi autorización (por ejemplo, los resúmenes ya hechos). Tampoco borra lo que la ley obliga a conservar en el expediente.

## VII. Menores de edad

Si la <serv> es para una persona menor de edad, este consentimiento lo otorga su madre, padre o tutor.

## VIII. Constancia

Mi aceptación se guarda de forma electrónica con la fecha, la hora, la versión de este documento, la opción que elegí, la dirección IP y el tipo de dispositivo, y no se puede modificar. Puedo consultarla en mi app de AVI.`

/** Texto de la casilla con la que se firma */
export const TEXTO_CASILLA = `Manifiesto que he leído el presente acuerdo y otorgo mi aceptación al Consentimiento Informado en los términos aquí expuestos. Mi aceptación queda registrada y conservada electrónicamente, incluyendo fecha, hora, opción de aceptación seleccionada, dirección IP y tipo de dispositivo utilizado, garantizando la integridad del registro.

Lo firmo electrónicamente mediante mi registro y manifestación expresa de aceptación en la plataforma AVI, de conformidad con la legislación aplicable en materia de consentimiento y firma electrónica, incluyendo, en México, los artículos 89, 89 Bis, 90 y 93 del Código de Comercio y 1803 y 1834 Bis del Código Civil Federal, en lo que resulte aplicable.`

export const tituloConsentimiento = (t: Terminologia) =>
  aplicarTerminologia(`Acuerdo de Consentimiento Informado para mi <serv> (versión ${CONSENTIMIENTO_VERSION})`, t)

export interface DatosConsentimiento {
  terminologia: Terminologia
  opcion: OpcionEscucha
  /** Empresa en convenio de la persona (null = sin empresa) */
  empresa: string | null
}

/** Cuerpo del Consentimiento con la opción y la empresa de la persona (formato de TextoLegal) */
export function textoConsentimiento({ terminologia, opcion, empresa }: DatosConsentimiento): string {
  const partes = [
    CONSENTIMIENTO_I_II,
    `Elegí la opción: **${OPCION_CONSENTIMIENTO[opcion]}**.`,
    ...(escuchaPermitida(opcion) ? [CONSENTIMIENTO_ESCUCHA] : []),
    CONSENTIMIENTO_IV,
    ...(empresa ? [CONSENTIMIENTO_EMPRESA.replace('{{EMPRESA}}', empresa)] : []),
    CONSENTIMIENTO_V_VIII,
  ]
  return aplicarTerminologia(partes.join('\n\n'), terminologia)
}

/**
 * Todo lo que la persona vio y firmó, tal como se guarda (texto_firmado) y se imprime:
 * Tu privacidad importa con la opción elegida + el Consentimiento + la casilla marcada.
 */
export function textoFirmado(d: DatosConsentimiento): string {
  const p = textosPrivacidad(d.terminologia)
  const elegida = p.opciones.find(o => o.valor === d.opcion)!
  return [
    '# Tu privacidad importa',
    p.intro,
    `Opción elegida: **${elegida.titulo}** ${elegida.texto}`,
    p.arco,
    `# ${tituloConsentimiento(d.terminologia)}`,
    textoConsentimiento(d),
    `☑ ${TEXTO_CASILLA}`,
  ].join('\n\n')
}

/** "iPhone · Safari", "Android · Chrome", "Windows · Edge"… (para mostrar; el user agent completo se guarda aparte) */
export function dispositivoDe(userAgent: string | null | undefined): string {
  const ua = userAgent ?? ''
  if (!ua) return 'Desconocido'
  const sistema = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Macintosh|Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Otro'
  const navegador = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador'
  return `${sistema} · ${navegador}`
}
