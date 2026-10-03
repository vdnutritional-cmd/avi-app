/**
 * AVI — Utilidades de impresión para el Expediente Clínico
 * Centraliza toda la lógica de generación de documentos imprimibles.
 */

import { createClient } from '@/lib/supabase/client'
import {
  resolveFactores,
  SCHEMA_LABELS,
  SCHEMA_RIESGO_COL,
  SCHEMA_PROTECCION_COL,
} from './factores-nota-inicial'

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
  // Campos opcionales — presentes cuando se imprime desde Reportes
  frecuencia_config?:          string | null
  sensacion_paciente_inicial?: string | null
  factoresRiesgoHtml?:         string
  factoresProteccionHtml?:     string
}

export interface SessionPresencialPrint {
  session_number:     number
  session_date:       string
  session_objetivo:   string | null
  session_emociones:  string | null  // Emociones identificadas
  session_recursos:   string | null  // Recursos personales del paciente
  session_desarrollo: string | null
  notes:              string | null  // Observaciones particulares / Acuerdos / Tareas
  is_pro_bono:        boolean
  is_virtual:         boolean
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

/** Convierte Markdown básico (tablas, encabezados, negrita) a HTML para impresión */
export function markdown2html(text: string): string {
  function inline(s: string): string {
    return s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  }
  const lines = text.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // Tabla Markdown
    if (line.trim().startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]); i++
      }
      // Separar encabezado, separador y filas
      const [headerRow, , ...bodyRows] = tableLines
      const parseCells = (r: string) =>
        r.split('|').slice(1, -1).map(c => c.trim())
      const hCells = parseCells(headerRow ?? '')
      const bRows  = bodyRows.filter(r => !r.match(/^\s*\|[\s\-:|]+\|\s*$/))
      out.push(`<table class="md-table">
        <thead><tr>${hCells.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead>
        <tbody>${bRows.map(r => `<tr>${parseCells(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`)
      continue
    }
    // Encabezados
    if (/^#{1,3} /.test(line)) {
      const level = line.match(/^(#+)/)?.[1].length ?? 3
      const tag   = level <= 2 ? 'h3' : 'h4'
      out.push(`<${tag} class="md-h">${inline(line.replace(/^#+\s*/, ''))}</${tag}>`)
      i++; continue
    }
    // Línea vacía
    if (line.trim() === '') { out.push('<div style="height:6pt"></div>'); i++; continue }
    // Párrafo normal
    out.push(`<p class="md-p">${inline(line)}</p>`)
    i++
  }
  return out.join('\n')
}

export function vias2html(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n(Aplicación:)/g, '\n\n$1')
    .replace(/\n/g, '<br>')
}

// ──────────────────────────────────────────────────────────
// Impresión vía iframe — evita el bloqueador de popups
// Funciona en móvil y en navegadores con popups bloqueados.
// ──────────────────────────────────────────────────────────

export function printHtmlViaIframe(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document
  if (!doc) { document.body.removeChild(iframe); return }
  doc.open()
  doc.write(html)
  doc.close()
  // Dar tiempo a imágenes y fuentes para cargar antes de imprimir
  setTimeout(() => {
    try { iframe.contentWindow?.print() } catch { /* noop */ }
    setTimeout(() => { try { document.body.removeChild(iframe) } catch { /* noop */ } }, 2000)
  }, 400)
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

  printHtmlViaIframe(html)
}

// ──────────────────────────────────────────────────────────
// CSS compartido entre documentos de impresión
// ──────────────────────────────────────────────────────────

function sharedCSS() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: letter; margin: 1cm 1.8cm 1.2cm; }
    html, body { margin: 0 !important; padding: 0 !important; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #1a1a1a;
      line-height: 1.3;
    }

    /* ─── Pre-header ─── */
    .pre-header {
      margin-bottom: 5pt;
    }
    .pre-header-row {
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
      color: #333;
      padding: 2pt 0;
      border-bottom: 0.5pt solid #dde3ee;
    }
    .pre-header-row:last-child { border-bottom: none; }
    .pre-header-row strong { color: #1a1a1a; }

    /* ─── Encabezado ─── */
    .header {
      text-align: center;
      border-bottom: 2pt solid #2d3a8c;
      border-top: 0.5pt solid #2d3a8c;
      padding: 5pt 0;
      margin-bottom: 6pt;
    }
    .header h1 {
      font-size: 13pt;
      letter-spacing: 0.4pt;
      color: #2d3a8c;
      text-transform: uppercase;
    }
    .header .subtitle {
      font-size: 9.5pt;
      color: #5060a4;
      font-style: italic;
      margin-top: 1pt;
    }
    .header .badge-original {
      margin-top: 4pt;
      font-size: 8pt;
      color: #b243d5;
      font-weight: bold;
      letter-spacing: 0.3pt;
    }

    /* ─── Meta ─── */
    .meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8pt;
      font-size: 9pt;
      color: #444;
      background: #f4f6fb;
      padding: 4pt 8pt;
      border-radius: 3pt;
    }
    .meta strong { color: #1a1a1a; }
    .badge { font-size: 8pt; background: #e8f0fe; color: #2d3a8c; padding: 1pt 5pt; border-radius: 20pt; margin-left: 4pt; }

    /* ─── Secciones ─── */
    .section { margin-bottom: 10pt; }
    .section-break-before { page-break-before: always; margin-bottom: 10pt; }
    .section-title {
      font-size: 9.5pt;
      font-weight: bold;
      color: #2d3a8c;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
      border-bottom: 1pt solid #b0bbd4;
      padding-bottom: 3pt;
      margin-bottom: 6pt;
    }
    .section-title .num { font-size: 8pt; font-weight: normal; margin-right: 4pt; opacity: 0.7; }
    .section-body { font-size: 9pt; line-height: 1.5; color: #1a1a1a; white-space: pre-wrap; }
    .empty { color: #999; font-style: italic; font-size: 9pt; }

    /* ─── Sesiones ─── */
    .session-card {
      border: 0.5pt solid #c8d0e8;
      border-radius: 4pt;
      margin-bottom: 8pt;
      overflow: hidden;
    }
    .session-header {
      background: #eef1f9;
      padding: 4pt 10pt;
      display: flex;
      align-items: center;
      gap: 10pt;
      border-bottom: 0.5pt solid #c8d0e8;
    }
    .session-num {
      font-size: 10.5pt;
      font-weight: bold;
      color: #2d3a8c;
    }
    .session-date { font-size: 9pt; color: #444; }
    .session-badge { font-size: 7.5pt; background: #dde8f8; color: #2d3a8c; padding: 1pt 5pt; border-radius: 20pt; }
    .session-body { padding: 6pt 10pt; }
    .session-field { margin-bottom: 5pt; }
    .session-field-title {
      font-size: 9pt;
      font-weight: bold;
      color: #2d3a8c;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
      margin-bottom: 3pt;
    }
    .session-field-text { font-size: 9pt; line-height: 1.5; color: #1a1a1a; white-space: pre-wrap; }

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
  headerOpts?: Partial<ReportHeaderOptions>,
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
  <style>${sharedCSS()}
    .section, .section-break-before {
      page-break-inside: auto !important;
      break-inside: auto !important;
      page-break-before: auto !important;
      break-before: auto !important;
      margin-bottom: 8pt !important;
    }
  </style>
</head>
<body>

  <div class="no-print" style="text-align:right;padding:10pt 0 14pt;">
    <button onclick="window.print()" style="padding:8pt 18pt;background:#2d3a8c;color:white;border:none;border-radius:8pt;font-size:10pt;cursor:pointer;">
      🖨 Imprimir / Guardar PDF
    </button>
  </div>

  ${buildReportHeader({ terapeutaNombre, logoUrl: headerOpts?.logoUrl ?? null, side: headerOpts?.side ?? 'name', subtitle: 'Registro de Entrevista Inicial (Nota Inicial)' })}

  <!-- Asesorado -->
  <div class="pre-header">
    <div class="pre-header-row">
      <span><strong>Asesorado/a:</strong> ${patientName ?? '—'}</span>
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

  ${data.frecuencia_config ? `
  <!-- 5. Frecuencia de las sesiones -->
  <div class="section">
    <div class="section-title"><span class="num">5.</span> Frecuencia de las sesiones</div>
    <div class="section-body">${data.frecuencia_config}</div>
  </div>` : ''}

  ${data.sensacion_paciente_inicial ? `
  <!-- 6. Sensación inicial del paciente -->
  <div class="section">
    <div class="section-title"><span class="num">6.</span> Sensación inicial del paciente</div>
    <div class="section-body">${data.sensacion_paciente_inicial.replace(/\n/g, '<br>')}</div>
  </div>` : ''}

  ${data.factoresRiesgoHtml ? `
  <!-- 7. Factores de riesgo activos -->
  <div class="section">
    <div class="section-title"><span class="num">7.</span> Factores de riesgo activos</div>
    <style>
      .factor-schema { font-weight:bold; font-size:9.5pt; color:#2d3a8c; margin: 6pt 0 3pt; }
      .factor-list   { list-style:disc; padding-left:18pt; font-size:10pt; margin-bottom:6pt; }
    </style>
    ${data.factoresRiesgoHtml}
  </div>` : ''}

  ${data.factoresProteccionHtml ? `
  <!-- 8. Factores de protección activos -->
  <div class="section">
    <div class="section-title"><span class="num">8.</span> Factores de protección activos</div>
    ${data.factoresProteccionHtml}
  </div>` : ''}

</body>
</html>`

  printHtmlViaIframe(html)
}

// ──────────────────────────────────────────────────────────
// Impresión: Bitácora de Asesoría (Sesiones presenciales)
// ──────────────────────────────────────────────────────────

export async function imprimirBitacoraSesiones(
  therapistId: string,
  patientName: string | null,
  sesiones: SessionPresencialPrint[],
  headerOpts?: Partial<ReportHeaderOptions>,
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
          ${campoHTML(1, 'Objetivo de la sesión / Seguimiento',              s.session_objetivo)}
          ${campoHTML(2, 'Desarrollo de la sesión / Intervención realizada', s.session_desarrollo)}
          ${campoHTML(3, 'Emociones identificadas',                          s.session_emociones)}
          ${campoHTML(4, 'Recursos personales del paciente',                 s.session_recursos)}
          ${campoHTML(5, 'Observaciones particulares / Acuerdos / Tareas',   s.notes)}
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

  ${buildReportHeader({ terapeutaNombre, logoUrl: headerOpts?.logoUrl ?? null, side: headerOpts?.side ?? 'name', subtitle: 'Bitácora de Sesiones Presenciales' })}

  <!-- Asesorado y período -->
  <div class="pre-header">
    <div class="pre-header-row">
      <span><strong>Asesorado/a:</strong> ${patientName ?? '—'}</span>
      <span><strong>Período:</strong> ${periodo}</span>
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

  printHtmlViaIframe(html)
}

// ──────────────────────────────────────────────────────────
// Reporte Valorativo
// ──────────────────────────────────────────────────────────

export async function imprimirReporteValorativo(
  patientId:   string,
  therapistId: string,
  patientName: string | null,
  headerOpts?: Partial<ReportHeaderOptions>,
) {
  const supabase = createClient()

  const [expedienteRes, notaRes, terapeutaRes, patientRes] = await Promise.all([
    supabase.from('patient_expediente')
      .select(`
        tipo_caso, asesorado_nombre, asesorado_sexo, asesorado_edad,
        asesorado_fecha_nacimiento, asesorado_lugar_nacimiento, asesorado_estado_civil,
        asesorado_escolaridad, asesorado_ocupacion, asesorado_religion, asesorado_parroquia,
        contacto_telefono, contacto_domicilio,
        pareja_nombre, pareja_sexo, pareja_edad, pareja_fecha_nacimiento,
        hijos,
        salud_padece_enfermedad, salud_ayuda_psicologica, salud_ayuda_tiempo,
        salud_medicamentos, salud_medicamentos_cual,
        prediag_fecha,
        individual_prediag_impresion, individual_prediag_diagnostico,
        individual_prediag_areas, individual_prediag_tipo,
        individual_prediag_detonadores, individual_prediag_guia,
        par_eros, par_philia, par_agape, par_tipo_amor, par_estructura, par_conclusion,
        ac_apartados_visibles,
        ac_genograma_url, ac_genograma_interpretacion,
        ac_mcmaster_archivo1_url, ac_mcmaster_archivo2_url,
        ac_mcmaster_valores, ac_mcmaster_interpretacion,
        ac_foda_url, ac_foda_interpretacion,
        ac_conclusiones
      `)
      .eq('therapist_id', therapistId).eq('patient_id', patientId).maybeSingle(),
    supabase.from('therapist_patients')
      .select('initial_note_motivo, initial_note_subyacente')
      .eq('therapist_id', therapistId).eq('patient_id', patientId).single(),
    supabase.from('profiles').select('full_name').eq('id', therapistId).single(),
    supabase.from('profiles').select('email').eq('id', patientId).single(),
  ])

  const dg              = expedienteRes.data as Record<string, unknown> | null
  const nota            = notaRes.data
  const terapeutaNombre = terapeutaRes.data?.full_name ?? '—'
  const patientEmail    = patientRes.data?.email ?? ''
  const fechaHoy        = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  // ── Helpers ──────────────────────────────────────────────────
  function f(label: string, val: unknown, fallback = '—') {
    return `<div class="dg-field"><span class="label">${label}:</span> <span class="value">${val || fallback}</span></div>`
  }

  function fmtFecha(iso: string | null | undefined) {
    if (!iso) return '—'
    return new Date(String(iso) + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  function textBlock(content: string | null | undefined) {
    return content?.trim()
      ? `<div class="text-block">${content.trim().replace(/\n/g, '<br>')}</div>`
      : '<p class="empty">Sin registrar</p>'
  }

  // ── Hijos ────────────────────────────────────────────────────
  type HijoRow = { nombre: string; edad: string; ocupacion: string; vive_en_casa: string }
  const hijos: HijoRow[] = (dg?.hijos as HijoRow[]) ?? []
  const hijosConDatos = hijos.filter(h => h.nombre || h.edad || h.ocupacion || h.vive_en_casa)
  const hijosHTML = hijosConDatos.length > 0
    ? `<table class="table-data">
        <thead><tr><th>#</th><th>Nombre</th><th>Edad</th><th>Ocupación</th><th>¿Vive en casa?</th></tr></thead>
        <tbody>${hijosConDatos.map((h, i) =>
          `<tr><td>${i + 1}</td><td>${h.nombre || '—'}</td><td>${h.edad || '—'}</td><td>${h.ocupacion || '—'}</td><td>${h.vive_en_casa || '—'}</td></tr>`
        ).join('')}</tbody>
      </table>`
    : ''

  // ── McMaster ─────────────────────────────────────────────────
  const FACTORES_RV = [
    { id: 1, label: 'Involucramiento afectivo funcional',    vmin: 17, vmax: 85, invertido: false },
    { id: 2, label: 'Involucramiento afectivo disfuncional', vmin: 11, vmax: 55, invertido: true  },
    { id: 3, label: 'Patrones de comunicación disfuncional', vmin:  4, vmax: 20, invertido: true  },
    { id: 4, label: 'Patrones de comunicación funcional',    vmin:  3, vmax: 15, invertido: false },
    { id: 5, label: 'Resolución de problemas',               vmin:  3, vmax: 15, invertido: false },
    { id: 6, label: 'Patrones de control de conducta',       vmin:  2, vmax: 10, invertido: false },
  ]
  const rd1 = (n: number) => Math.round(n * 10) / 10
  function calcFactor(vdStr: string, vmin: number, vmax: number, invertido: boolean) {
    const vd = parseFloat(vdStr)
    if (isNaN(vd) || vd < vmin || vd > vmax) return null
    const base     = rd1((vd - vmin) / (vmax - vmin) * 100)
    const clamped  = Math.max(0, Math.min(100, base))
    const funcional = invertido ? rd1(100 - clamped) : clamped
    return { funcional, disfuncional: rd1(100 - funcional) }
  }

  const valores  = (dg?.ac_mcmaster_valores as Record<string, string> | null) ?? {}
  const mcRows   = FACTORES_RV.map(fac => ({
    ...fac,
    vd:  valores[`vd${fac.id}`] ?? '',
    res: valores[`vd${fac.id}`] ? calcFactor(valores[`vd${fac.id}`], fac.vmin, fac.vmax, fac.invertido) : null,
  }))
  const withRes  = mcRows.filter(r => r.res !== null)
  const rfAvg    = withRes.length > 0 ? rd1(withRes.reduce((s, r) => s + r.res!.funcional,    0) / withRes.length) : null
  const rdAvg    = withRes.length > 0 ? rd1(withRes.reduce((s, r) => s + r.res!.disfuncional, 0) / withRes.length) : null
  const effVal   = rfAvg !== null && rdAvg !== null ? rd1((rfAvg + rdAvg) / 2) : null
  const funcional = effVal !== null && effVal >= 60

  const mcTableHTML = withRes.length > 0
    ? `<p style="font-size:9pt;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.3pt;margin:6pt 0 4pt;">
        Evaluación de la Funcionalidad Familiar
      </p>
      <table class="mc-table">
        <thead>
          <tr>
            <th>Factor</th>
            <th class="num-col">VD</th>
            <th class="num-col">Funcional %</th>
            <th class="num-col">Disfuncional %</th>
          </tr>
        </thead>
        <tbody>
          ${mcRows.map(r => r.res ? `
          <tr>
            <td>Factor ${r.id}. ${r.label}</td>
            <td class="num-col">${r.vd}</td>
            <td class="num-col" style="color:#065f46;font-weight:600;">${r.res.funcional}%</td>
            <td class="num-col" style="color:#991b1b;font-weight:600;">${r.res.disfuncional}%</td>
          </tr>` : '').join('')}
        </tbody>
        <tfoot>
          <tr class="result-row">
            <td colspan="2" style="font-size:9pt;"><strong>Resultados por evaluación funcional</strong></td>
            <td class="num-col" style="color:#065f46;"><strong>${rfAvg}%</strong> <span style="font-size:8pt;color:#999;">RF</span></td>
            <td class="num-col" style="color:#991b1b;"><strong>${rdAvg}%</strong> <span style="font-size:8pt;color:#999;">RD</span></td>
          </tr>
          <tr class="result-row eff-row">
            <td colspan="2">
              <strong>Evaluación de la Funcionalidad Familiar</strong>
              <span style="font-size:8pt;font-weight:normal;color:#666;"> = (RF% + RD%) / 2</span>
            </td>
            <td colspan="2" class="num-col">
              <strong>${effVal}%</strong>
              <span class="eff-badge ${funcional ? 'eff-func' : 'eff-disfunc'}">
                ${funcional ? 'Funcional' : 'Disfuncional'}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>`
    : '<p class="empty">Sin datos McMaster registrados</p>'

  // ── Apartados activos ────────────────────────────────────────
  const visibles: string[] = (dg?.ac_apartados_visibles as string[] | null) ?? ['genograma', 'mcmaster', 'foda']

  function singleImg(url: string, alt: string, maxHeight = '360pt') {
    const isPdf = url.toLowerCase().includes('.pdf') || url.includes('application/pdf')
    if (isPdf) {
      return `<iframe src="${url}" style="width:100%;height:${maxHeight};border:0.5pt solid #c8d0e8;border-radius:4pt;margin:6pt 0;" title="${alt}"></iframe>`
    }
    return `<img src="${url}" alt="${alt}" style="width:100%;max-height:${maxHeight};object-fit:contain;border:0.5pt solid #c8d0e8;border-radius:4pt;margin:6pt 0;display:block;" />`
  }

  function apartadoImg(url: string | null | undefined, alt: string) {
    if (!url) return ''
    return singleImg(url, alt)
  }

  // Helper: renderiza imagen o PDF con max-height (para McMaster)
  function mkMcImg(url: string, alt: string, maxH: string) {
    const isPdf = url.toLowerCase().includes('.pdf') || url.includes('application/pdf')
    if (isPdf) {
      return `<iframe src="${url}" style="width:100%;height:${maxH};border:0.5pt solid #c8d0e8;border-radius:4pt;display:block;margin:6pt 0;" title="${alt}"></iframe>`
    }
    return `<img src="${url}" alt="${alt}" style="width:100%;max-height:${maxH};height:auto;object-fit:contain;display:block;border:0.5pt solid #c8d0e8;border-radius:4pt;margin:6pt 0;" />`
  }

  const analisisHTML = visibles.map((id, idx) => {
    const num = idx + 1
    if (id === 'genograma') {
      return `
      <div class="apartado-block">
        <div class="apartado-title">${num}. Genograma</div>
        ${(dg?.ac_genograma_interpretacion as string)?.trim() ? `
        <div class="interp-label">Interpretación clínica:</div>
        ${textBlock(dg?.ac_genograma_interpretacion as string)}` : '<p class="empty">Sin interpretación registrada.</p>'}
      </div>`
    }
    if (id === 'mcmaster') {
      const interpMc = (dg?.ac_mcmaster_interpretacion as string)?.trim()
      return `
      <div class="apartado-block">
        <div class="apartado-title">${num}. Análisis McMaster</div>
        ${mcTableHTML}
        ${interpMc ? `
        <div class="interp-label">Interpretación clínica:</div>
        ${textBlock(interpMc)}` : ''}
      </div>`
    }
    if (id === 'foda') {
      return `
      <div class="apartado-block">
        <div class="apartado-title">${num}. Análisis FODA</div>
        ${(dg?.ac_foda_interpretacion as string)?.trim() ? `
        <div class="interp-label">Interpretación clínica:</div>
        ${textBlock(dg?.ac_foda_interpretacion as string)}` : '<p class="empty">Sin interpretación registrada.</p>'}
      </div>`
    }
    return ''
  }).join('')

  // ── Prediagnóstico / Sección Pareja ─────────────────────────
  const prediagFecha = dg?.prediag_fecha
    ? fmtFecha(dg.prediag_fecha as string)
    : ''

  const tipoCasoRV = (dg?.tipo_caso as string) ?? ''

  // Helper: convert jsonb array to comma-separated string
  function toStrArr(v: unknown): string {
    return Array.isArray(v) ? (v as string[]).join(', ') : ''
  }

  const prediagHTML = tipoCasoRV === 'Pareja'
    ? (() => {
        const erosStr   = toStrArr(dg?.par_eros)
        const philiaStr = toStrArr(dg?.par_philia)
        const agapeStr  = toStrArr(dg?.par_agape)
        const parejaItems = [
          { label: 'Áreas EROS (pasión / atracción)',          val: erosStr   || null },
          { label: 'Áreas PHILIA (amistad / compañerismo)',    val: philiaStr || null },
          { label: 'Áreas ÁGAPE (amor incondicional)',         val: agapeStr  || null },
          { label: 'Tipo de amor predominante',                val: dg?.par_tipo_amor   },
          { label: 'Estructura de la pareja',                  val: dg?.par_estructura  },
        ]
        const itemsHTML = parejaItems.map(item => `
          <div class="prediag-item">
            <span class="prediag-label">${item.label}:</span>
            ${item.val
              ? `<div class="prediag-text">${String(item.val)}</div>`
              : '<div class="prediag-empty">—</div>'
            }
          </div>`).join('')
        const conclusionHTML = dg?.par_conclusion
          ? `<div class="prediag-item">
               <span class="prediag-label">Conclusión clínica:</span>
               <div class="prediag-text">${String(dg.par_conclusion).replace(/\n/g, '<br>')}</div>
             </div>`
          : ''
        return itemsHTML + conclusionHTML
      })()
    : [
        { label: 'Impresión del sujeto de evaluación',         val: dg?.individual_prediag_impresion   },
        { label: 'Diagnóstico presuntivo',                      val: dg?.individual_prediag_diagnostico },
        { label: 'Áreas de conflicto (áreas afectadas)',       val: dg?.individual_prediag_areas       },
        { label: 'Tipo de problema',                            val: dg?.individual_prediag_tipo        },
        { label: 'Detonadores',                                 val: dg?.individual_prediag_detonadores },
        { label: 'Guía de acción o trabajo',                   val: dg?.individual_prediag_guia        },
      ].map(item => `
        <div class="prediag-item">
          <span class="prediag-label">${item.label}:</span>
          ${item.val
            ? `<div class="prediag-text">${String(item.val)}</div>`
            : '<div class="prediag-empty">—</div>'
          }
        </div>`).join('')

  // ── HTML final ───────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte Valorativo — ${patientName ?? 'Paciente'}</title>
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
    .text-block { font-size: 10pt; line-height: 1.65; color: #1a1a1a; white-space: pre-wrap; }
    .prediag-item { margin-bottom: 8pt; }
    .prediag-label { font-weight: bold; font-size: 10pt; color: #2d3a8c; display: block; margin-bottom: 2pt; }
    .prediag-text  { font-size: 10pt; color: #1a1a1a; padding-left: 8pt; font-style: italic; }
    .prediag-empty { font-size: 9.5pt; color: #999; padding-left: 8pt; font-style: italic; }
    .apartado-block { margin-bottom: 20pt; }
    .apartado-title { font-size: 11pt; font-weight: bold; color: #2d3a8c; margin-bottom: 8pt; border-bottom: 0.5pt solid #b0bbd4; padding-bottom: 4pt; }
    .interp-label { font-size: 9pt; font-weight: bold; color: #555; text-transform: uppercase; letter-spacing: 0.3pt; margin-top: 8pt; margin-bottom: 3pt; }
    .mc-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 6pt 0 10pt; }
    .mc-table th { background: #eef1f8; font-weight: bold; padding: 5pt 8pt; text-align: left; border: 0.5pt solid #c5cfe0; font-size: 9pt; }
    .mc-table td { padding: 4pt 8pt; border: 0.5pt solid #dde3ee; }
    .mc-table .num-col { text-align: center; }
    .mc-table tfoot .result-row td { background: #f4f6fb; font-size: 9.5pt; }
    .mc-table tfoot .eff-row td { background: #e8f0fe; }
    .eff-badge { display: inline-block; margin-left: 8pt; padding: 1pt 8pt; border-radius: 20pt; font-size: 8.5pt; font-weight: bold; }
    .eff-func    { background: #d1fae5; color: #065f46; }
    .eff-disfunc { background: #fee2e2; color: #991b1b; }
    /* Impresión continua — sin saltos ni páginas en blanco */
    .section, .section-break-before, .apartado-block, .firma-section {
      page-break-before: auto !important; break-before: auto !important;
      page-break-inside: auto !important; break-inside: auto !important;
    }
  </style>
</head>
<body>

  <div class="no-print" style="text-align:right;padding:10pt 0 14pt;">
    <button onclick="window.print()" style="padding:8pt 18pt;background:#2d3a8c;color:white;border:none;border-radius:8pt;font-size:10pt;cursor:pointer;">
      🖨 Imprimir / Guardar PDF
    </button>
  </div>

  ${buildReportHeader({ terapeutaNombre, logoUrl: headerOpts?.logoUrl ?? null, side: headerOpts?.side ?? 'name', subtitle: 'Reporte Valorativo' })}

  <!-- Pre-header -->
  <div class="pre-header">
    <div class="pre-header-row">
      <span><strong>Asesorado:</strong> ${patientName ?? '—'}</span>
      <span><strong>Asesor/Terapeuta:</strong> ${terapeutaNombre}</span>
    </div>
    <div class="pre-header-row">
      <span><strong>Tipo de caso:</strong> ${(dg?.tipo_caso as string) || '—'}</span>
      <span><strong>Correo:</strong> ${patientEmail || '—'}</span>
    </div>
  </div>

  <!-- Título -->
  <div class="header">
    <h1>Reporte Valorativo</h1>
    <div class="subtitle">Consultoría Fuentes</div>
  </div>

  <!-- Meta -->
  <div class="meta">
    <div><strong>Consultante:</strong> ${patientName ?? '—'}</div>
    <div><strong>Fecha de elaboración:</strong> ${fechaHoy}</div>
  </div>

  <!-- I. DATOS GENERALES -->
  <div class="section">
    <div class="section-title"><span class="num">I.</span> Datos Generales</div>

    <div class="subsection-title">Datos del Asesorado</div>
    <div class="dg-grid">
      ${f('Nombre',             dg?.asesorado_nombre)}
      ${f('Sexo',               dg?.asesorado_sexo)}
      ${f('Edad',               dg?.asesorado_edad)}
      ${f('Fecha de nacimiento', fmtFecha(dg?.asesorado_fecha_nacimiento as string))}
      ${f('Lugar de nacimiento', dg?.asesorado_lugar_nacimiento)}
      ${f('Estado civil',        dg?.asesorado_estado_civil)}
      ${f('Escolaridad',         dg?.asesorado_escolaridad)}
      ${f('Ocupación',           dg?.asesorado_ocupacion)}
      ${f('Religión',            dg?.asesorado_religion)}
      ${f('Parroquia',           dg?.asesorado_parroquia)}
    </div>

    ${dg?.pareja_nombre || dg?.pareja_edad ? `
    <div class="subsection-title">Datos de la Pareja</div>
    <div class="dg-grid">
      ${f('Nombre',             dg?.pareja_nombre)}
      ${f('Sexo',               dg?.pareja_sexo)}
      ${f('Edad',               dg?.pareja_edad)}
      ${f('Fecha de nacimiento', fmtFecha(dg?.pareja_fecha_nacimiento as string))}
    </div>` : ''}

    ${hijosConDatos.length > 0 ? `
    <div class="subsection-title">Hijos</div>
    ${hijosHTML}` : ''}

  </div>

  <!-- II. PREDIAGNÓSTICO / PAREJA -->
  <div class="section">
    <div class="section-title">
      <span class="num">II.</span> ${tipoCasoRV === 'Pareja' ? 'Sección Pareja' : 'Prediagnóstico'}
      ${prediagFecha && tipoCasoRV !== 'Pareja' ? `<span style="font-size:9pt;font-weight:normal;color:#555;margin-left:8pt;">(${prediagFecha})</span>` : ''}
    </div>
    ${prediagHTML}
  </div>

  <!-- III. MOTIVO DE CONSULTA -->
  <div class="section">
    <div class="section-title"><span class="num">III.</span> Motivo de Consulta</div>

    <div class="subsection-title" style="margin-top:0;">Motivo de consulta del paciente</div>
    ${textBlock(nota?.initial_note_motivo)}

    <div class="subsection-title" style="margin-top:10pt;">Motivo de consulta subyacente</div>
    ${textBlock(nota?.initial_note_subyacente)}
  </div>

  <!-- IV. ANÁLISIS CLÍNICOS -->
  <div class="section">
    <div class="section-title"><span class="num">IV.</span> Análisis Clínicos</div>
    ${visibles.length === 0
      ? '<p class="empty">No hay análisis activos en el índice de Análisis Clínicos.</p>'
      : analisisHTML
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

  printHtmlViaIframe(html)
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
  isOriginal = false,
  headerOpts?: Partial<ReportHeaderOptions>,
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

  ${buildReportHeader({ terapeutaNombre, logoUrl: headerOpts?.logoUrl ?? null, side: headerOpts?.side ?? 'name', subtitle: 'Historia Clínica' })}

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
    ${isOriginal ? `<div class="badge-original">★ VERSIÓN ORIGINAL AVI — generada automáticamente</div>` : ''}
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

  printHtmlViaIframe(html)
}

// ──────────────────────────────────────────────────────────
// Reporte de Proceso
// ──────────────────────────────────────────────────────────

export async function imprimirReporteProceso(
  patientId:   string,
  therapistId: string,
  patientName: string | null,
  headerOpts?: Partial<ReportHeaderOptions>,
) {
  const supabase = createClient()

  // Fetch de datos en paralelo
  const [expedienteRes, notaRes, terapeutaRes, patientRes, subsecuenteRes] = await Promise.all([
    supabase.from('patient_expediente')
      .select(`
        tipo_caso,
        asesorado_nombre, asesorado_sexo, asesorado_edad,
        asesorado_fecha_nacimiento, asesorado_lugar_nacimiento, asesorado_estado_civil,
        asesorado_escolaridad, asesorado_ocupacion, asesorado_religion, asesorado_parroquia,
        pareja_nombre, pareja_sexo, pareja_edad, pareja_fecha_nacimiento,
        hijos,
        individual_prediag_diagnostico,
        ac_informacion_interes,
        ac_proceso_psicologico
      `)
      .eq('therapist_id', therapistId).eq('patient_id', patientId).maybeSingle(),
    supabase.from('therapist_patients')
      .select('initial_note_subyacente')
      .eq('therapist_id', therapistId).eq('patient_id', patientId).single(),
    supabase.from('profiles').select('full_name').eq('id', therapistId).single(),
    supabase.from('profiles').select('email').eq('id', patientId).single(),
    // Llamada a la IA para el resumen subsecuente
    fetch('/api/analisis-clinicos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'proceso_subsecuente', patientId }),
    }).then(r => r.json()).catch(() => ({ subsecuente: '' })),
  ])

  const dg              = expedienteRes.data as Record<string, unknown> | null
  const nota            = notaRes.data
  const terapeutaNombre = terapeutaRes.data?.full_name ?? '—'
  const patientEmail    = patientRes.data?.email ?? ''
  const fechaHoy        = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  const subsecuente     = (subsecuenteRes as Record<string, string>).subsecuente ?? ''

  // ── Helpers ──────────────────────────────────────────────
  function f(label: string, val: unknown, fallback = '—') {
    return `<div class="dg-field"><span class="label">${label}:</span> <span class="value">${val || fallback}</span></div>`
  }
  function fmtFecha(iso: string | null | undefined) {
    if (!iso) return '—'
    return new Date(String(iso) + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  function textBlock(content: string | null | undefined) {
    return content?.trim()
      ? `<div class="text-block">${content.trim().replace(/\n/g, '<br>')}</div>`
      : '<p class="empty">Sin registrar</p>'
  }
  function sectionBlock(num: string, title: string, body: string) {
    return `
      <div class="section">
        <div class="section-title"><span class="num">${num}.</span> ${title}</div>
        ${body}
      </div>`
  }

  // ── Hijos ──────────────────────────────────────────────
  type HijoRow = { nombre: string; edad: string; ocupacion: string; vive_en_casa: string }
  const hijos: HijoRow[] = (dg?.hijos as HijoRow[]) ?? []
  const hijosConDatos = hijos.filter(h => h.nombre || h.edad || h.ocupacion || h.vive_en_casa)
  const hijosHTML = hijosConDatos.length > 0
    ? `<table class="table-data">
        <thead><tr><th>#</th><th>Nombre</th><th>Edad</th><th>Ocupación</th><th>¿Vive en casa?</th></tr></thead>
        <tbody>${hijosConDatos.map((h, i) =>
          `<tr><td>${i + 1}</td><td>${h.nombre || '—'}</td><td>${h.edad || '—'}</td><td>${h.ocupacion || '—'}</td><td>${h.vive_en_casa || '—'}</td></tr>`
        ).join('')}</tbody>
      </table>`
    : ''

  // ── Motivos de consulta inicial (subyacente + diagnóstico presuntivo sin títulos) ──
  const motivoInicial = [
    nota?.initial_note_subyacente?.trim(),
    (dg?.individual_prediag_diagnostico as string)?.trim(),
  ].filter(Boolean).join('\n\n')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de Proceso — ${patientName ?? 'Paciente'}</title>
  <style>
    ${sharedCSS()}
    /* Flujo continuo sin huecos */
    .section, .section-break-before {
      page-break-inside: auto !important;
      break-inside: auto !important;
      page-break-before: auto !important;
      break-before: auto !important;
      margin-bottom: 8pt !important;
    }
    .dg-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 3pt 14pt; margin-bottom: 6pt; }
    .dg-field { font-size: 10pt; margin-bottom: 2pt; }
    .label    { font-weight: bold; color: #333; }
    .value    { color: #1a1a1a; }
    .subsection-title {
      font-size: 9.5pt; font-weight: bold; color: #444;
      text-decoration: underline; text-underline-offset: 2pt; margin: 8pt 0 4pt;
    }
    .table-data { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 4pt; }
    .table-data th { background: #eef1f8; font-weight: bold; padding: 4pt 6pt; text-align: left; border: 0.5pt solid #c5cfe0; font-size: 9pt; }
    .table-data td { padding: 3pt 6pt; border: 0.5pt solid #dde3ee; }
    .text-block { font-size: 10pt; line-height: 1.6; white-space: pre-wrap; }
    .proceso-content { font-size: 10pt; line-height: 1.6; }
    .proceso-content .md-h  { font-size: 10pt; font-weight: bold; color: #2d3a8c; margin: 8pt 0 3pt; }
    .proceso-content .md-p  { margin: 2pt 0; }
    .proceso-content strong { font-weight: bold; }
    .md-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 6pt 0; }
    .md-table th { background: #eef1f8; font-weight: bold; padding: 4pt 6pt; text-align: left; border: 0.5pt solid #c5cfe0; }
    .md-table td { padding: 3pt 6pt; border: 0.5pt solid #dde3ee; vertical-align: top; }
  </style>
</head>
<body>

  <div class="no-print" style="text-align:right;padding:10pt 0 14pt;">
    <button onclick="window.print()" style="padding:8pt 18pt;background:#2d3a8c;color:white;border:none;border-radius:8pt;font-size:10pt;cursor:pointer;">
      🖨 Imprimir / Guardar PDF
    </button>
  </div>

  ${buildReportHeader({ terapeutaNombre, logoUrl: headerOpts?.logoUrl ?? null, side: headerOpts?.side ?? 'name', subtitle: 'Reporte de Proceso' })}

  <div class="pre-header">
    <div class="pre-header-row">
      <span><strong>Asesorado:</strong> ${patientName ?? '—'}</span>
      <span><strong>Asesor/Terapeuta:</strong> ${terapeutaNombre}</span>
    </div>
    <div class="pre-header-row">
      <span><strong>Tipo de caso:</strong> ${(dg?.tipo_caso as string) || '—'}</span>
      <span><strong>Correo:</strong> ${patientEmail || '—'}</span>
    </div>
  </div>

  <div class="header">
    <h1>Reporte de Proceso</h1>
    <div class="subtitle">Consultoría Fuentes</div>
  </div>

  <div class="meta">
    <div><strong>Consultante:</strong> ${patientName ?? '—'}</div>
    <div><strong>Fecha de elaboración:</strong> ${fechaHoy}</div>
  </div>

  ${sectionBlock('I', 'Datos Generales', `
    <div class="subsection-title">Datos del Asesorado</div>
    <div class="dg-grid">
      ${f('Nombre',              dg?.asesorado_nombre)}
      ${f('Sexo',                dg?.asesorado_sexo)}
      ${f('Edad',                dg?.asesorado_edad)}
      ${f('Fecha de nacimiento', fmtFecha(dg?.asesorado_fecha_nacimiento as string))}
      ${f('Lugar de nacimiento', dg?.asesorado_lugar_nacimiento)}
      ${f('Estado civil',        dg?.asesorado_estado_civil)}
      ${f('Escolaridad',         dg?.asesorado_escolaridad)}
      ${f('Ocupación',           dg?.asesorado_ocupacion)}
      ${f('Religión',            dg?.asesorado_religion)}
      ${f('Parroquia',           dg?.asesorado_parroquia)}
    </div>
    ${(dg?.pareja_nombre || dg?.pareja_edad) ? `
    <div class="subsection-title">Datos de la Pareja</div>
    <div class="dg-grid">
      ${f('Nombre',              dg?.pareja_nombre)}
      ${f('Sexo',                dg?.pareja_sexo)}
      ${f('Edad',                dg?.pareja_edad)}
      ${f('Fecha de nacimiento', fmtFecha(dg?.pareja_fecha_nacimiento as string))}
    </div>` : ''}
    ${hijosConDatos.length > 0 ? `
    <div class="subsection-title">Datos de los Hijos</div>
    ${hijosHTML}` : ''}
  `)}

  ${sectionBlock('II', 'Motivos de Consulta Inicial',
    textBlock(motivoInicial))}

  ${sectionBlock('III', 'Motivos de Consulta Subsecuente',
    textBlock(subsecuente))}

  ${sectionBlock('IV', 'Información de Interés',
    textBlock(dg?.ac_informacion_interes as string))}

  ${sectionBlock('V', 'Información del Proceso Psicológico',
    (dg?.ac_proceso_psicologico as string)?.trim()
      ? `<div class="proceso-content">${markdown2html(dg?.ac_proceso_psicologico as string)}</div>`
      : '<p class="empty">Sin registrar</p>'
  )}

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

  printHtmlViaIframe(html)
}

// ──────────────────────────────────────────────────────────
// Integración y plan de tratamiento
// ──────────────────────────────────────────────────────────

export async function imprimirIntegracionPlan(
  patientId:   string,
  therapistId: string,
  patientName: string | null,
  headerOpts?: Partial<ReportHeaderOptions>,
) {
  const supabase = createClient()

  const [expedienteRes, notaRes, terapeutaRes, patientRes, analysesRes] = await Promise.all([
    supabase.from('patient_expediente')
      .select(`
        tipo_caso,
        asesorado_nombre, asesorado_sexo, asesorado_edad,
        asesorado_fecha_nacimiento, asesorado_lugar_nacimiento, asesorado_estado_civil,
        asesorado_escolaridad, asesorado_ocupacion, asesorado_religion, asesorado_parroquia,
        pareja_nombre, pareja_sexo, pareja_edad, pareja_fecha_nacimiento,
        hijos,
        ac_diagnostico_integrado,
        ac_conclusiones,
        individual_vias_accion
      `)
      .eq('therapist_id', therapistId).eq('patient_id', patientId).maybeSingle(),
    supabase.from('therapist_patients')
      .select('initial_note_date, initial_note_motivo, initial_note_subyacente')
      .eq('therapist_id', therapistId).eq('patient_id', patientId).single(),
    supabase.from('profiles').select('full_name').eq('id', therapistId).single(),
    supabase.from('profiles').select('email').eq('id', patientId).single(),
    supabase.from('analyses')
      .select('content, created_at')
      .eq('therapist_id', therapistId).eq('patient_id', patientId)
      .order('created_at', { ascending: true }),
  ])

  const dg              = expedienteRes.data as Record<string, unknown> | null
  const nota            = notaRes.data
  const terapeutaNombre = terapeutaRes.data?.full_name ?? '—'
  const patientEmail    = patientRes.data?.email ?? ''
  const fechaHoy        = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  const analyses        = analysesRes.data ?? []

  // ── Extraer sección de analyses.content ──────────────────
  function extractSection(content: string, marker: string): string {
    const idx = content.indexOf(marker)
    if (idx === -1) return ''
    const after = content.slice(idx + marker.length)
    const nextSection = after.search(/\n\*\*[A-ZÁÉÍÓÚÜÑ]/)
    return (nextSection === -1 ? after : after.slice(0, nextSection)).trim()
  }

  // Análisis más reciente → Problemática principal
  const latestAnalysis    = analyses.length > 0 ? analyses[analyses.length - 1] : null
  const problematica      = latestAnalysis ? extractSection(latestAnalysis.content, '**PROBLEMÁTICA PRINCIPAL**') : ''

  // Primer análisis con fecha >= initial_note_date → Propuesta técnica + Apegos
  const initialDate = nota?.initial_note_date ? new Date(nota.initial_note_date + 'T00:00:00') : null
  const firstAnalysis = initialDate
    ? analyses.find(a => new Date(a.created_at) >= initialDate) ?? analyses[0] ?? null
    : analyses[0] ?? null
  const propuestaTecnica  = firstAnalysis ? extractSection(firstAnalysis.content, '**PROPUESTA TÉCNICA**') : ''
  const apegosHeridas     = firstAnalysis ? extractSection(firstAnalysis.content, '**ANÁLISIS DE APEGOS Y HERIDAS**') : ''

  // ── Helpers ──────────────────────────────────────────────
  function f(label: string, val: unknown, fallback = '—') {
    return `<div class="dg-field"><span class="label">${label}:</span> <span class="value">${val || fallback}</span></div>`
  }
  function fmtFecha(iso: string | null | undefined) {
    if (!iso) return '—'
    return new Date(String(iso) + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  function textBlock(content: string | null | undefined) {
    return content?.trim()
      ? `<div class="text-block">${content.trim().replace(/\n/g, '<br>')}</div>`
      : '<p class="empty">Sin registrar</p>'
  }
  function sectionBlock(num: string, title: string, body: string) {
    return `
      <div class="section">
        <div class="section-title"><span class="num">${num}.</span> ${title}</div>
        ${body}
      </div>`
  }

  // ── Hijos ─────────────────────────────────────────────────
  type HijoRow = { nombre: string; edad: string; ocupacion: string; vive_en_casa: string }
  const hijos: HijoRow[] = (dg?.hijos as HijoRow[]) ?? []
  const hijosConDatos = hijos.filter(h => h.nombre || h.edad || h.ocupacion || h.vive_en_casa)
  const hijosHTML = hijosConDatos.length > 0
    ? `<table class="table-data">
        <thead><tr><th>#</th><th>Nombre</th><th>Edad</th><th>Ocupación</th><th>¿Vive en casa?</th></tr></thead>
        <tbody>${hijosConDatos.map((h, i) =>
          `<tr><td>${i + 1}</td><td>${h.nombre || '—'}</td><td>${h.edad || '—'}</td><td>${h.ocupacion || '—'}</td><td>${h.vive_en_casa || '—'}</td></tr>`
        ).join('')}</tbody>
      </table>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Integración y Plan de Intervención — ${patientName ?? 'Paciente'}</title>
  <style>
    ${sharedCSS()}
    /* Flujo continuo: sin saltos ni huecos entre secciones */
    .section, .section-break-before {
      page-break-inside: auto !important;
      break-inside: auto !important;
      page-break-before: auto !important;
      break-before: auto !important;
      margin-bottom: 8pt !important;
    }
    .dg-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 3pt 14pt; margin-bottom: 6pt; }
    .dg-field { font-size: 10pt; margin-bottom: 2pt; }
    .label    { font-weight: bold; color: #333; }
    .value    { color: #1a1a1a; }
    .subsection-title {
      font-size: 9.5pt; font-weight: bold; color: #444;
      text-decoration: underline; text-underline-offset: 2pt; margin: 8pt 0 4pt;
    }
    .subsection-label {
      font-size: 9.5pt; font-weight: bold; color: #2d3a8c; margin: 8pt 0 3pt;
    }
    .table-data { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 4pt; }
    .table-data th { background: #eef1f8; font-weight: bold; padding: 4pt 6pt; text-align: left; border: 0.5pt solid #c5cfe0; font-size: 9pt; }
    .table-data td { padding: 3pt 6pt; border: 0.5pt solid #dde3ee; }
    .text-block { font-size: 10pt; line-height: 1.6; white-space: pre-wrap; }
    .vias-content { font-size: 9.5pt; line-height: 1.65; white-space: pre-wrap; }
  </style>
</head>
<body>

  <div class="no-print" style="text-align:right;padding:10pt 0 14pt;">
    <button onclick="window.print()" style="padding:8pt 18pt;background:#2d3a8c;color:white;border:none;border-radius:8pt;font-size:10pt;cursor:pointer;">
      🖨 Imprimir / Guardar PDF
    </button>
  </div>

  ${buildReportHeader({ terapeutaNombre, logoUrl: headerOpts?.logoUrl ?? null, side: headerOpts?.side ?? 'name', subtitle: 'Integración y Plan de Intervención' })}

  <div class="pre-header">
    <div class="pre-header-row">
      <span><strong>Asesorado:</strong> ${patientName ?? '—'}</span>
      <span><strong>Asesor/Terapeuta:</strong> ${terapeutaNombre}</span>
    </div>
    <div class="pre-header-row">
      <span><strong>Tipo de caso:</strong> ${(dg?.tipo_caso as string) || '—'}</span>
      <span><strong>Correo:</strong> ${patientEmail || '—'}</span>
    </div>
  </div>

  <div class="header">
    <h1>Integración y Plan de Intervención</h1>
    <div class="subtitle">Consultoría Fuentes</div>
  </div>

  <div class="meta">
    <div><strong>Consultante:</strong> ${patientName ?? '—'}</div>
    <div><strong>Fecha de elaboración:</strong> ${fechaHoy}</div>
  </div>

  ${sectionBlock('I', 'Datos Generales', `
    <div class="subsection-title">Datos del Asesorado</div>
    <div class="dg-grid">
      ${f('Nombre',              dg?.asesorado_nombre)}
      ${f('Sexo',                dg?.asesorado_sexo)}
      ${f('Edad',                dg?.asesorado_edad)}
      ${f('Fecha de nacimiento', fmtFecha(dg?.asesorado_fecha_nacimiento as string))}
      ${f('Lugar de nacimiento', dg?.asesorado_lugar_nacimiento)}
      ${f('Estado civil',        dg?.asesorado_estado_civil)}
      ${f('Escolaridad',         dg?.asesorado_escolaridad)}
      ${f('Ocupación',           dg?.asesorado_ocupacion)}
      ${f('Religión',            dg?.asesorado_religion)}
      ${f('Parroquia',           dg?.asesorado_parroquia)}
    </div>
    ${(dg?.pareja_nombre || dg?.pareja_edad) ? `
    <div class="subsection-title">Datos de la Pareja</div>
    <div class="dg-grid">
      ${f('Nombre',              dg?.pareja_nombre)}
      ${f('Sexo',                dg?.pareja_sexo)}
      ${f('Edad',                dg?.pareja_edad)}
      ${f('Fecha de nacimiento', fmtFecha(dg?.pareja_fecha_nacimiento as string))}
    </div>` : ''}
    ${hijosConDatos.length > 0 ? `
    <div class="subsection-title">Datos de los Hijos</div>
    ${hijosHTML}` : ''}
  `)}

  ${sectionBlock('II', 'Motivos de Consulta del Paciente',
    textBlock(nota?.initial_note_motivo))}

  ${sectionBlock('III', 'Motivos de Consulta Subyacente',
    textBlock(nota?.initial_note_subyacente))}

  ${sectionBlock('IV', 'Sintomatología y Diagnóstico Integrado', `
    <div class="subsection-label">Sintomatología</div>
    ${textBlock(problematica)}
    <div class="subsection-label">Diagnóstico integrado</div>
    ${textBlock(dg?.ac_diagnostico_integrado as string)}
  `)}

  ${sectionBlock('V', 'Resultados Generales del Proceso de Evaluación',
    textBlock(dg?.ac_conclusiones as string))}

  ${sectionBlock('VI', 'Modelo de Abordaje Sugerido',
    textBlock(propuestaTecnica))}

  ${sectionBlock('VII', 'Traumas u Otras Afecciones por Considerar',
    textBlock(apegosHeridas))}

  ${sectionBlock('VIII', 'Objetivos de Trabajo',
    (dg?.individual_vias_accion as string)?.trim()
      ? `<div class="vias-content">${vias2html(dg?.individual_vias_accion as string)}</div>`
      : '<p class="empty">Sin registrar</p>'
  )}

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

  printHtmlViaIframe(html)
}

// ──────────────────────────────────────────────────────────
// buildReportHeader — encabezado compartido para todos los
// reportes terapéuticos (Sprint 10 — Cambio XII)
// ──────────────────────────────────────────────────────────

export interface ReportHeaderOptions {
  terapeutaNombre: string
  /** URL pública del logo de la empresa CONVENIO. Si no hay, muestra el nombre. */
  logoUrl?: string | null
  /** Qué mostrar a la derecha: logo de empresa o nombre del terapeuta */
  side?: 'logo' | 'name'
  /** Subtítulo del reporte (aparece bajo "AVI Therapy Companion") */
  subtitle?: string
}

/**
 * Genera el HTML del encabezado compartido de todos los reportes:
 * 1. Línea meta fina: fecha + "Reporte impreso por" (izq) / nombre o logo empresa (der)
 * 2. Bloque AVI: cuadro "AVI" + "AVI Therapy Companion" + subtítulo (izq) / Terapeuta (der)
 */
export function buildReportHeader(opts: ReportHeaderOptions): string {
  const { terapeutaNombre, logoUrl, side = 'name', subtitle } = opts

  const date = new Date().toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const rightContent =
    side === 'logo' && logoUrl
      ? `<img src="${logoUrl}" alt="Logo empresa" style="height:48px;max-width:140px;object-fit:contain;" />`
      : `<span style="font-size:10pt;font-weight:600;color:#444;">${terapeutaNombre}</span>`

  return `
    <!-- línea meta fina -->
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:4px;">
      <div>
        <div style="font-size:9pt;color:#777;">${date}</div>
        <div style="font-size:8.5pt;color:#888;">Reporte impreso por: <strong>${terapeutaNombre}</strong></div>
      </div>
      <div style="display:flex;align-items:center;">${rightContent}</div>
    </div>
    <!-- bloque AVI brand -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1.5pt solid #2d3a8c;padding-bottom:4pt;margin-bottom:0;">
      <div style="display:flex;align-items:center;gap:5pt;">
        <div style="width:22pt;height:22pt;border-radius:4pt;background:#c026d3;color:#fff;font-size:7pt;font-weight:bold;letter-spacing:0.5pt;display:flex;align-items:center;justify-content:center;">AVI</div>
        <div>
          <div style="font-size:11pt;font-weight:bold;color:#c026d3;">AVI Therapy Companion</div>
          ${subtitle ? `<div style="font-size:7.5pt;color:#666;margin-top:0.5pt;">${subtitle}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right;font-size:7.5pt;color:#555;line-height:1.6;">
        <div><strong>Terapeuta:</strong> ${terapeutaNombre}</div>
      </div>
    </div>
    <!-- separador post-header -->
    <div style="height:10px;"></div>
  `
}

// ──────────────────────────────────────────────────────────
// Funciones wrapper para /therapist/reportes
// Cargan los datos automáticamente a partir del patientId
// Sprint 10 (Cambio XII) — E5
// ──────────────────────────────────────────────────────────

/** Carga Nota Inicial y la imprime sin necesitar datos pre-cargados. */
export async function imprimirNotaInicialDesdeReportes(patientId: string, headerOpts?: Partial<ReportHeaderOptions>) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const [{ data: rel }, { data: profile }, { data: expediente }] = await Promise.all([
    supabase
      .from('therapist_patients')
      .select(`
        initial_note, initial_note_date, initial_note_motivo,
        initial_note_subyacente, initial_note_premisas,
        initial_note_pro_bono, initial_note_virtual,
        frecuencia_config, sensacion_paciente_inicial,
        factores_riesgo_sel, factores_proteccion_sel,
        factores_riesgo_trec, factores_proteccion_trec,
        factores_riesgo_tcc, factores_proteccion_tcc
      `)
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
      .single(),
    supabase.from('profiles').select('full_name').eq('id', patientId).single(),
    supabase
      .from('patient_expediente')
      .select('tipo_caso')
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
      .maybeSingle(),
  ])

  if (!rel) { alert('No se encontró la Nota Inicial de este paciente.'); return }

  // ── Resolver tipo de caso ─────────────────────────────────────────────────
  const tipoCasoStr = (expediente?.tipo_caso as string | null) ?? ''
  const caseType: 'individual' | 'familiar' | 'pareja' =
    tipoCasoStr.toLowerCase().includes('pareja') ? 'pareja' :
    tipoCasoStr.toLowerCase().includes('famil')  ? 'familiar' : 'individual'

  const CASE_LABEL: Record<typeof caseType, string> = {
    individual: 'Individual',
    familiar:   'Familiar',
    pareja:     'Pareja',
  }

  // ── Construir HTML de factores por esquema ────────────────────────────────
  // Cada columna en BD es { individual: string[], familiar: string[], pareja: string[] }.
  // Extraemos sólo los keys del tipo de caso del paciente y mostramos factores activos.
  function buildFactoresHtml(tipo: 'riesgo' | 'proteccion'): string {
    const colMap = tipo === 'riesgo' ? SCHEMA_RIESGO_COL : SCHEMA_PROTECCION_COL
    const parts: string[] = []
    for (const schema of ['famsis', 'trec', 'cc'] as const) {
      const col    = colMap[schema]
      const rawObj = (rel as Record<string, unknown>)[col]
      // El jsonb guardado es { individual: [], familiar: [], pareja: [] }
      const obj: Record<string, string[]> =
        rawObj && typeof rawObj === 'object' && !Array.isArray(rawObj)
          ? (rawObj as Record<string, string[]>)
          : {}
      const keys: string[] = obj[caseType] ?? []
      if (!keys.length) continue
      const items = resolveFactores(schema, caseType, tipo, keys)
      if (!items.length) continue
      parts.push(
        `<div class="factor-schema">${SCHEMA_LABELS[schema]}</div>` +
        `<ul class="factor-list">${items.map(f => `<li>${f.titulo}</li>`).join('')}</ul>`
      )
    }
    if (!parts.length) return ''
    // Encabezado: Tipo de caso
    const header =
      `<div style="font-size:9pt;color:#555;margin-bottom:6pt;">` +
      `<strong>Tipo de caso:</strong> ${tipoCasoStr || CASE_LABEL[caseType]}` +
      `</div>`
    return header + parts.join('')
  }

  const factoresRiesgoHtml     = buildFactoresHtml('riesgo')
  const factoresProteccionHtml = buildFactoresHtml('proteccion')

  await imprimirNotaInicial(user.id, profile?.full_name ?? null, {
    initial_note:            (rel.initial_note            as string) ?? '',
    initial_note_date:       (rel.initial_note_date       as string) ?? null,
    initial_note_motivo:     (rel.initial_note_motivo     as string) ?? '',
    initial_note_subyacente: (rel.initial_note_subyacente as string) ?? '',
    initial_note_premisas:   (rel.initial_note_premisas   as string) ?? '',
    initial_note_pro_bono:   (rel.initial_note_pro_bono   as boolean) ?? false,
    initial_note_virtual:    (rel.initial_note_virtual    as boolean) ?? false,
    frecuencia_config:          (rel.frecuencia_config          as string | null) ?? null,
    sensacion_paciente_inicial: (rel.sensacion_paciente_inicial as string | null) ?? null,
    factoresRiesgoHtml:         factoresRiesgoHtml     || undefined,
    factoresProteccionHtml:     factoresProteccionHtml || undefined,
  }, headerOpts)
}

/** Carga sesiones presenciales y las imprime. sessionId = undefined → todas. */
export async function imprimirSesionesDesdeReportes(
  patientId:   string,
  sessionId?:  string,
  headerOpts?: Partial<ReportHeaderOptions>,
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  let q = supabase
    .from('therapist_session_notes')
    .select('id, session_number, session_date, session_objetivo, session_emociones, session_recursos, session_desarrollo, notes, is_pro_bono, is_virtual')
    .eq('therapist_id', user.id)
    .eq('patient_id', patientId)
    .order('session_date', { ascending: true })

  if (sessionId) q = q.eq('id', sessionId)

  const [{ data: rows }, { data: profile }] = await Promise.all([
    q,
    supabase.from('profiles').select('full_name').eq('id', patientId).single(),
  ])

  const sesiones: SessionPresencialPrint[] = (rows ?? []).map(s => ({
    session_number:     s.session_number    as number,
    session_date:       s.session_date      as string,
    session_objetivo:   s.session_objetivo  as string | null,
    session_emociones:  s.session_emociones as string | null,
    session_recursos:   s.session_recursos  as string | null,
    session_desarrollo: s.session_desarrollo as string | null,
    notes:              s.notes             as string | null,
    is_pro_bono:        (s.is_pro_bono      as boolean) ?? false,
    is_virtual:         (s.is_virtual       as boolean) ?? false,
  }))

  await imprimirBitacoraSesiones(user.id, profile?.full_name ?? null, sesiones, headerOpts)
}

/** Carga un análisis Consúltame por ID y abre ventana de impresión. */
export async function imprimirAnalisisDesdeReportes(
  patientId:   string,
  analysisId:  string,
  headerOpts?: Partial<ReportHeaderOptions>,
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const [{ data: analysis }, { data: profile }, { data: terapeutaProfile }] = await Promise.all([
    // El análisis se guarda completo en la columna 'content' (texto Markdown)
    supabase.from('analyses').select('content, created_at').eq('id', analysisId).single(),
    supabase.from('profiles').select('full_name').eq('id', patientId).single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  if (!analysis) { alert('No se encontró el análisis.'); return }

  const pacienteNombre  = profile?.full_name ?? 'Paciente'
  const terapeutaNombre = terapeutaProfile?.full_name ?? '—'
  const fecha = new Date((analysis.created_at as string)).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const fechaHoy = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  // Convertir Markdown básico a HTML
  const contenidoHtml = ((analysis.content as string) ?? '')
    // negrita **texto** → <strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // encabezados ##
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="titulo">$1</h1>')
    // líneas en blanco → separador de párrafo
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Análisis Clínico y Propuesta Técnica — ${pacienteNombre}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: letter; margin: 1cm 1.8cm 1.2cm; }
    html, body { margin: 0 !important; padding: 0 !important; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a1a; line-height: 1.3; }
    .doc-title { text-align: center; padding: 5pt 0; margin-bottom: 8pt;
                 border-bottom: 1pt solid #b0bbd4; border-top: 0.5pt solid #b0bbd4; }
    .doc-title h1 { font-size: 12pt; color: #2d3a8c; text-transform: uppercase; letter-spacing: 0.4pt; }
    .doc-title .sub { font-size: 9pt; color: #5060a4; font-style: italic; }
    .meta { display: flex; justify-content: space-between; font-size: 9pt; color: #444;
            background: #f4f6fb; padding: 4pt 8pt; border-radius: 3pt; margin-bottom: 10pt; }
    .content { font-size: 9pt; line-height: 1.5; }
    .content h1.titulo { font-size: 11pt; color: #2d3a8c; margin: 10pt 0 4pt; }
    .content h2 { font-size: 9.5pt; font-weight: bold; color: #2d3a8c;
                  text-transform: uppercase; letter-spacing: 0.3pt;
                  border-bottom: 1pt solid #b0bbd4; padding-bottom: 3pt; margin: 10pt 0 5pt; }
    .content p { margin-bottom: 6pt; }
    .content strong { color: #1a1a1a; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                   .no-print { display: none !important; } }
  </style>
</head>
<body>
  ${buildReportHeader({ terapeutaNombre, logoUrl: headerOpts?.logoUrl ?? null, side: headerOpts?.side ?? 'name', subtitle: 'Análisis Clínico y Propuesta Técnica' })}

  <!-- Asesorado y fecha de análisis -->
  <div class="meta" style="margin-bottom:8pt;">
    <span><strong>Asesorado/a:</strong> ${pacienteNombre}</span>
    <span style="font-size:8.5pt;color:#666;">Análisis generado: ${fecha}</span>
  </div>

  <!-- Título -->
  <div class="doc-title">
    <h1>Análisis Clínico y Propuesta Técnica</h1>
    <div class="sub">Consúltame AVI</div>
  </div>

  <!-- Meta -->
  <div class="meta">
    <span><strong>Paciente:</strong> ${pacienteNombre}</span>
    <span><strong>Terapeuta:</strong> ${terapeutaNombre}</span>
  </div>

  <!-- Contenido del análisis -->
  <div class="content"><p>${contenidoHtml}</p></div>

</body>
</html>`

  printHtmlViaIframe(html)
}

// ──────────────────────────────────────────────────────────
// Wrappers AVI-CLÍNICO para ReportesPanel
// Cada función carga los datos necesarios y llama a la
// función de impresión existente.
// Sprint 10 (Cambio XII) — E7
// ──────────────────────────────────────────────────────────

/** Historia Clínica Original (inamovible). Alerta si no fue generada. */
export async function imprimirHCOriginalDesdeReportes(patientId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const [{ data: expediente }, { data: profile }] = await Promise.all([
    supabase.from('patient_expediente')
      .select('hc_original')
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
      .maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', patientId).single(),
  ])

  const hcData = (expediente?.hc_original ?? null) as HistoriaClinicaV2 | null
  if (!hcData) {
    alert('La Historia Clínica Original aún no ha sido generada. Ve a Impresiones en AVI-CLÍNICO para generarla.')
    return
  }
  await imprimirHistoriaClinicaV2(patientId, user.id, profile?.full_name ?? null, hcData, true)
}

/** Historia Clínica Actualizada. Alerta si no fue generada. */
export async function imprimirHCActualizadaDesdeReportes(patientId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const [{ data: expediente }, { data: profile }] = await Promise.all([
    supabase.from('patient_expediente')
      .select('hc_actualizada')
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)
      .maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', patientId).single(),
  ])

  const hcData = (expediente?.hc_actualizada ?? null) as HistoriaClinicaV2 | null
  if (!hcData) {
    alert('La Historia Clínica Actualizada aún no ha sido generada. Ve a Impresiones en AVI-CLÍNICO para generarla.')
    return
  }
  await imprimirHistoriaClinicaV2(patientId, user.id, profile?.full_name ?? null, hcData, false)
}

/** Reporte Valorativo — carga datos internamente. */
export async function imprimirReporteValorativoDesdeReportes(patientId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', patientId).single()
  await imprimirReporteValorativo(patientId, user.id, profile?.full_name ?? null)
}

/** Integración y Plan de Intervención — carga datos internamente. */
export async function imprimirIntegracionPlanDesdeReportes(patientId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', patientId).single()
  await imprimirIntegracionPlan(patientId, user.id, profile?.full_name ?? null)
}

/** Reporte de Proceso — carga datos internamente. */
export async function imprimirReporteProcesoDesdeReportes(patientId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', patientId).single()
  await imprimirReporteProceso(patientId, user.id, profile?.full_name ?? null)
}

// ──────────────────────────────────────────────────────────
// Reporte: Datos Generales del Asesorado (una sola hoja + Genograma)
// ──────────────────────────────────────────────────────────

/**
 * Datos pre-cargados opcionales para imprimirDatosGeneralesDesdeReportes.
 * Cuando se proveen, la función omite las 3 queries a Supabase.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DGPreloaded {
  expediente:       Record<string, any> | null
  patientName:      string
  patientEmail:     string
  terapeutaNombre?: string
}

export async function imprimirDatosGeneralesDesdeReportes(
  patientId:   string,
  headerOpts?: Partial<ReportHeaderOptions>,
  preloaded?:  DGPreloaded,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dg:              Record<string, any> | null
  let terapeutaNombre: string
  let patientName:     string
  let patientEmail:    string

  if (preloaded) {
    // Datos ya cargados — sin round-trip a Supabase
    dg              = preloaded.expediente
    terapeutaNombre = preloaded.terapeutaNombre ?? headerOpts?.terapeutaNombre ?? '—'
    patientName     = preloaded.patientName
    patientEmail    = preloaded.patientEmail
  } else {
    // Fallback: cargar desde Supabase
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [expedienteRes, terapeutaRes, pacienteRes] = await Promise.all([
      supabase.from('patient_expediente').select('*').eq('therapist_id', user.id).eq('patient_id', patientId).maybeSingle(),
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('profiles').select('full_name, email').eq('id', patientId).single(),
    ])

    dg              = expedienteRes.data
    terapeutaNombre = terapeutaRes.data?.full_name ?? '—'
    patientName     = pacienteRes.data?.full_name ?? pacienteRes.data?.email ?? '—'
    patientEmail    = pacienteRes.data?.email ?? ''
  }

  const fechaHoy        = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  const v = (val: string | null | undefined) => val?.trim() || '—'

  // Hijos con datos
  const hijos: Array<{ nombre: string; edad: string; ocupacion: string; vive_en_casa: string }> = dg?.hijos ?? []
  const hijosRows = Array(6).fill(null).map((_, i) => ({
    nombre:      hijos[i]?.nombre      ?? '',
    edad:        hijos[i]?.edad        ?? '',
    ocupacion:   hijos[i]?.ocupacion   ?? '',
    vive_en_casa: hijos[i]?.vive_en_casa ?? '',
  }))

  const hijosHTML = hijosRows.map((h, i) =>
    `<tr>
      <td class="num">${i + 1}</td>
      <td>${h.nombre || '<span class="empty">—</span>'}</td>
      <td>${h.edad   || '—'}</td>
      <td>${h.ocupacion || '—'}</td>
      <td>${h.vive_en_casa || '—'}</td>
    </tr>`
  ).join('')

  // Salud
  const saludAyuda = dg?.salud_ayuda_psicologica === 'Sí'
    ? `Sí — ${v(dg?.salud_ayuda_tiempo)}`
    : v(dg?.salud_ayuda_psicologica)
  const saludMeds = dg?.salud_medicamentos === 'Sí'
    ? `Sí — ${v(dg?.salud_medicamentos_cual)}`
    : v(dg?.salud_medicamentos)

  // Información General
  const infoAsesoriaAnterior = dg?.info_asesoria_anterior === 'Sí' && dg?.info_asesoria_con_quien
    ? `Sí — ${dg.info_asesoria_con_quien}`
    : v(dg?.info_asesoria_anterior)

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Datos Generales — ${patientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: letter; margin: 1cm 1.8cm 1.2cm; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #1a1a1a;
      line-height: 1.3;
    }

    /* ─── Secciones ─── */
    .section { margin-bottom: 5pt; }
    .sec-header {
      background: #2d3a8c;
      color: #fff;
      font-size: 7.5pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
      padding: 2pt 6pt;
    }
    .sec-body {
      border: 0.5pt solid #b0bbd4;
      border-top: none;
      padding: 4pt 6pt;
    }
    .grid2  { display: grid; grid-template-columns: 1fr 1fr; gap: 3pt 12pt; }
    .grid3  { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3pt 8pt; }
    .field  { margin-bottom: 2pt; }
    .flabel {
      font-size: 6.5pt; font-weight: bold; color: #2d3a8c;
      text-transform: uppercase; letter-spacing: 0.3pt;
      margin-bottom: 0.5pt;
    }
    .fvalue {
      font-size: 8.5pt; color: #1a1a1a;
      border-bottom: 0.5pt solid #dde3ee;
      padding-bottom: 1pt; min-height: 10pt;
    }
    .empty { color: #bbb; font-style: italic; }

    /* ─── Tabla hijos ─── */
    .hijo-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
    .hijo-table th {
      font-size: 6.5pt; font-weight: bold; color: #2d3a8c;
      text-transform: uppercase; letter-spacing: 0.3pt;
      padding: 1.5pt 3pt; border-bottom: 0.5pt solid #b0bbd4;
      text-align: left;
    }
    .hijo-table td { padding: 2pt 3pt; border-bottom: 0.5pt solid #eef1f9; font-size: 10px; }
    .hijo-table tr:last-child td { border-bottom: none; }
    .num { color: #aaa; font-size: 7.5pt; }

    /* ─── Genograma ─── */
    .genograma-box {
      border: 1pt solid #2d3a8c;
      height: 118pt;
      position: relative;
      margin-top: 5pt;
    }
    .genograma-label {
      position: absolute; top: 4pt; right: 7pt;
      font-size: 7.5pt; font-weight: bold;
      color: #2d3a8c; text-transform: uppercase; letter-spacing: 0.8pt;
    }

    /* ─── Firmas ─── */
    .firmas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40pt;
      margin-top: 7pt;
    }
    .firma-item { text-align: center; }
    .firma-line { border-top: 0.75pt solid #555; padding-top: 3pt; font-size: 7.5pt; color: #555; }

    /* ─── Pie ─── */
    .footer {
      border-top: 0.5pt solid #dde3ee;
      margin-top: 5pt;
      padding-top: 3pt;
      text-align: center;
      font-size: 6.5pt;
      color: #aaa;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <div class="no-print" style="text-align:right;padding:8pt 0 12pt;">
    <button onclick="window.print()" style="padding:7pt 16pt;background:#2d3a8c;color:white;border:none;border-radius:6pt;font-size:9.5pt;cursor:pointer;">
      🖨 Imprimir / Guardar PDF
    </button>
  </div>

  ${buildReportHeader({ terapeutaNombre, logoUrl: headerOpts?.logoUrl ?? null, side: headerOpts?.side ?? 'name', subtitle: 'Registro clínico — Datos generales del asesorado' })}

  <!-- 1. Datos del asesorado -->
  <div class="section">
    <div class="sec-header">Datos del asesorado</div>
    <div class="sec-body">
      <div class="grid2" style="margin-bottom:4pt;">
        <div class="field">
          <div class="flabel">Nombre completo</div>
          <div class="fvalue">${v(dg?.asesorado_nombre)}</div>
        </div>
        <div class="grid2">
          <div class="field">
            <div class="flabel">Sexo</div>
            <div class="fvalue">${v(dg?.asesorado_sexo)}</div>
          </div>
          <div class="field">
            <div class="flabel">Edad</div>
            <div class="fvalue">${v(dg?.asesorado_edad)}</div>
          </div>
        </div>
      </div>
      <div class="grid3">
        <div class="field">
          <div class="flabel">Fecha de nacimiento</div>
          <div class="fvalue">${dg?.asesorado_fecha_nacimiento ? new Date(dg.asesorado_fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</div>
        </div>
        <div class="field">
          <div class="flabel">Lugar de nacimiento</div>
          <div class="fvalue">${v(dg?.asesorado_lugar_nacimiento)}</div>
        </div>
        <div class="field">
          <div class="flabel">Estado civil</div>
          <div class="fvalue">${v(dg?.asesorado_estado_civil)}</div>
        </div>
      </div>
      <div class="grid3" style="margin-top:4pt;">
        <div class="field">
          <div class="flabel">Escolaridad</div>
          <div class="fvalue">${v(dg?.asesorado_escolaridad)}</div>
        </div>
        <div class="field">
          <div class="flabel">Ocupación</div>
          <div class="fvalue">${v(dg?.asesorado_ocupacion)}</div>
        </div>
        <div class="field">
          <div class="flabel">Religión — Parroquia</div>
          <div class="fvalue">${v(dg?.asesorado_religion)}${dg?.asesorado_parroquia ? ' — ' + dg.asesorado_parroquia : ''}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 2. Contacto + 3. Pareja (lado a lado) -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:7pt;margin-bottom:7pt;">
    <div class="section" style="margin-bottom:0;">
      <div class="sec-header">Datos de contacto</div>
      <div class="sec-body">
        <div class="field"><div class="flabel">Teléfono</div><div class="fvalue">${v(dg?.contacto_telefono)}</div></div>
        <div class="field"><div class="flabel">Correo electrónico</div><div class="fvalue">${patientEmail || '—'}</div></div>
        <div class="field"><div class="flabel">Domicilio</div><div class="fvalue">${v(dg?.contacto_domicilio)}</div></div>
      </div>
    </div>
    <div class="section" style="margin-bottom:0;">
      <div class="sec-header">Datos de la pareja</div>
      <div class="sec-body">
        <div class="field"><div class="flabel">Nombre completo</div><div class="fvalue">${v(dg?.pareja_nombre)}</div></div>
        <div class="grid3">
          <div class="field"><div class="flabel">Sexo</div><div class="fvalue">${v(dg?.pareja_sexo)}</div></div>
          <div class="field"><div class="flabel">Edad</div><div class="fvalue">${v(dg?.pareja_edad)}</div></div>
          <div class="field"><div class="flabel">Fecha nac.</div><div class="fvalue">${dg?.pareja_fecha_nacimiento ? new Date(dg.pareja_fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div></div>
        </div>
      </div>
    </div>
  </div>

  <!-- 4. Hijos + 5. Salud (lado a lado) -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:7pt;">
    <div class="section" style="margin-bottom:0;">
      <div class="sec-header">Datos de los hijos</div>
      <div class="sec-body" style="padding:4pt 5pt;">
        <table class="hijo-table">
          <thead>
            <tr>
              <th style="width:12pt">#</th>
              <th>Nombre</th>
              <th style="width:24pt">Edad</th>
              <th>Ocupación</th>
              <th style="width:36pt">En casa</th>
            </tr>
          </thead>
          <tbody>${hijosHTML}</tbody>
        </table>
      </div>
    </div>
    <div class="section" style="margin-bottom:0;">
      <div class="sec-header">Salud</div>
      <div class="sec-body">
        <div class="field"><div class="flabel">¿Padece alguna enfermedad?</div><div class="fvalue">${v(dg?.salud_padece_enfermedad)}</div></div>
        <div class="field"><div class="flabel">¿Ha recibido ayuda psicológica o psiquiátrica?</div><div class="fvalue">${saludAyuda}</div></div>
        <div class="field"><div class="flabel">¿Toma medicamentos actualmente?</div><div class="fvalue">${saludMeds}</div></div>
      </div>
    </div>
  </div>

  <!-- 6. Información General -->
  <div class="section" style="margin-top:5pt;">
    <div class="sec-header">Información General</div>
    <div class="sec-body">
      <div class="field" style="margin-bottom:3pt;">
        <div class="flabel">¿Ha recibido asesoría de esta Institución anteriormente?</div>
        <div class="fvalue" style="font-size:10px;">${infoAsesoriaAnterior}</div>
      </div>
      <div class="field" style="margin-bottom:3pt;">
        <div class="flabel">¿Por qué eligió esta Institución para su acompañamiento terapéutico/emocional?</div>
        <div class="fvalue" style="font-size:10px;min-height:14pt;white-space:pre-wrap;">${v(dg?.info_razon_eleccion)}</div>
      </div>
      <div class="field">
        <div class="flabel">¿Qué espera de este acompañamiento a través de esta Institución?</div>
        <div class="fvalue" style="font-size:10px;min-height:14pt;white-space:pre-wrap;">${v(dg?.info_expectativas)}</div>
      </div>
    </div>
  </div>

  <!-- Genograma -->
  <div class="genograma-box">
    <div class="genograma-label">Genograma</div>
  </div>

  <!-- Firmas -->
  <div class="firmas">
    <div class="firma-item">
      <div class="firma-line">
        <div style="font-size:8.5pt;font-weight:bold;color:#333;">${v(dg?.asesorado_nombre)}</div>
        <div>Nombre y firma del Asesorado</div>
      </div>
    </div>
    <div class="firma-item">
      <div class="firma-line">
        <div style="font-size:8.5pt;font-weight:bold;color:#333;">${terapeutaNombre}</div>
        <div>Nombre y firma del Terapeuta</div>
      </div>
    </div>
  </div>

  <!-- Pie de página -->
  <div class="footer">
    AVI Therapy Companion · avi-app.com.mx · Documento de uso clínico confidencial
  </div>

</body>
</html>`

  printHtmlViaIframe(html)
}
