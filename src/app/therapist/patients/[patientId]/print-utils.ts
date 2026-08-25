/**
 * AVI — Utilidades de impresión para el Expediente Clínico
 * Centraliza toda la lógica de generación de documentos imprimibles.
 */

import { createClient } from '@/lib/supabase/client'

// ──────────────────────────────────────────────────────────
// Constantes clínicas
// ──────────────────────────────────────────────────────────

export const DIMENSIONES = [
  {
    id: 'volitiva',
    label: 'Volitiva',
    desc: 'Capacidad mental de disponer de su voluntad, tomar decisiones y control de su propia conducta',
  },
  {
    id: 'cognicion',
    label: 'Cognición',
    desc: 'Capacidad de pensar, aprender, recordar, memorizar, atención y lenguaje',
  },
  {
    id: 'afecto',
    label: 'Afecto',
    desc: 'Capacidad de tener lazos con otras personas a través de las emociones, sentimientos y estados de ánimo',
  },
  {
    id: 'social',
    label: 'Social o relacional',
    desc: 'Capacidad de interactuar, comunicarse y crear vínculos interpersonales con su entorno, incluyendo familia, amigos y pareja',
  },
  {
    id: 'espiritual',
    label: 'Espiritual',
    desc: 'Capacidad de encontrar sentido a la vida, la trascendencia y la conexión profunda',
  },
  {
    id: 'conductual',
    label: 'Conductual',
    desc: 'Capacidad de manifestar respuesta en su entorno mediante acciones, reacciones y comportamientos observables',
  },
  {
    id: 'fisico',
    label: 'Físico',
    desc: 'Capacidad de desarrollar o atender sus funciones vitales e imagen corporal',
  },
]

// ──────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────

export interface NotaInicialPrint {
  initial_note:            string
  initial_note_date:       string | null
  initial_note_motivo:     string
  initial_note_subyacente: string
  initial_note_premisas:   string
  initial_note_pro_bono:   boolean
  initial_note_virtual:    boolean
}

export interface SessionPresencialPrint {
  session_number:    number
  session_date:      string
  session_objetivo:  string | null
  session_desarrollo: string | null
  notes:             string | null  // Observaciones particulares
  is_pro_bono:       boolean
  is_virtual:        boolean
}

export interface PrintableData {
  dimensiones:        string[]
  contexto:           string
  antecedentes:       string
  sintomatologia:     string
  prediag_impresion:  string
  prediag_diagnostico: string
  prediag_areas:      string
  prediag_tipo:       string
  prediag_detonadores: string
  prediag_guia:       string
  vias_accion:        string
}

// ──────────────────────────────────────────────────────────
// Helpers de texto
// ──────────────────────────────────────────────────────────

export function bold2html(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
}

export function vias2html(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n(Aplicación:)/g, '\n\n$1')
    .replace(/\n/g, '<br>')
}

function field(label: string, value: string | null | undefined, fallback = '—') {
  return `<div class="field"><span class="label">${label}:</span> <span class="value">${value || fallback}</span></div>`
}

// ──────────────────────────────────────────────────────────
// Generador principal de Historia Clínica
// ──────────────────────────────────────────────────────────

export async function imprimirHistoriaClinica(
  patientId: string,
  therapistId: string,
  patientName: string | null,
  data: PrintableData,
  isOriginal = false,
) {
  const supabase = createClient()

  const [expedienteRes, terapeutaRes, patientRes] = await Promise.all([
    supabase.from('patient_expediente').select('*').eq('therapist_id', therapistId).eq('patient_id', patientId).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', therapistId).single(),
    supabase.from('profiles').select('email').eq('id', patientId).single(),
  ])

  const dg              = expedienteRes.data
  const terapeutaNombre = terapeutaRes.data?.full_name ?? ''
  const patientEmail    = patientRes.data?.email ?? ''
  const fechaHoy        = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  const hijos: Array<{ nombre: string; edad: string; ocupacion: string; vive_en_casa: string }> = dg?.hijos ?? []
  const hijosConDatos = hijos.filter(h => h.nombre || h.edad || h.ocupacion || h.vive_en_casa)

  const hijosHTML = hijosConDatos.length > 0
    ? `<table class="table-data">
        <thead><tr><th>#</th><th>Nombre</th><th>Edad</th><th>Ocupación</th><th>Viven en casa</th></tr></thead>
        <tbody>
          ${hijosConDatos.map((h, i) => `<tr><td>${i + 1}</td><td>${h.nombre || '—'}</td><td>${h.edad || '—'}</td><td>${h.ocupacion || '—'}</td><td>${h.vive_en_casa || '—'}</td></tr>`).join('')}
        </tbody>
      </table>`
    : '<p class="empty">No registrado</p>'

  const dimensionesSeleccionadas = DIMENSIONES.filter(d => data.dimensiones.includes(d.id))

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Historia Clínica — ${patientName ?? 'Paciente'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { margin: 2.2cm 2.5cm; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 10.5pt;
      color: #1a1a1a;
      line-height: 1.55;
    }

    /* ─── Encabezado ─── */
    .header {
      text-align: center;
      border-bottom: 2pt solid #2d3a8c;
      padding-bottom: 12pt;
      margin-bottom: 14pt;
    }
    .header h1 {
      font-size: 14pt;
      letter-spacing: 0.5pt;
      color: #2d3a8c;
      text-transform: uppercase;
      margin-bottom: 4pt;
    }
    .header .subtitle { font-size: 9pt; color: #555; font-style: italic; }
    .header .badge-original {
      margin-top: 6pt;
      font-size: 8.5pt;
      color: #b243d5;
      font-weight: bold;
      letter-spacing: 0.3pt;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 18pt;
      font-size: 9.5pt;
      color: #444;
    }
    .meta strong { color: #1a1a1a; }

    /* ─── Secciones ─── */
    .section { margin-bottom: 16pt; page-break-inside: avoid; }
    .section-break-before { page-break-before: always; margin-bottom: 16pt; page-break-inside: avoid; }
    .section-title {
      font-size: 10.5pt;
      font-weight: bold;
      color: #2d3a8c;
      text-transform: uppercase;
      letter-spacing: 0.4pt;
      border-bottom: 1pt solid #b0bbd4;
      padding-bottom: 4pt;
      margin-bottom: 10pt;
    }
    .section-title .num { font-size: 9pt; font-weight: normal; margin-right: 4pt; opacity: 0.7; }

    /* ─── Subsecciones ─── */
    .subsection { margin-bottom: 10pt; }
    .subsection-title {
      font-size: 9.5pt;
      font-weight: bold;
      color: #333;
      margin-bottom: 5pt;
      text-decoration: underline;
      text-underline-offset: 2pt;
    }

    /* ─── Campos ─── */
    .field { margin-bottom: 4pt; font-size: 10pt; }
    .label { font-weight: bold; color: #333; }
    .value { color: #1a1a1a; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4pt 16pt; }
    .empty { color: #888; font-style: italic; font-size: 9.5pt; }

    /* ─── Tabla de hijos ─── */
    .table-data { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 4pt; }
    .table-data th { background: #eef1f8; font-weight: bold; padding: 4pt 6pt; text-align: left; border: 0.5pt solid #c5cfe0; font-size: 9pt; }
    .table-data td { padding: 3pt 6pt; border: 0.5pt solid #dde3ee; }

    /* ─── Prediagnóstico ─── */
    .prediag-item { margin-bottom: 8pt; }
    .prediag-label { font-weight: bold; font-size: 10pt; color: #2d3a8c; display: block; margin-bottom: 2pt; }
    .prediag-text { font-size: 10pt; color: #1a1a1a; padding-left: 8pt; font-style: italic; }
    .prediag-empty { font-size: 9.5pt; color: #999; padding-left: 8pt; font-style: italic; }

    /* ─── Vías de acción ─── */
    .vias-content { font-size: 9.5pt; line-height: 1.6; color: #1a1a1a; }

    /* ─── Dimensiones ─── */
    .dim-list { list-style: disc; padding-left: 16pt; font-size: 10pt; }
    .dim-list li { margin-bottom: 3pt; }
    .dim-label { font-weight: bold; }
    .dim-desc { color: #444; font-size: 9.5pt; }

    /* ─── Firma ─── */
    .firma-section {
      margin-top: 28pt;
      border-top: 1pt solid #ccc;
      padding-top: 14pt;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30pt;
    }
    .firma-item { text-align: center; }
    .firma-linea { border-top: 1pt solid #333; padding-top: 5pt; font-size: 9.5pt; color: #444; }
    .firma-name { margin-top: 4pt; font-size: 9.5pt; font-weight: bold; color: #1a1a1a; }
    .firma-label { font-size: 10pt; font-weight: bold; color: #333; margin-bottom: 20pt; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <div class="no-print" style="text-align:right;padding:10pt 0 14pt;">
    <button onclick="window.print()" style="padding:8pt 18pt;background:#2d3a8c;color:white;border:none;border-radius:8pt;font-size:10pt;cursor:pointer;">
      🖨 Imprimir / Guardar PDF
    </button>
  </div>

  <div class="header">
    <h1>Historia Clínica Inicial y Prediagnóstico</h1>
    <div class="subtitle">Asesor/Terapeuta: ${terapeutaNombre || '—'}</div>
    ${isOriginal ? `<div class="badge-original">★ VERSIÓN ORIGINAL AVI — generada automáticamente</div>` : ''}
  </div>

  <div class="meta">
    <div><strong>Consultante:</strong> ${patientName ?? '—'}</div>
    <div><strong>Fecha de elaboración:</strong> ${fechaHoy}</div>
  </div>

  <!-- DATOS GENERALES -->
  <div class="section">
    <div class="section-title">Datos Generales</div>
    ${field('Tipo de caso', dg?.tipo_caso)}

    <div class="subsection" style="margin-top:8pt;">
      <div class="subsection-title">Datos del Asesorado</div>
      <div class="grid-2">
        ${field('Nombre', dg?.asesorado_nombre)}
        ${field('Sexo', dg?.asesorado_sexo)}
        ${field('Edad', dg?.asesorado_edad)}
        ${field('Fecha de nacimiento', dg?.asesorado_fecha_nacimiento ? new Date(dg.asesorado_fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '')}
        ${field('Lugar de nacimiento', dg?.asesorado_lugar_nacimiento)}
        ${field('Estado civil', dg?.asesorado_estado_civil)}
        ${field('Escolaridad', dg?.asesorado_escolaridad)}
        ${field('Ocupación', dg?.asesorado_ocupacion)}
        ${field('Religión', dg?.asesorado_religion)}
        ${field('Parroquia', dg?.asesorado_parroquia)}
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-title">Datos de Contacto</div>
      <div class="grid-2">
        ${field('Teléfono', dg?.contacto_telefono)}
        ${field('Correo electrónico', patientEmail)}
        ${field('Domicilio', dg?.contacto_domicilio)}
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-title">Datos de la Pareja</div>
      <div class="grid-2">
        ${field('Nombre', dg?.pareja_nombre)}
        ${field('Sexo', dg?.pareja_sexo)}
        ${field('Edad', dg?.pareja_edad)}
        ${field('Fecha de nacimiento', dg?.pareja_fecha_nacimiento ? new Date(dg.pareja_fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '')}
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-title">Datos de los Hijos</div>
      ${hijosHTML}
    </div>

    <div class="subsection">
      <div class="subsection-title">Salud</div>
      <div class="grid-2">
        ${field('¿Padece alguna enfermedad?', dg?.salud_padece_enfermedad)}
        ${field('¿Ha recibido ayuda psicológica?', dg?.salud_ayuda_psicologica)}
        ${dg?.salud_ayuda_psicologica === 'Sí' ? field('¿Hace cuánto tiempo?', dg?.salud_ayuda_tiempo) : ''}
        ${field('¿Toma medicamentos?', dg?.salud_medicamentos)}
        ${dg?.salud_medicamentos === 'Sí' ? field('¿Cuál(es)?', dg?.salud_medicamentos_cual) : ''}
      </div>
    </div>
  </div>

  <!-- I. DIMENSIONES EVOLUTIVAS -->
  <div class="section">
    <div class="section-title"><span class="num">I.</span> Dimensiones Evolutivas</div>
    ${dimensionesSeleccionadas.length > 0
      ? `<ul class="dim-list">${dimensionesSeleccionadas.map(d =>
          `<li><span class="dim-label">${d.label}:</span> <span class="dim-desc">${d.desc}</span></li>`
        ).join('')}</ul>`
      : '<p class="empty">No se seleccionaron dimensiones evolutivas</p>'
    }
  </div>

  <!-- II. CONTEXTO -->
  <div class="section">
    <div class="section-title"><span class="num">II.</span> Contexto</div>
    <p>${data.contexto || '<span class="empty">No especificado</span>'}</p>
  </div>

  <!-- III. ANTECEDENTES DE RELEVANCIA -->
  <div class="section">
    <div class="section-title"><span class="num">III.</span> Antecedentes de Relevancia</div>
    ${data.antecedentes
      ? `<div style="line-height:1.6;font-size:10pt;">${bold2html(data.antecedentes)}</div>`
      : '<p class="empty">Sin registrar</p>'
    }
  </div>

  <!-- IV. SINTOMATOLOGÍA OBSERVADA -->
  <div class="section">
    <div class="section-title"><span class="num">IV.</span> Sintomatología Observada</div>
    <p>${data.sintomatologia || '<span class="empty">Sin registrar</span>'}</p>
  </div>

  <!-- V. PREDIAGNÓSTICO -->
  <div class="section-break-before">
    <div class="section-title"><span class="num">V.</span> Prediagnóstico</div>
    ${[
      { label: 'Impresión del sujeto de evaluación',                  value: data.prediag_impresion   },
      { label: 'Diagnóstico presuntivo',                               value: data.prediag_diagnostico },
      { label: 'Áreas de conflicto (áreas afectadas)',                value: data.prediag_areas       },
      { label: 'Tipo de problema (individual, familiar, de pareja…)', value: data.prediag_tipo        },
      { label: 'Detonadores',                                         value: data.prediag_detonadores },
      { label: 'Guía de acción o trabajo',                            value: data.prediag_guia        },
    ].map(item => `
      <div class="prediag-item">
        <span class="prediag-label">${item.label}:</span>
        ${item.value
          ? `<div class="prediag-text">${item.value}</div>`
          : '<div class="prediag-empty">—</div>'
        }
      </div>
    `).join('')}
  </div>

  <!-- VI. PLAN DE INTERVENCIÓN -->
  <div class="section">
    <div class="section-title"><span class="num">VI.</span> Plan de Intervención — Plan de 10 a 12 sesiones</div>
    ${data.vias_accion
      ? `<div class="vias-content">${vias2html(data.vias_accion)}</div>`
      : '<p class="empty">Sin registrar</p>'
    }
  </div>

  <!-- FIRMAS -->
  <div class="firma-section">
    <div class="firma-item">
      <div class="firma-label">Elabora</div>
      <div class="firma-linea">
        <div class="firma-name">${terapeutaNombre}</div>
        <div style="font-size:8.5pt;color:#666;">Nombre y firma del Terapeuta</div>
      </div>
    </div>
    <div class="firma-item">
      <div class="firma-label">VoBo</div>
      <div class="firma-linea">
        <div class="firma-name">&nbsp;</div>
        <div style="font-size:8.5pt;color:#666;">Nombre y firma</div>
      </div>
    </div>
  </div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Permite ventanas emergentes para imprimir.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
}

// ──────────────────────────────────────────────────────────
// CSS compartido entre documentos de impresión
// ──────────────────────────────────────────────────────────

function sharedCSS() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { margin: 2.2cm 2.5cm; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 10.5pt;
      color: #1a1a1a;
      line-height: 1.55;
    }

    /* ─── Pre-header ─── */
    .pre-header {
      margin-bottom: 10pt;
    }
    .pre-header-row {
      display: flex;
      justify-content: space-between;
      font-size: 9.5pt;
      color: #333;
      padding: 2.5pt 0;
      border-bottom: 0.5pt solid #dde3ee;
    }
    .pre-header-row:last-child { border-bottom: none; }
    .pre-header-row strong { color: #1a1a1a; }

    /* ─── Encabezado ─── */
    .header {
      text-align: center;
      border-bottom: 2pt solid #2d3a8c;
      border-top: 0.5pt solid #2d3a8c;
      padding: 10pt 0;
      margin-bottom: 14pt;
    }
    .header h1 {
      font-size: 14pt;
      letter-spacing: 0.5pt;
      color: #2d3a8c;
      text-transform: uppercase;
    }
    .header .subtitle {
      font-size: 10pt;
      color: #5060a4;
      font-style: italic;
      margin-top: 2pt;
    }

    /* ─── Meta ─── */
    .meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 18pt;
      font-size: 9.5pt;
      color: #444;
      background: #f4f6fb;
      padding: 6pt 10pt;
      border-radius: 4pt;
    }
    .meta strong { color: #1a1a1a; }
    .badge { font-size: 8.5pt; background: #e8f0fe; color: #2d3a8c; padding: 1pt 6pt; border-radius: 20pt; margin-left: 5pt; }

    /* ─── Secciones ─── */
    .section { margin-bottom: 16pt; page-break-inside: avoid; }
    .section-break-before { page-break-before: always; margin-bottom: 16pt; }
    .section-title {
      font-size: 10.5pt;
      font-weight: bold;
      color: #2d3a8c;
      text-transform: uppercase;
      letter-spacing: 0.4pt;
      border-bottom: 1pt solid #b0bbd4;
      padding-bottom: 4pt;
      margin-bottom: 10pt;
    }
    .section-title .num { font-size: 9pt; font-weight: normal; margin-right: 4pt; opacity: 0.7; }
    .section-body { font-size: 10pt; line-height: 1.65; color: #1a1a1a; white-space: pre-wrap; }
    .empty { color: #999; font-style: italic; font-size: 9.5pt; }

    /* ─── Sesiones ─── */
    .session-card {
      border: 0.5pt solid #c8d0e8;
      border-radius: 5pt;
      margin-bottom: 18pt;
      page-break-inside: avoid;
      overflow: hidden;
    }
    .session-header {
      background: #eef1f9;
      padding: 7pt 12pt;
      display: flex;
      align-items: center;
      gap: 12pt;
      border-bottom: 0.5pt solid #c8d0e8;
    }
    .session-num {
      font-size: 11pt;
      font-weight: bold;
      color: #2d3a8c;
    }
    .session-date { font-size: 9.5pt; color: #444; }
    .session-badge { font-size: 8pt; background: #dde8f8; color: #2d3a8c; padding: 1pt 6pt; border-radius: 20pt; }
    .session-body { padding: 10pt 14pt; }
    .session-field { margin-bottom: 9pt; }
    .session-field-title {
      font-size: 9pt;
      font-weight: bold;
      color: #2d3a8c;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
      margin-bottom: 3pt;
    }
    .session-field-text { font-size: 10pt; line-height: 1.6; color: #1a1a1a; white-space: pre-wrap; }

    /* ─── Firma ─── */
    .firma-section {
      margin-top: 28pt;
      border-top: 1pt solid #ccc;
      padding-top: 14pt;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30pt;
    }
    .firma-item { text-align: center; }
    .firma-linea { border-top: 1pt solid #333; padding-top: 5pt; font-size: 9.5pt; color: #444; }
    .firma-name { margin-top: 4pt; font-size: 9.5pt; font-weight: bold; color: #1a1a1a; }
    .firma-label { font-size: 10pt; font-weight: bold; color: #333; margin-bottom: 20pt; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  `
}

// ──────────────────────────────────────────────────────────
// Impresión: Entrevista Inicial (Nota Inicial)
// ──────────────────────────────────────────────────────────

export async function imprimirNotaInicial(
  therapistId: string,
  patientName: string | null,
  data: NotaInicialPrint,
) {
  const supabase = createClient()
  const { data: terapeutaRow } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', therapistId)
    .single()

  const terapeutaNombre = terapeutaRow?.full_name ?? '—'
  const fechaConsulta   = data.initial_note_date
    ? new Date(data.initial_note_date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'
  const fechaHoy = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  const badges = [
    data.initial_note_pro_bono ? '<span class="badge">Pro-bono</span>' : '',
    data.initial_note_virtual  ? '<span class="badge">Virtual</span>'  : '',
  ].filter(Boolean).join(' ')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Entrevista Inicial — ${patientName ?? 'Paciente'}</title>
  <style>${sharedCSS()}</style>
</head>
<body>

  <div class="no-print" style="text-align:right;padding:10pt 0 14pt;">
    <button onclick="window.print()" style="padding:8pt 18pt;background:#2d3a8c;color:white;border:none;border-radius:8pt;font-size:10pt;cursor:pointer;">
      🖨 Imprimir / Guardar PDF
    </button>
  </div>

  <!-- Pre-header -->
  <div class="pre-header">
    <div class="pre-header-row">
      <span><strong>Asesorado:</strong> ${patientName ?? '—'}</span>
      <span><strong>Asesor/Terapeuta:</strong> ${terapeutaNombre}</span>
    </div>
  </div>

  <!-- Título -->
  <div class="header">
    <h1>Entrevista Inicial</h1>
    <div class="subtitle">(Nota Inicial)</div>
  </div>

  <!-- Meta -->
  <div class="meta">
    <div><strong>Fecha de consulta inicial:</strong> ${fechaConsulta}${badges}</div>
    <div><strong>Fecha de elaboración:</strong> ${fechaHoy}</div>
  </div>

  <!-- 1. Desarrollo del caso -->
  <div class="section">
    <div class="section-title"><span class="num">1.</span> Desarrollo del caso</div>
    ${data.initial_note?.trim()
      ? `<div class="section-body">${data.initial_note.trim()}</div>`
      : '<p class="empty">Sin registrar</p>'
    }
  </div>

  <!-- 2. Motivo de consulta del paciente -->
  <div class="section">
    <div class="section-title"><span class="num">2.</span> Motivo de consulta del paciente</div>
    ${data.initial_note_motivo?.trim()
      ? `<div class="section-body">${data.initial_note_motivo.trim()}</div>`
      : '<p class="empty">Sin registrar</p>'
    }
  </div>

  <!-- 3. Motivo de consulta subyacente -->
  <div class="section">
    <div class="section-title"><span class="num">3.</span> Motivo de consulta subyacente</div>
    ${data.initial_note_subyacente?.trim()
      ? `<div class="section-body">${data.initial_note_subyacente.trim()}</div>`
      : '<p class="empty">Sin registrar</p>'
    }
  </div>

  <!-- 4. Premisas ante el motivo de consulta -->
  <div class="section">
    <div class="section-title"><span class="num">4.</span> Premisas ante el motivo de consulta</div>
    ${data.initial_note_premisas?.trim()
      ? `<div class="section-body">${data.initial_note_premisas.trim()}</div>`
      : '<p class="empty">Sin registrar</p>'
    }
  </div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Permite ventanas emergentes para imprimir.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
}

// ──────────────────────────────────────────────────────────
// Impresión: Bitácora de Asesoría (Sesiones presenciales)
// ──────────────────────────────────────────────────────────

export async function imprimirBitacoraSesiones(
  therapistId: string,
  patientName: string | null,
  sesiones: SessionPresencialPrint[],
) {
  const supabase = createClient()
  const { data: terapeutaRow } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', therapistId)
    .single()

  const terapeutaNombre = terapeutaRow?.full_name ?? '—'
  const fechaHoy = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  const total = sesiones.length

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  const periodo = total === 0
    ? '—'
    : total === 1
      ? fmtDate(sesiones[0].session_date)
      : `${fmtDate(sesiones[0].session_date)} – ${fmtDate(sesiones[total - 1].session_date)}`

  const sesionesHTML = sesiones.map(s => {
    const badges = [
      s.is_pro_bono ? '<span class="session-badge">Pro-bono</span>' : '',
      s.is_virtual  ? '<span class="session-badge">Virtual</span>'  : '',
    ].filter(Boolean).join(' ')

    const campoHTML = (num: number, titulo: string, valor: string | null | undefined) => {
      if (!valor?.trim()) return ''
      return `<div class="session-field">
        <div class="session-field-title">${num}. ${titulo}</div>
        <div class="session-field-text">${valor.trim()}</div>
      </div>`
    }

    return `
      <div class="session-card">
        <div class="session-header">
          <span class="session-num">Sesión ${s.session_number}</span>
          <span class="session-date">${fmtDate(s.session_date)}</span>
          ${badges}
        </div>
        <div class="session-body">
          ${campoHTML(1, 'Objetivo de la sesión',      s.session_objetivo)}
          ${campoHTML(2, 'Desarrollo de la sesión',    s.session_desarrollo)}
          ${campoHTML(3, 'Observaciones particulares', s.notes)}
        </div>
      </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Bitácora de Asesoría — ${patientName ?? 'Paciente'}</title>
  <style>${sharedCSS()}</style>
</head>
<body>

  <div class="no-print" style="text-align:right;padding:10pt 0 14pt;">
    <button onclick="window.print()" style="padding:8pt 18pt;background:#2d3a8c;color:white;border:none;border-radius:8pt;font-size:10pt;cursor:pointer;">
      🖨 Imprimir / Guardar PDF
    </button>
  </div>

  <!-- Pre-header (2 renglones) -->
  <div class="pre-header">
    <div class="pre-header-row">
      <span></span>
      <span><strong>Fecha:</strong> ${periodo}</span>
    </div>
    <div class="pre-header-row">
      <span><strong>Asesorado:</strong> ${patientName ?? '—'}</span>
      <span><strong>Asesor/Terapeuta:</strong> ${terapeutaNombre}</span>
    </div>
  </div>

  <!-- Título -->
  <div class="header">
    <h1>Bitácora de Asesoría</h1>
    <div class="subtitle">(Sesiones presenciales)</div>
  </div>

  <!-- Meta -->
  <div class="meta">
    <div><strong>Total de sesiones:</strong> ${total}</div>
    <div><strong>Fecha de elaboración:</strong> ${fechaHoy}</div>
  </div>

  <!-- Sesiones -->
  ${total === 0
    ? '<p class="empty" style="text-align:center;padding:20pt;">No hay sesiones registradas.</p>'
    : sesionesHTML
  }

</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Permite ventanas emergentes para imprimir.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
}

// ──────────────────────────────────────────────────────────
// Historia Clínica V2 — Modelo Personalista Bio-Psico-Social
// ──────────────────────────────────────────────────────────

export interface HistoriaClinicaV2 {
  motivos_consulta:         string
  motivos_subyacente:       string
  premisas:                 string
  generalidades:            string
  contexto:                 string
  antecedentes:             string
  referentes_estructurales: string
  dinamica_relacional:      string
  sintomatologia:           string
  plan_intervencion:        string
}

export async function imprimirHistoriaClinicaV2(
  patientId:   string,
  therapistId: string,
  patientName: string | null,
  data: HistoriaClinicaV2,
) {
  const supabase = createClient()

  const [expedienteRes, terapeutaRes, patientRes] = await Promise.all([
    supabase.from('patient_expediente').select('*').eq('therapist_id', therapistId).eq('patient_id', patientId).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', therapistId).single(),
    supabase.from('profiles').select('email').eq('id', patientId).single(),
  ])

  const dg              = expedienteRes.data as Record<string, unknown> | null
  const terapeutaNombre = terapeutaRes.data?.full_name ?? '—'
  const patientEmail    = patientRes.data?.email ?? ''
  const fechaHoy        = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  type HijoRow = { nombre: string; edad: string; ocupacion: string; vive_en_casa: string }
  const hijos: HijoRow[] = (dg?.hijos as HijoRow[]) ?? []
  const hijosConDatos = hijos.filter(h => h.nombre || h.edad || h.ocupacion || h.vive_en_casa)

  const hijosHTML = hijosConDatos.length > 0
    ? `<table class="table-data">
        <thead><tr><th>#</th><th>Nombre</th><th>Edad</th><th>Ocupación</th><th>Viven en casa</th></tr></thead>
        <tbody>
          ${hijosConDatos.map((h, i) => `<tr><td>${i + 1}</td><td>${h.nombre || '—'}</td><td>${h.edad || '—'}</td><td>${h.ocupacion || '—'}</td><td>${h.vive_en_casa || '—'}</td></tr>`).join('')}
        </tbody>
      </table>`
    : '<p class="empty">No registrado</p>'

  const tipoCaso = (dg?.tipo_caso as string) ?? '—'

  function dgField(label: string, val: unknown, fallback = '—') {
    return `<div class="dg-field"><span class="label">${label}:</span> <span class="value">${val || fallback}</span></div>`
  }

  function sectionBlock(num: string, title: string, content: string, breakBefore = false) {
    const cls  = breakBefore ? 'section-break-before' : 'section'
    const body = content?.trim()
      ? `<div class="section-body">${content.trim().replace(/\n/g, '<br>')}</div>`
      : '<p class="empty">Sin registrar</p>'
    return `
      <div class="${cls}">
        <div class="section-title"><span class="num">${num}.</span> ${title}</div>
        ${body}
      </div>`
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Historia Clínica — ${patientName ?? 'Paciente'}</title>
  <style>
    ${sharedCSS()}

    .dg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3pt 14pt; margin-bottom: 6pt; }
    .dg-field { font-size: 10pt; margin-bottom: 2pt; }
    .label { font-weight: bold; color: #333; }
    .value { color: #1a1a1a; }
    .subsection-title {
      font-size: 9.5pt; font-weight: bold; color: #444;
      text-decoration: underline; text-underline-offset: 2pt; margin: 7pt 0 4pt;
    }
    .table-data { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 4pt; }
    .table-data th { background: #eef1f8; font-weight: bold; padding: 4pt 6pt; text-align: left; border: 0.5pt solid #c5cfe0; font-size: 9pt; }
    .table-data td { padding: 3pt 6pt; border: 0.5pt solid #dde3ee; }
    .vias-content { font-size: 9.5pt; line-height: 1.65; white-space: pre-wrap; }
  </style>
</head>
<body>

  <div class="no-print" style="text-align:right;padding:10pt 0 14pt;">
    <button onclick="window.print()" style="padding:8pt 18pt;background:#2d3a8c;color:white;border:none;border-radius:8pt;font-size:10pt;cursor:pointer;">
      🖨 Imprimir / Guardar PDF
    </button>
  </div>

  <div class="pre-header">
    <div class="pre-header-row">
      <span><strong>Asesorado:</strong> ${patientName ?? '—'}</span>
      <span><strong>Asesor/Terapeuta:</strong> ${terapeutaNombre}</span>
    </div>
    <div class="pre-header-row">
      <span><strong>Tipo de caso:</strong> ${tipoCaso}</span>
      <span><strong>Correo:</strong> ${patientEmail || '—'}</span>
    </div>
  </div>

  <div class="header">
    <h1>Historia Clínica</h1>
    <div class="subtitle">Modelo Personalista Bio-Psico-Social</div>
  </div>

  <div class="meta">
    <div><strong>Consultante:</strong> ${patientName ?? '—'}</div>
    <div><strong>Fecha de elaboración:</strong> ${fechaHoy}</div>
  </div>

  <!-- DATOS GENERALES -->
  <div class="section">
    <div class="section-title">Datos Generales</div>

    <div class="subsection-title">Datos del Asesorado</div>
    <div class="dg-grid">
      ${dgField('Nombre', dg?.asesorado_nombre)}
      ${dgField('Sexo', dg?.asesorado_sexo)}
      ${dgField('Edad', dg?.asesorado_edad)}
      ${dgField('Fecha de nacimiento', dg?.asesorado_fecha_nacimiento ? new Date(String(dg.asesorado_fecha_nacimiento) + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '')}
      ${dgField('Lugar de nacimiento', dg?.asesorado_lugar_nacimiento)}
      ${dgField('Estado civil', dg?.asesorado_estado_civil)}
      ${dgField('Escolaridad', dg?.asesorado_escolaridad)}
      ${dgField('Ocupación', dg?.asesorado_ocupacion)}
      ${dgField('Religión', dg?.asesorado_religion)}
      ${dgField('Parroquia', dg?.asesorado_parroquia)}
    </div>

    <div class="subsection-title">Datos de Contacto</div>
    <div class="dg-grid">
      ${dgField('Teléfono', dg?.contacto_telefono)}
      ${dgField('Correo electrónico', patientEmail)}
      ${dgField('Domicilio', dg?.contacto_domicilio)}
    </div>

    ${dg?.pareja_nombre || dg?.pareja_edad ? `
    <div class="subsection-title">Datos de la Pareja</div>
    <div class="dg-grid">
      ${dgField('Nombre', dg?.pareja_nombre)}
      ${dgField('Sexo', dg?.pareja_sexo)}
      ${dgField('Edad', dg?.pareja_edad)}
      ${dgField('Fecha de nacimiento', dg?.pareja_fecha_nacimiento ? new Date(String(dg.pareja_fecha_nacimiento) + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '')}
    </div>` : ''}

    ${hijosConDatos.length > 0 ? `
    <div class="subsection-title">Hijos</div>
    ${hijosHTML}` : ''}

    ${dg?.salud_padece_enfermedad || dg?.salud_medicamentos || dg?.salud_ayuda_psicologica ? `
    <div class="subsection-title">Salud</div>
    <div class="dg-grid">
      ${dgField('¿Padece alguna enfermedad?', dg?.salud_padece_enfermedad)}
      ${dgField('¿Ha recibido ayuda psicológica?', dg?.salud_ayuda_psicologica)}
      ${dg?.salud_ayuda_psicologica === 'Sí' ? dgField('¿Hace cuánto tiempo?', dg?.salud_ayuda_tiempo) : ''}
      ${dgField('¿Toma medicamentos?', dg?.salud_medicamentos)}
      ${dg?.salud_medicamentos === 'Sí' ? dgField('¿Cuál(es)?', dg?.salud_medicamentos_cual) : ''}
    </div>` : ''}
  </div>

  ${sectionBlock('I',    'Motivos de Consulta',                        data.motivos_consulta)}
  ${sectionBlock('II',   'Motivo de Consulta Subyacente',             data.motivos_subyacente)}
  ${sectionBlock('III',  'Premisas ante el Motivo de Consulta (NOM-004)', data.premisas)}
  ${sectionBlock('IV',   'Generalidades del Caso',                    data.generalidades)}
  ${sectionBlock('V',    'Contexto',                                   data.contexto)}
  ${sectionBlock('VI',   'Antecedentes de Relevancia',                data.antecedentes, true)}
  ${sectionBlock('VII',  'Referentes Estructurales',                  data.referentes_estructurales)}
  ${sectionBlock('VIII', 'Dinámica Relacional',                       data.dinamica_relacional)}
  ${sectionBlock('IX',   'Sintomatología Observada',                  data.sintomatologia)}

  <!-- X. PLAN DE INTERVENCIÓN -->
  <div class="section">
    <div class="section-title"><span class="num">X.</span> Plan de Intervención — Plan de 10 a 12 sesiones</div>
    ${data.plan_intervencion?.trim()
      ? `<div class="vias-content">${vias2html(data.plan_intervencion)}</div>`
      : '<p class="empty">Sin registrar</p>'
    }
  </div>

  <!-- FIRMAS -->
  <div class="firma-section">
    <div class="firma-item">
      <div class="firma-label">Elabora</div>
      <div class="firma-linea">
        <div class="firma-name">${terapeutaNombre}</div>
        <div style="font-size:8.5pt;color:#666;">Nombre y firma del Terapeuta</div>
      </div>
    </div>
    <div class="firma-item">
      <div class="firma-label">VoBo</div>
      <div class="firma-linea">
        <div class="firma-name">&nbsp;</div>
        <div style="font-size:8.5pt;color:#666;">Nombre y firma</div>
      </div>
    </div>
  </div>

</body>
</html>`

  const winV2 = window.open('', '_blank', 'width=900,height=700')
  if (!winV2) { alert('Permite ventanas emergentes para imprimir.'); return }
  winV2.document.write(html)
  winV2.document.close()
  winV2.focus()
}
