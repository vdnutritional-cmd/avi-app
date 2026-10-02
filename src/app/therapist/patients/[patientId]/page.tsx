'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  User, FolderOpen, MessageSquare, FileText, Calendar, Search,
  ArrowRightCircle, Users, Heart, ClipboardList, Activity,
  CheckSquare, Printer, AlertTriangle, Lock, Menu,
} from 'lucide-react'
import ExpedienteTab from './ExpedienteTab'
import DatosGeneralesTab from './DatosGeneralesTab'
import TipoCasoTab from './TipoCasoTab'
import DerivacionesCierresTab from './DerivacionesCierresTab'

const MAX_SESIONES_PRESENCIALES = 12

// Fecha de hoy en horario de la Ciudad de México (YYYY-MM-DD)
function hoyMX(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' })
}

interface Pattern {
  id: string
  summary: string
  emotional_patterns: string[]
  predominant_emotions: string[]
  reformulation: string
  crisis_detected: boolean
  created_at: string
}

interface Analysis {
  id: string
  content: string
  created_at: string
}

interface SessionNote {
  id: string
  session_number: number
  session_date: string
  session_objetivo: string | null
  session_desarrollo: string | null
  notes: string             // Observaciones particulares
  session_emociones: string | null
  session_recursos: string | null
  is_pro_bono: boolean
  is_virtual: boolean
}

interface PatientProfile {
  full_name: string
  email: string
}

export default function PatientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params.patientId as string

  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([])
  const [initialNote, setInitialNote] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [initialNoteDate, setInitialNoteDate] = useState(hoyMX())
  const [savedNoteDate, setSavedNoteDate] = useState(hoyMX())
  const [initialNoteProBono, setInitialNoteProBono] = useState(false)
  const [savedNoteProBono, setSavedNoteProBono] = useState(false)
  const [initialNoteVirtual, setInitialNoteVirtual] = useState(false)
  const [savedNoteVirtual, setSavedNoteVirtual] = useState(false)
  const [initialNoteMotivo, setInitialNoteMotivo] = useState('')
  const [savedNoteMotivo, setSavedNoteMotivo] = useState('')
  const [initialNoteSubyacente, setInitialNoteSubyacente] = useState('')
  const [savedNoteSubyacente, setSavedNoteSubyacente] = useState('')
  const [initialNotePremisas, setInitialNotePremisas] = useState('')
  const [savedNotePremisas, setSavedNotePremisas] = useState('')
  // Sprint 4 — VIII + IX
  const [sensacionPaciente, setSensacionPaciente] = useState('0')
  const [savedSensacionPaciente, setSavedSensacionPaciente] = useState('0')
  const [factoresRiesgo, setFactoresRiesgo] = useState<{ individual: string[]; familiar: string[]; pareja: string[] }>({ individual: [], familiar: [], pareja: [] })
  const [savedFactoresRiesgo, setSavedFactoresRiesgo] = useState<{ individual: string[]; familiar: string[]; pareja: string[] }>({ individual: [], familiar: [], pareja: [] })
  const [factoresProteccion, setFactoresProteccion] = useState<{ individual: string[]; familiar: string[]; pareja: string[] }>({ individual: [], familiar: [], pareja: [] })
  const [savedFactoresProteccion, setSavedFactoresProteccion] = useState<{ individual: string[]; familiar: string[]; pareja: string[] }>({ individual: [], familiar: [], pareja: [] })
  // Sprint 4 — TREC
  const [factoresRiesgoTREC, setFactoresRiesgoTREC] = useState<{ individual: string[]; familiar: string[]; pareja: string[] }>({ individual: [], familiar: [], pareja: [] })
  const [savedFactoresRiesgoTREC, setSavedFactoresRiesgoTREC] = useState<{ individual: string[]; familiar: string[]; pareja: string[] }>({ individual: [], familiar: [], pareja: [] })
  const [factoresProteccionTREC, setFactoresProteccionTREC] = useState<{ individual: string[]; familiar: string[]; pareja: string[] }>({ individual: [], familiar: [], pareja: [] })
  const [savedFactoresProteccionTREC, setSavedFactoresProteccionTREC] = useState<{ individual: string[]; familiar: string[]; pareja: string[] }>({ individual: [], familiar: [], pareja: [] })
  // Sprint 4 — acordeones de bloques de factores
  const [openTFS, setOpenTFS] = useState(false)
  const [openTREC, setOpenTREC] = useState(false)
  const [openTCC, setOpenTCC] = useState(false)
  // Sprint 4 — acordeones de sub-secciones por Tipo de Caso (compartido entre los 3 bloques)
  const [openIndividual, setOpenIndividual] = useState(false)
  const [openFamiliar, setOpenFamiliar] = useState(false)
  const [openPareja, setOpenPareja] = useState(false)
  // Sprint 4 — perfil terapéutico del terapeuta (para bloquear bloques no seleccionados)
  const [therapyProfile, setTherapyProfile] = useState<string>('')
  // Sprint 4 — TCC
  const [factoresRiesgoTCC, setFactoresRiesgoTCC] = useState<{ individual: string[]; familiar: string[]; pareja: string[] }>({ individual: [], familiar: [], pareja: [] })
  const [savedFactoresRiesgoTCC, setSavedFactoresRiesgoTCC] = useState<{ individual: string[]; familiar: string[]; pareja: string[] }>({ individual: [], familiar: [], pareja: [] })
  const [factoresProteccionTCC, setFactoresProteccionTCC] = useState<{ individual: string[]; familiar: string[]; pareja: string[] }>({ individual: [], familiar: [], pareja: [] })
  const [savedFactoresProteccionTCC, setSavedFactoresProteccionTCC] = useState<{ individual: string[]; familiar: string[]; pareja: string[] }>({ individual: [], familiar: [], pareja: [] })
  const [frecuenciaConfig, setFrecuenciaConfig] = useState('')
  const [savedFrecuenciaConfig, setSavedFrecuenciaConfig] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  // Nueva sesión presencial
  const [newSessionDate, setNewSessionDate] = useState(hoyMX())
  const [newSessionObjetivo, setNewSessionObjetivo] = useState('')
  const [newSessionDesarrollo, setNewSessionDesarrollo] = useState('')
  const [newSessionNotes, setNewSessionNotes] = useState('')  // Observaciones particulares
  const [newSessionProBono, setNewSessionProBono] = useState(false)
  const [newSessionIsVirtual, setNewSessionIsVirtual] = useState(false)
  const [newSessionEmociones, setNewSessionEmociones] = useState('')
  const [newSessionRecursos, setNewSessionRecursos] = useState('')
  const [generandoEmociones, setGenerandoEmociones] = useState(false)
  const [generandoRecursos, setGenerandoRecursos] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)

  // Edición de nombre
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [empresaNombre, setEmpresaNombre] = useState<string | null>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [editingEmpresa, setEditingEmpresa] = useState(false)
  const [empresasList, setEmpresasList] = useState<{ id: string; nombre: string }[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
  const [savingEmpresa, setSavingEmpresa] = useState(false)

  const [analyzing, setAnalyzing] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // Datos generales del asesorado (pre-cargados para evitar problemas de timing)
  // undefined = aún no cargado; null = cargado pero sin fila; object = datos disponibles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expedienteRow, setExpedienteRow] = useState<Record<string, any> | null | undefined>(undefined)

  type PatientTab = 'datos-generales' | 'tipo-caso' | 'sesiones' | 'presenciales' | 'analisis' | 'nota' | 'derivaciones-cierres' | 'individual' | 'familiar' | 'pareja' | 'prediagnostico' | 'analisis-clinicos' | 'cuestionarios' | 'impresiones'
  const [activeTab, setActiveTab] = useState<PatientTab>('datos-generales')
  const [therapistId, setTherapistId] = useState<string | null>(null)
  const [tier, setTier] = useState<'esencial' | 'clinico'>('esencial')
  const [sheetOpen, setSheetOpen] = useState(false)
  const streamRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    load()
  }, [patientId])

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) setTherapistId(user.id)

    // Obtener tier de suscripción del terapeuta
    if (user?.id) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('therapist_id', user.id)
        .maybeSingle()
      if (sub?.tier === 'clinico') setTier('clinico')
    }

    const [profileRes, patternsRes, analysesRes, relationRes, sessionNotesRes, expedienteRes, therapistProfileRes] = await Promise.all([
      supabase.from('profiles').select('full_name, email').eq('id', patientId).single(),
      supabase.from('patterns').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
      supabase.from('analyses').select('*').eq('patient_id', patientId).eq('therapist_id', user?.id ?? '').order('created_at', { ascending: false }),
      supabase.from('therapist_patients').select('initial_note, initial_note_date, initial_note_pro_bono, initial_note_virtual, initial_note_motivo, initial_note_subyacente, initial_note_premisas, sensacion_paciente_inicial, factores_riesgo_sel, factores_proteccion_sel, factores_riesgo_trec, factores_proteccion_trec, factores_riesgo_tcc, factores_proteccion_tcc, frecuencia_config, empresa_id, convenio_empresas(nombre)').eq('patient_id', patientId).eq('therapist_id', user?.id ?? '').single(),
      supabase.from('therapist_session_notes').select('*').eq('patient_id', patientId).order('session_number', { ascending: true }),
      supabase.from('patient_expediente').select('*').eq('therapist_id', user?.id ?? '').eq('patient_id', patientId).maybeSingle(),
      supabase.from('profiles').select('therapy_profile').eq('id', user?.id ?? '').single(),
    ])

    if (profileRes.data) setProfile(profileRes.data)
    if (patternsRes.data) setPatterns(patternsRes.data)
    if (analysesRes.data) setAnalyses(analysesRes.data)
    if (sessionNotesRes.data) setSessionNotes(sessionNotesRes.data)
    // Siempre actualizar (null si no hay fila) para que DatosGeneralesTab sepa que ya terminó la carga
    setExpedienteRow(expedienteRes.data ?? null)
    // Sprint 4 — perfil terapéutico del terapeuta
    setTherapyProfile(therapistProfileRes.data?.therapy_profile ?? '')

    // Empresa CONVENIO del paciente (si tiene)
    const empresaRaw = relationRes.data?.convenio_empresas as unknown
    const empresaObj = Array.isArray(empresaRaw) ? empresaRaw[0] : empresaRaw
    const nombreEmpresa = (empresaObj as { nombre?: string } | null)?.nombre ?? null
    const idEmpresa = (relationRes.data as { empresa_id?: string | null } | null)?.empresa_id ?? null
    setEmpresaNombre(nombreEmpresa)
    setEmpresaId(idEmpresa)
    setSelectedEmpresaId(idEmpresa ?? '')

    // Cargar lista de empresas para el editor
    try {
      const empRes = await fetch('/api/convenio-empresas')
      if (empRes.ok) {
        const empData = await empRes.json()
        setEmpresasList(empData.empresas ?? [])
      }
    } catch { /* sin empresas disponibles */ }

    if (relationRes.data?.initial_note) {
      setInitialNote(relationRes.data.initial_note)
      setSavedNote(relationRes.data.initial_note)
    }
    const noteDate = relationRes.data?.initial_note_date ?? hoyMX()
    setInitialNoteDate(noteDate)
    setSavedNoteDate(noteDate)
    const notePb = relationRes.data?.initial_note_pro_bono ?? false
    setInitialNoteProBono(notePb)
    setSavedNoteProBono(notePb)
    const noteVirtual = relationRes.data?.initial_note_virtual ?? false
    setInitialNoteVirtual(noteVirtual)
    setSavedNoteVirtual(noteVirtual)
    const noteMotivo = relationRes.data?.initial_note_motivo ?? ''
    setInitialNoteMotivo(noteMotivo)
    setSavedNoteMotivo(noteMotivo)
    const noteSubyacente = relationRes.data?.initial_note_subyacente ?? ''
    setInitialNoteSubyacente(noteSubyacente)
    setSavedNoteSubyacente(noteSubyacente)
    const notePremisas = relationRes.data?.initial_note_premisas ?? ''
    setInitialNotePremisas(notePremisas)
    setSavedNotePremisas(notePremisas)

    // Sprint 4 — VIII: sensación inicial ('n/a' o vacío → '0')
    const rawSensacion = relationRes.data?.sensacion_paciente_inicial ?? '0'
    const sensacion = (rawSensacion === 'n/a' || !rawSensacion) ? '0' : rawSensacion
    setSensacionPaciente(sensacion)
    setSavedSensacionPaciente(sensacion)

    // Sprint 4 — VIII: factores de riesgo (jsonb: objeto {individual, familiar})
    const emptyFactores = { individual: [] as string[], familiar: [] as string[], pareja: [] as string[] }
    const rawRiesgo = relationRes.data?.factores_riesgo_sel
    const factRiesgo = (rawRiesgo && typeof rawRiesgo === 'object' && !Array.isArray(rawRiesgo))
      ? { individual: rawRiesgo.individual ?? [], familiar: rawRiesgo.familiar ?? [], pareja: rawRiesgo.pareja ?? [] }
      : emptyFactores
    setFactoresRiesgo(factRiesgo)
    setSavedFactoresRiesgo(factRiesgo)

    // Sprint 4 — VIII: factores de protección
    const rawProteccion = relationRes.data?.factores_proteccion_sel
    const factProteccion = (rawProteccion && typeof rawProteccion === 'object' && !Array.isArray(rawProteccion))
      ? { individual: rawProteccion.individual ?? [], familiar: rawProteccion.familiar ?? [], pareja: rawProteccion.pareja ?? [] }
      : emptyFactores
    setFactoresProteccion(factProteccion)
    setSavedFactoresProteccion(factProteccion)

    // Sprint 4 — VIII (TREC): factores de riesgo TREC
    const rawRiesgoTREC = relationRes.data?.factores_riesgo_trec
    const factRiesgoTREC = (rawRiesgoTREC && typeof rawRiesgoTREC === 'object' && !Array.isArray(rawRiesgoTREC))
      ? { individual: rawRiesgoTREC.individual ?? [], familiar: rawRiesgoTREC.familiar ?? [], pareja: rawRiesgoTREC.pareja ?? [] }
      : emptyFactores
    setFactoresRiesgoTREC(factRiesgoTREC)
    setSavedFactoresRiesgoTREC(factRiesgoTREC)

    // Sprint 4 — VIII (TREC): factores de protección TREC
    const rawProteccionTREC = relationRes.data?.factores_proteccion_trec
    const factProteccionTREC = (rawProteccionTREC && typeof rawProteccionTREC === 'object' && !Array.isArray(rawProteccionTREC))
      ? { individual: rawProteccionTREC.individual ?? [], familiar: rawProteccionTREC.familiar ?? [], pareja: rawProteccionTREC.pareja ?? [] }
      : emptyFactores
    setFactoresProteccionTREC(factProteccionTREC)
    setSavedFactoresProteccionTREC(factProteccionTREC)

    // Sprint 4 — VIII (TCC): factores de riesgo TCC
    const rawRiesgoTCC = relationRes.data?.factores_riesgo_tcc
    const factRiesgoTCC = (rawRiesgoTCC && typeof rawRiesgoTCC === 'object' && !Array.isArray(rawRiesgoTCC))
      ? { individual: rawRiesgoTCC.individual ?? [], familiar: rawRiesgoTCC.familiar ?? [], pareja: rawRiesgoTCC.pareja ?? [] }
      : emptyFactores
    setFactoresRiesgoTCC(factRiesgoTCC)
    setSavedFactoresRiesgoTCC(factRiesgoTCC)

    // Sprint 4 — VIII (TCC): factores de protección TCC
    const rawProteccionTCC = relationRes.data?.factores_proteccion_tcc
    const factProteccionTCC = (rawProteccionTCC && typeof rawProteccionTCC === 'object' && !Array.isArray(rawProteccionTCC))
      ? { individual: rawProteccionTCC.individual ?? [], familiar: rawProteccionTCC.familiar ?? [], pareja: rawProteccionTCC.pareja ?? [] }
      : emptyFactores
    setFactoresProteccionTCC(factProteccionTCC)
    setSavedFactoresProteccionTCC(factProteccionTCC)

    // Sprint 4 — IX: frecuencia configurada
    const freqConf = relationRes.data?.frecuencia_config ?? ''
    setFrecuenciaConfig(freqConf)
    setSavedFrecuenciaConfig(freqConf)
  }

  useEffect(() => {
    streamRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamText])

  async function saveEmpresa() {
    setSavingEmpresa(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingEmpresa(false); return }

    const nuevoId = selectedEmpresaId || null
    await supabase
      .from('therapist_patients')
      .update({ empresa_id: nuevoId })
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)

    setEmpresaId(nuevoId)
    setEmpresaNombre(empresasList.find(e => e.id === nuevoId)?.nombre ?? null)
    setEditingEmpresa(false)
    setSavingEmpresa(false)
  }

  async function saveName() {
    if (!editingName.trim()) return
    setSavingName(true)
    try {
      const res = await fetch('/api/patients/rename', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, fullName: editingName }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`Error al guardar nombre: ${err.error ?? res.status}`)
        return
      }
      setProfile(prev => prev ? { ...prev, full_name: editingName.trim() } : prev)
      setIsEditingName(false)
    } catch {
      alert('Error de red al guardar el nombre.')
    } finally {
      setSavingName(false)
    }
  }

  async function saveNote() {
    setSavingNote(true)
    try {
      const res = await fetch('/api/analysis', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId, initialNote, initialNoteDate, initialNoteProBono, initialNoteVirtual,
          initialNoteMotivo, initialNoteSubyacente, initialNotePremisas,
          sensacionPaciente, factoresRiesgo, factoresProteccion,
          factoresRiesgoTREC, factoresProteccionTREC,
          factoresRiesgoTCC, factoresProteccionTCC, frecuenciaConfig,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`Error al guardar la nota: ${err.error ?? res.status}`)
        return
      }
      setSavedNote(initialNote)
      setSavedNoteDate(initialNoteDate)
      setSavedNoteProBono(initialNoteProBono)
      setSavedNoteVirtual(initialNoteVirtual)
      setSavedNoteMotivo(initialNoteMotivo)
      setSavedNoteSubyacente(initialNoteSubyacente)
      setSavedNotePremisas(initialNotePremisas)
      setSavedSensacionPaciente(sensacionPaciente)
      setSavedFactoresRiesgo(factoresRiesgo)
      setSavedFactoresProteccion(factoresProteccion)
      setSavedFactoresRiesgoTREC(factoresRiesgoTREC)
      setSavedFactoresProteccionTREC(factoresProteccionTREC)
      setSavedFactoresRiesgoTCC(factoresRiesgoTCC)
      setSavedFactoresProteccionTCC(factoresProteccionTCC)
      setSavedFrecuenciaConfig(frecuenciaConfig)
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 3000)
    } catch {
      alert('Error de red al guardar la nota. Intenta de nuevo.')
    } finally {
      setSavingNote(false)
    }
  }

  async function generarEmociones() {
    if (!newSessionDesarrollo.trim()) return
    setGenerandoEmociones(true)
    try {
      const res = await fetch('/api/session-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'emociones',
          patientId,
          sessionDesarrollo: newSessionDesarrollo,
          sessionObjetivo: newSessionObjetivo || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Error al generar emociones'); return }
      setNewSessionEmociones(data.resultado ?? '')
    } catch (e) {
      alert('Error de red al generar emociones')
    } finally {
      setGenerandoEmociones(false)
    }
  }

  async function generarRecursos() {
    if (!newSessionNotes.trim()) return
    setGenerandoRecursos(true)
    try {
      const res = await fetch('/api/session-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'recursos',
          patientId,
          sessionDesarrollo: newSessionDesarrollo || undefined,
          sessionNotes: newSessionNotes,
          sessionObjetivo: newSessionObjetivo || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Error al generar recursos'); return }
      setNewSessionRecursos(data.resultado ?? '')
    } catch (e) {
      alert('Error de red al generar recursos')
    } finally {
      setGenerandoRecursos(false)
    }
  }

  async function saveSessionNote() {
    const hayContenido = newSessionObjetivo.trim() || newSessionDesarrollo.trim() || newSessionNotes.trim()
    if (!hayContenido) return
    if (!therapistId) { alert('Error: sesión de terapeuta no encontrada. Recarga la página.'); return }
    setSavingSession(true)
    try {
      const supabase = createClient()
      const nextNumber = editingSessionId
        ? sessionNotes.find(s => s.id === editingSessionId)?.session_number ?? 1
        : (sessionNotes.length > 0 ? Math.max(...sessionNotes.map(s => s.session_number)) + 1 : 1)

      const payload = {
        session_date:        newSessionDate,
        session_objetivo:    newSessionObjetivo    || null,
        session_desarrollo:  newSessionDesarrollo  || null,
        notes:               newSessionNotes       || null,   // Observaciones particulares
        session_emociones:   newSessionEmociones   || null,
        session_recursos:    newSessionRecursos     || null,
        is_pro_bono:         newSessionProBono,
        is_virtual:          newSessionIsVirtual,
      }

      if (editingSessionId) {
        const { error } = await supabase
          .from('therapist_session_notes')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingSessionId)
          .eq('therapist_id', therapistId)
        if (error) { alert(`Error al actualizar la sesión: ${error.message}`); return }
      } else {
        const { error } = await supabase
          .from('therapist_session_notes')
          .insert({ therapist_id: therapistId, patient_id: patientId, session_number: nextNumber, ...payload })
        if (error) { alert(`Error al guardar la sesión: ${error.message}`); return }
      }

      setNewSessionObjetivo('')
      setNewSessionDesarrollo('')
      setNewSessionNotes('')
      setNewSessionEmociones('')
      setNewSessionRecursos('')
      setNewSessionDate(hoyMX())
      setNewSessionProBono(false)
      setNewSessionIsVirtual(false)
      setEditingSessionId(null)
      await load()
    } finally {
      setSavingSession(false)
    }
  }

  function startEdit(session: SessionNote) {
    setEditingSessionId(session.id)
    setNewSessionDate(session.session_date)
    setNewSessionObjetivo(session.session_objetivo ?? '')
    setNewSessionDesarrollo(session.session_desarrollo ?? '')
    setNewSessionNotes(session.notes ?? '')
    setNewSessionEmociones(session.session_emociones ?? '')
    setNewSessionRecursos(session.session_recursos ?? '')
    setNewSessionProBono(session.is_pro_bono ?? false)
    setNewSessionIsVirtual(session.is_virtual ?? false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function requestAnalysis() {
    if (analyzing) return
    setAnalyzing(true)
    setStreamText('')
    setAnalysisError(null)
    setActiveTab('analisis')

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error ?? `Error ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let data: Record<string, unknown>
          try {
            data = JSON.parse(line.slice(6))
          } catch {
            continue // línea malformada, ignorar
          }
          if (data.error) throw new Error(data.error as string)
          if (data.text) {
            fullText += data.text as string
            setStreamText(fullText)
          }
          if (data.done) {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            const { data: newAnalyses } = await supabase
              .from('analyses').select('*')
              .eq('patient_id', patientId)
              .eq('therapist_id', user?.id ?? '')
              .order('created_at', { ascending: false })
            if (newAnalyses) setAnalyses(newAnalyses)
          }
        }
      }

      if (!fullText) throw new Error('No se recibió contenido del análisis')

    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setAnalyzing(false)
    }
  }

  const noteChanged =
    initialNote !== savedNote ||
    initialNoteDate !== savedNoteDate ||
    initialNoteProBono !== savedNoteProBono ||
    initialNoteVirtual !== savedNoteVirtual ||
    initialNoteMotivo !== savedNoteMotivo ||
    initialNoteSubyacente !== savedNoteSubyacente ||
    initialNotePremisas !== savedNotePremisas ||
    sensacionPaciente !== savedSensacionPaciente ||
    JSON.stringify(factoresRiesgo) !== JSON.stringify(savedFactoresRiesgo) ||
    JSON.stringify(factoresProteccion) !== JSON.stringify(savedFactoresProteccion) ||
    JSON.stringify(factoresRiesgoTREC) !== JSON.stringify(savedFactoresRiesgoTREC) ||
    JSON.stringify(factoresProteccionTREC) !== JSON.stringify(savedFactoresProteccionTREC) ||
    JSON.stringify(factoresRiesgoTCC) !== JSON.stringify(savedFactoresRiesgoTCC) ||
    JSON.stringify(factoresProteccionTCC) !== JSON.stringify(savedFactoresProteccionTCC) ||
    frecuenciaConfig !== savedFrecuenciaConfig
  const hayContenidoNuevaSesion = !!(newSessionObjetivo.trim() || newSessionDesarrollo.trim() || newSessionNotes.trim())
  const puedeAgregarSesion = sessionNotes.length < MAX_SESIONES_PRESENCIALES || editingSessionId !== null

  // Sprint 4 — bloques activos según perfil terapéutico del terapeuta
  const _tpPartes = therapyProfile ? therapyProfile.split('_') : []
  const tfsActive  = _tpPartes.length === 0 || _tpPartes.includes('famsis')
  const trecActive = _tpPartes.length === 0 || _tpPartes.includes('trec')
  const tccActive  = _tpPartes.length === 0 || _tpPartes.includes('cc')
  // Sprint 4 — sub-secciones activas según tipo de caso del paciente
  const tipoCasoActivo = (expedienteRow as Record<string, unknown> | null)?.tipo_caso as string ?? ''
  const tipoIndActive = !tipoCasoActivo || tipoCasoActivo === 'Individual'
  const tipoFamActive = !tipoCasoActivo || tipoCasoActivo === 'Familiar'
  const tipoParActive = !tipoCasoActivo || tipoCasoActivo === 'Pareja'

  // ── Helpers para sidebar ───────────────────────────────────────────────────
  const isClinico = tier === 'clinico'
  type SidebarItem = {
    id: PatientTab
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Icon: any
    label: string
    badge?: string | number
    alert?: boolean
    dim?: boolean
  }

  const navItem = ({ id, Icon, label, badge, alert, dim }: SidebarItem) => (
    <button
      key={id}
      onClick={() => { if (!dim) setActiveTab(id) }}
      title={dim ? 'No disponible para este tipo de caso' : undefined}
      className={[
        'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
        dim
          ? 'text-gray-300 cursor-not-allowed'
          : activeTab === id
            ? 'bg-primary-50 text-primary-700 font-medium border-r-2 border-primary-500'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
      ].join(' ')}
    >
      <Icon size={14} className="shrink-0 flex-none" />
      <span className="flex-1 truncate text-xs leading-tight">{label}</span>
      {badge !== undefined && badge !== 0 && badge !== '' && (
        <span className="shrink-0 text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-semibold leading-none">{badge}</span>
      )}
      {alert && (
        <AlertTriangle size={11} className="shrink-0 text-amber-500" />
      )}
    </button>
  )

  const esencialItems: SidebarItem[] = [
    { id: 'datos-generales',      Icon: User,             label: 'Datos generales' },
    { id: 'tipo-caso',            Icon: FolderOpen,        label: 'Tipo de caso' },
    { id: 'sesiones',             Icon: MessageSquare,     label: 'Sesiones AVI', badge: patterns.length || undefined },
    { id: 'nota',                 Icon: FileText,          label: 'Nota inicial', alert: !savedNote },
    { id: 'presenciales',         Icon: Calendar,          label: 'Ses. presenciales', badge: sessionNotes.length > 0 ? `${sessionNotes.length}/${MAX_SESIONES_PRESENCIALES}` : undefined },
    { id: 'analisis',             Icon: Search,            label: 'Análisis', badge: analyses.length || undefined },
    { id: 'derivaciones-cierres', Icon: ArrowRightCircle,  label: 'Derivaciones' },
  ]

  const clinicoItems: SidebarItem[] = [
    { id: 'tipo-caso',        Icon: FolderOpen,     label: 'Tipo de caso' },
    { id: 'individual',       Icon: User,           label: 'Individual',  dim: !isClinico || (!!tipoCasoActivo && tipoCasoActivo !== 'Individual') },
    { id: 'familiar',         Icon: Users,          label: 'Familiar',    dim: !isClinico || (!!tipoCasoActivo && tipoCasoActivo !== 'Familiar') },
    { id: 'pareja',           Icon: Heart,          label: 'Pareja',      dim: !isClinico || (!!tipoCasoActivo && tipoCasoActivo !== 'Pareja') },
    { id: 'prediagnostico',   Icon: ClipboardList,  label: 'Prediagnóstico',    dim: !isClinico },
    { id: 'analisis-clinicos',Icon: Activity,       label: 'Análisis clínicos', dim: !isClinico },
    { id: 'cuestionarios',    Icon: CheckSquare,    label: 'Cuestionarios',     dim: !isClinico },
    { id: 'impresiones',      Icon: Printer,        label: 'Impresiones clínicas', dim: !isClinico },
  ]

  const clinicoTabIds: PatientTab[] = ['individual','familiar','pareja','prediagnostico','analisis-clinicos','cuestionarios','impresiones']
  const esencialTabIds: PatientTab[] = ['datos-generales','tipo-caso','sesiones','nota','presenciales','analisis','derivaciones-cierres']

  const TAB_LABELS: Record<PatientTab, string> = {
    'datos-generales':      'Datos generales',
    'tipo-caso':            'Tipo de caso',
    'sesiones':             'Sesiones AVI',
    'nota':                 'Nota inicial',
    'presenciales':         'Ses. presenciales',
    'analisis':             'Análisis',
    'derivaciones-cierres': 'Derivaciones',
    'individual':           'Individual',
    'familiar':             'Familiar',
    'pareja':               'Pareja',
    'prediagnostico':       'Prediagnóstico',
    'analisis-clinicos':    'Análisis clínicos',
    'cuestionarios':        'Cuestionarios',
    'impresiones':          'Impresiones clínicas',
  }

  const activeGroup = esencialTabIds.includes(activeTab) ? 'AVI-Esencial' : 'AVI-Clínico'

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">

      {/* ── Móvil: fila superior (← Mis pacientes + ☰ Nav) ── */}
      <div className="md:hidden flex items-center justify-between mb-1">
        <button
          onClick={() => router.push('/therapist/patients')}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          ← Mis pacientes
        </button>
        <button
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-1 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg px-2 py-1 hover:bg-primary-50 transition-colors"
        >
          <Menu size={12} />
          Nav
        </button>
      </div>

      {/* ── Móvil: breadcrumb sección activa ── */}
      <p className="md:hidden text-[11px] text-gray-400 mb-3">
        <span className="font-semibold text-gray-600">{activeGroup}</span>
        {' / '}
        {TAB_LABELS[activeTab]}
      </p>

      {/* ── Móvil: Analizar caso (antes del nombre) ── */}
      <div className="md:hidden mb-4">
        <button
          onClick={requestAnalysis}
          disabled={analyzing || !savedNote.trim()}
          title={!savedNote.trim() ? 'Primero agrega una nota inicial' : ''}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl
                     font-semibold text-sm hover:bg-primary-700 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {analyzing
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Analizando...</>
            : '🔍 Analizar caso'}
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button onClick={() => router.push('/therapist/patients')}
            className="hidden md:flex text-sm text-gray-400 hover:text-gray-600 mb-2 items-center gap-1">
            ← Mis pacientes
          </button>

          {/* Nombre editable */}
          {isEditingName ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setIsEditingName(false) }}
                autoFocus
                className="text-2xl font-bold text-gray-800 border-b-2 border-primary-400 outline-none bg-transparent w-64"
              />
              <button
                onClick={saveName}
                disabled={savingName || !editingName.trim()}
                className="text-sm px-3 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40"
              >
                {savingName ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                onClick={() => setIsEditingName(false)}
                className="text-sm px-3 py-1 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-800">{profile?.full_name ?? '...'}</h1>
              {profile && (
                <button
                  onClick={() => { setEditingName(profile.full_name ?? ''); setIsEditingName(true) }}
                  title="Editar nombre"
                  className="text-gray-300 hover:text-primary-500 transition-colors text-base leading-none"
                >
                  ✏️
                </button>
              )}
            </div>
          )}

          <p className="text-sm text-gray-400">{profile?.email}</p>
          {/* Empresa CONVENIO — editable */}
          {editingEmpresa ? (
            <div className="flex items-center gap-2 mt-1">
              <select
                value={selectedEmpresaId}
                onChange={e => setSelectedEmpresaId(e.target.value)}
                className="text-xs border border-purple-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white text-gray-700"
              >
                <option value="">Sin empresa</option>
                {empresasList.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
              <button
                onClick={saveEmpresa}
                disabled={savingEmpresa}
                className="text-xs px-2.5 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {savingEmpresa ? '…' : 'Guardar'}
              </button>
              <button
                onClick={() => { setEditingEmpresa(false); setSelectedEmpresaId(empresaId ?? '') }}
                className="text-xs px-2.5 py-1 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-1">
              {empresaNombre ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-100 rounded-full px-2.5 py-0.5">
                  🏢 {empresaNombre}
                </span>
              ) : null}
              <button
                onClick={() => setEditingEmpresa(true)}
                title={empresaNombre ? 'Cambiar empresa' : 'Asignar empresa'}
                className="text-gray-300 hover:text-purple-500 transition-colors text-xs leading-none"
              >
                {empresaNombre ? '✏️' : '＋ empresa'}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={requestAnalysis}
          disabled={analyzing || !savedNote.trim()}
          title={!savedNote.trim() ? 'Primero agrega una nota inicial' : ''}
          className="hidden md:flex items-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-xl
                     font-semibold text-sm hover:bg-primary-700 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {analyzing
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Analizando...</>
            : '🔍 Analizar caso'}
        </button>
      </div>

      {/* ── Layout dos columnas: Sidebar + Contenido ── */}
      <div className="flex mt-4 md:mt-6">

        {/* ── Sidebar EHR (solo desktop) ── */}
        <aside className="hidden md:block w-48 shrink-0 border-r border-gray-100 self-start sticky top-4 pb-8">

          {/* AVI-Esencial */}
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 pt-1 pb-1.5">AVI-Esencial</p>
          {esencialItems.map(item => navItem(item))}

          {/* Separador */}
          <div className="border-t border-gray-100 mx-3 my-2.5" />

          {/* AVI-Clínico */}
          <div className="flex items-center gap-1.5 px-3 pb-1.5">
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${!isClinico ? 'text-gray-300' : 'text-gray-400'}`}>AVI-Clínico</p>
            {!isClinico && <Lock size={10} className="text-gray-300" />}
          </div>
          {clinicoItems.map(item => navItem({ ...item, dim: item.dim || !isClinico }))}
          {!isClinico && (
            <p className="text-[10px] text-gray-300 px-3 pt-1 leading-relaxed">
              Disponible en plan Clínico
            </p>
          )}
        </aside>

        {/* ── Área de contenido ── */}
        <main className="flex-1 min-w-0 pl-0 md:pl-6 space-y-4">

      {/* ── TAB: Datos Generales ── */}
      {activeTab === 'datos-generales' && therapistId && (
        <DatosGeneralesTab
          patientId={patientId}
          therapistId={therapistId}
          patientEmail={profile?.email ?? null}
          initialData={expedienteRow}
        />
      )}

      {/* ── TAB: Tipo de caso ── */}
      {activeTab === 'tipo-caso' && therapistId && (
        <TipoCasoTab
          patientId={patientId}
          therapistId={therapistId}
          onTipoCasoSaved={(nuevoTipo) =>
            setExpedienteRow(prev => prev ? { ...prev, tipo_caso: nuevoTipo } : prev)
          }
        />
      )}

      {/* ── TAB: Sesiones AVI ── */}
      {activeTab === 'sesiones' && (
        <div className="space-y-4">
          {patterns.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">💬</p>
              <p>Este paciente aún no tiene sesiones registradas con AVI.</p>
            </div>
          ) : patterns.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {new Date(p.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {p.crisis_detected && (
                  <span className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full font-medium">⚠️ Crisis detectada</span>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{p.summary}</p>
              {p.predominant_emotions?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {p.predominant_emotions.map((e, i) => (
                    <span key={i} className="text-xs bg-calm-50 text-calm-700 px-3 py-1 rounded-full">{e}</span>
                  ))}
                </div>
              )}
              {p.emotional_patterns?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {p.emotional_patterns.map((e, i) => (
                    <span key={i} className="text-xs bg-primary-50 text-primary-700 px-3 py-1 rounded-full">{e}</span>
                  ))}
                </div>
              )}
              {p.reformulation && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-600 font-medium mb-1">Reformulación AVI</p>
                  <p className="text-sm text-amber-800 italic">"{p.reformulation}"</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: Sesiones Presenciales ── */}
      {activeTab === 'presenciales' && (
        <div className="space-y-6">

          {/* Formulario nueva sesión / edición */}
          {puedeAgregarSesion && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <h3 className="font-semibold text-gray-800">
                {editingSessionId
                  ? `Editando Sesión ${sessionNotes.find(s => s.id === editingSessionId)?.session_number}`
                  : `Nueva Sesión Presencial ${sessionNotes.length + 1}`}
              </h3>

              <div className="flex gap-4 flex-wrap items-end">
                <div className="space-y-1 flex-1 min-w-[160px]">
                  <label className="text-xs font-medium text-gray-500">Fecha de la sesión</label>
                  <input
                    type="date"
                    value={newSessionDate}
                    onChange={e => setNewSessionDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer pb-2 select-none">
                  <input
                    type="checkbox"
                    checked={newSessionProBono}
                    onChange={e => setNewSessionProBono(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary-600"
                  />
                  <span className="text-sm text-gray-600">Pro-bono</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer pb-2 select-none">
                  <input
                    type="checkbox"
                    checked={newSessionIsVirtual}
                    onChange={e => setNewSessionIsVirtual(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary-600"
                  />
                  <span className="text-sm text-gray-600">Virtual</span>
                </label>
              </div>

              {/* 1. Objetivo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">
                  1. Objetivo de la sesión / Seguimiento
                </label>
                <textarea
                  value={newSessionObjetivo}
                  onChange={e => setNewSessionObjetivo(e.target.value)}
                  placeholder="¿Qué se busca lograr en esta sesión? (máx. ~30 palabras)"
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
                />
              </div>

              {/* 2. Desarrollo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">
                  2. Desarrollo de la sesión / Intervención realizada
                </label>
                <textarea
                  value={newSessionDesarrollo}
                  onChange={e => setNewSessionDesarrollo(e.target.value)}
                  placeholder="Describe el desarrollo de la sesión: temas abordados, dinámica, técnicas aplicadas, reacciones del paciente..."
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
                />
              </div>

              {/* 3. Observaciones particulares */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">
                  3. Observaciones particulares / Acuerdos / Tareas
                </label>
                <textarea
                  value={newSessionNotes}
                  onChange={e => setNewSessionNotes(e.target.value)}
                  placeholder="Este apartado no puede quedar en blanco; es importante que contenga información para que pueda ser guardada la sesión"
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
                />
              </div>

              {/* 4. Emociones identificadas */}
              <div className="space-y-2 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <label className="text-xs font-semibold text-gray-600">
                    4. Emociones identificadas
                  </label>
                  <button
                    type="button"
                    onClick={generarEmociones}
                    disabled={generandoEmociones || !newSessionDesarrollo.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                               bg-violet-50 text-violet-700 border border-violet-200
                               hover:bg-violet-100 transition-colors
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {generandoEmociones
                      ? <><span className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin inline-block" /> Generando…</>
                      : '✨ Generar emociones identificadas'}
                  </button>
                </div>
                <textarea
                  value={newSessionEmociones}
                  onChange={e => setNewSessionEmociones(e.target.value)}
                  placeholder="Presiona 'Generar emociones identificadas' para que AVI analice el desarrollo de la sesión, o escribe directamente aquí."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-violet-300 leading-relaxed resize-none"
                />
              </div>

              {/* 5. Recursos personales */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <label className="text-xs font-semibold text-gray-600">
                    5. Recursos personales del paciente
                  </label>
                  <button
                    type="button"
                    onClick={generarRecursos}
                    disabled={generandoRecursos || !newSessionNotes.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                               bg-teal-50 text-teal-700 border border-teal-200
                               hover:bg-teal-100 transition-colors
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {generandoRecursos
                      ? <><span className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin inline-block" /> Generando…</>
                      : '✨ Generar recursos personales'}
                  </button>
                </div>
                <textarea
                  value={newSessionRecursos}
                  onChange={e => setNewSessionRecursos(e.target.value)}
                  placeholder="Presiona 'Generar recursos personales' para que AVI identifique los recursos del paciente, o escribe directamente aquí."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-teal-300 leading-relaxed resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end">
                {editingSessionId && (
                  <button
                    onClick={() => { setEditingSessionId(null); setNewSessionNotes(''); setNewSessionEmociones(''); setNewSessionRecursos(''); setNewSessionDate(hoyMX()) }}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={saveSessionNote}
                  disabled={savingSession || !hayContenidoNuevaSesion}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold
                             hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingSession ? 'Guardando...' : editingSessionId ? 'Actualizar sesión' : 'Guardar sesión'}
                </button>
              </div>
            </div>
          )}

          {/* Límite alcanzado */}
          {sessionNotes.length >= MAX_SESIONES_PRESENCIALES && !editingSessionId && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-700">
              Has alcanzado el límite de {MAX_SESIONES_PRESENCIALES} sesiones presenciales. Para continuar el seguimiento, considera generar un nuevo análisis de caso.
            </div>
          )}

          {/* Listado de sesiones */}
          {sessionNotes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p>Aún no hay sesiones presenciales registradas.</p>
              <p className="text-sm mt-1">Agrega las notas de cada sesión que tengas con el paciente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessionNotes.map(s => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-bold bg-primary-100 text-primary-700 px-3 py-1 rounded-full">
                        Sesión {s.session_number}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(s.session_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
                      </span>
                      {s.is_pro_bono && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pro-bono</span>
                      )}
                      {s.is_virtual && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Virtual</span>
                      )}
                    </div>
                    <button
                      onClick={() => startEdit(s)}
                      className="text-xs text-primary-600 hover:text-primary-800 transition-colors"
                    >
                      Editar
                    </button>
                  </div>
                  <div className="space-y-4">
                    {s.session_objetivo && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Objetivo de la sesión / Seguimiento</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{s.session_objetivo}</p>
                      </div>
                    )}
                    {s.session_desarrollo && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Desarrollo de la sesión / Intervención realizada</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{s.session_desarrollo}</p>
                      </div>
                    )}
                    {s.notes && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observaciones particulares / Acuerdos / Tareas</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{s.notes}</p>
                      </div>
                    )}
                    {s.session_emociones && (
                      <div>
                        <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-1">Emociones identificadas</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{s.session_emociones}</p>
                      </div>
                    )}
                    {s.session_recursos && (
                      <div>
                        <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">Recursos personales del paciente</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{s.session_recursos}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Análisis ── */}
      {activeTab === 'analisis' && (
        <div className="space-y-4">
          {analysisError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-sm text-red-700 flex justify-between items-start gap-2">
              <span>⚠️ {analysisError}</span>
              <button onClick={() => setAnalysisError(null)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {(analyzing || streamText) && (
            <div className="bg-white rounded-2xl border border-primary-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                {analyzing && <span className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />}
                <h3 className="font-semibold text-primary-700">
                  {analyzing ? 'Generando análisis clínico... (puede tardar 1-2 minutos)' : '✓ Análisis completado'}
                </h3>
              </div>
              <div
                className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: streamText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
              />
              <div ref={streamRef} />
            </div>
          )}

          {analyses.length === 0 && !streamText && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🔍</p>
              <p className="mb-2">No hay análisis generados aún.</p>
              <p className="text-sm">
                {!savedNote.trim()
                  ? 'Primero agrega una nota inicial en la pestaña "Nota inicial".'
                  : 'Presiona "Analizar caso" para generar el análisis clínico completo.'}
              </p>
            </div>
          )}

          {analyses.length > 0 && !streamText && analyses.map((a, i) => (
            <details key={a.id} open={i === 0}>
              <summary className="cursor-pointer bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between hover:border-primary-200 transition-colors list-none">
                <div>
                  <span className="font-medium text-gray-800">
                    🔍 Análisis clínico
                  </span>
                  <span className="text-xs text-gray-400 ml-3">
                    {new Date(a.created_at).toLocaleDateString('es-MX', {
                      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <span className="text-gray-400">▾</span>
              </summary>
              <div className="bg-white border border-t-0 border-gray-100 rounded-b-2xl p-6">
                <div
                  className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: a.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                />
              </div>
            </details>
          ))}
        </div>
      )}

      {/* ── TAB: Nota inicial ── */}
      {activeTab === 'nota' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Nota inicial integrada</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Completa los cuatro apartados de la Nota Inicial. Toda la información aquí registrada
              se usa como base del análisis clínico de Consúltame.
            </p>
          </div>

          {/* Fecha + Pro-bono + Virtual */}
          <div className="flex gap-4 flex-wrap items-end">
            <div className="space-y-1 flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-gray-500">Fecha de la consulta inicial</label>
              <input
                type="date"
                value={initialNoteDate}
                onChange={e => setInitialNoteDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-2 select-none">
              <input
                type="checkbox"
                checked={initialNoteProBono}
                onChange={e => setInitialNoteProBono(e.target.checked)}
                className="w-4 h-4 rounded accent-primary-600"
              />
              <span className="text-sm text-gray-600">Pro-bono</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer pb-2 select-none">
              <input
                type="checkbox"
                checked={initialNoteVirtual}
                onChange={e => setInitialNoteVirtual(e.target.checked)}
                className="w-4 h-4 rounded accent-primary-600"
              />
              <span className="text-sm text-gray-600">Virtual</span>
            </label>
          </div>

          {/* ── Sprint 4 IX — Frecuencia de las sesiones ── */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">Frecuencia de las sesiones</p>
              <p className="text-xs text-gray-400 mt-0.5">Cadencia acordada con el asesorado o paciente.</p>
            </div>
            <select
              value={frecuenciaConfig}
              onChange={e => setFrecuenciaConfig(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 transition bg-white"
            >
              <option value="">— Sin definir</option>
              <option value="semanal">Semanal</option>
              <option value="cada_2_semanas">Cada 2 semanas</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>

          {/* ── Sprint 4 VIII — Sensación inicial del paciente ── */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">Sensación inicial del paciente</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                Al comenzar la Sesión Inicial pregúntale a tu asesorado o paciente: <em>"Del 1 al 10 me puedes decir por favor ¿Cómo te sientes en este momento?, donde 1 es pésimo (muy muy mal), y 10 es excelente."</em>
              </p>
            </div>
            <select
              value={sensacionPaciente}
              onChange={e => setSensacionPaciente(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 transition bg-white"
            >
              <option value="0">— (n/a)</option>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
          </div>

          {/* 1. Desarrollo del caso */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                1. Desarrollo del caso
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Resumen de lo que nos platica el paciente: datos generales, contexto familiar, historia relevante.
              </p>
            </div>
            <textarea
              value={initialNote}
              onChange={e => setInitialNote(e.target.value)}
              placeholder="Nombre, edad, estado civil, ocupación, composición familiar. Resumen de lo que el paciente relató en la primera consulta..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
            />
          </div>

          {/* 2. Motivo de consulta del paciente */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                2. Motivo de consulta del paciente
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Lo que el paciente dice que lo trajo a consulta, en sus propias palabras o parafraseado.
              </p>
            </div>
            <textarea
              value={initialNoteMotivo}
              onChange={e => setInitialNoteMotivo(e.target.value)}
              placeholder="&quot;Vine porque...&quot; — el problema o situación que el paciente identifica como la razón de buscar ayuda."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
            />
          </div>

          {/* 3. Motivo de consulta subyacente */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                3. Motivo de consulta subyacente
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Lo que como Asesor o Terapeuta observas que realmente está ocurriendo — más allá de lo que el paciente presenta.
              </p>
            </div>
            <textarea
              value={initialNoteSubyacente}
              onChange={e => setInitialNoteSubyacente(e.target.value)}
              placeholder="Observación clínica: el problema real que subyace al motivo declarado por el paciente (herida de apego, patrón relacional, dinámica familiar, etc.)."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
            />
          </div>

          {/* 4. Premisas ante el motivo de consulta */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                4. Premisas ante el motivo de consulta
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                ¿Por qué consideras que se da el problema subyacente? Preferentemente define 3 premisas.
              </p>
            </div>
            <textarea
              value={initialNotePremisas}
              onChange={e => setInitialNotePremisas(e.target.value)}
              placeholder="Premisa 1: ...&#10;Premisa 2: ...&#10;Premisa 3: ..."
              rows={5}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
            />
          </div>

          {/* 5. Factores de riesgo y protección */}
          <div className="pt-2">
            <p className="text-sm font-semibold text-gray-700">
              5. Factores de riesgo y protección
            </p>
          </div>

          {/* ── Sprint 4 VIII — Factores de Riesgo y Protección (formato FamiliarTab) ── */}
          {(() => {
            const IND_RIESGO = [
              { key: 'posicion_rigida',          titulo: 'Posición rígida en el sistema',     desc: 'Chivo expiatorio, héroe, cuidador parental.' },
              { key: 'corte_emocional',          titulo: 'Corte emocional',                    desc: 'Ruptura significativa con la familia de origen.' },
              { key: 'patron_transgeneracional', titulo: 'Patrón transgeneracional repetido',  desc: 'Lealtad a un guion familiar disfuncional.' },
              { key: 'aislamiento_relacional',   titulo: 'Aislamiento relacional',             desc: 'Ausencia de red de apoyo significativa.' },
              { key: 'indiferenciacion',         titulo: 'Indiferenciación de sí mismo',       desc: 'Incapacidad de tener pensamientos, sentimientos, valores y decisiones propias, distintas de las de su familia o pareja.' },
              { key: 'homeostasis_individual',   titulo: 'Homeostasis individual',             desc: 'El síntoma protege al sistema de un cambio mayor.' },
            ]
            const IND_PROTECCION = [
              { key: 'claridad_limites',         titulo: 'Claridad de límites',                desc: 'Capacidad de mantener distancia emocional adecuada sin fusionarse ni aislarse.' },
              { key: 'diferenciacion_self',      titulo: 'Diferenciación de mí mismo (del self)', desc: 'Distinguir los propios pensamientos y emociones de los de los demás.' },
              { key: 'capacidad_introspeccion',  titulo: 'Capacidad de introspección',         desc: 'Reflexionar sobre sí mismo y evaluarse de forma honesta para mejorar.' },
              { key: 'autonomia',                titulo: 'Autonomía',                           desc: 'Mantener distancia emocional y física de las fuentes de estrés sin aislarse.' },
              { key: 'habilidad_relacionarse',   titulo: 'Habilidad para relacionarse',        desc: 'Establecer vínculos íntimos equilibrando las propias necesidades con las del otro.' },
            ]
            const FAM_RIESGO = [
              { key: 'limites_difusos',           titulo: 'Límites difusos o rígidos',              desc: 'Familias aglutinadas (donde no hay individualidad ni privacidad) o familias desligadas (donde hay desapego extremo y falta de apoyo).' },
              { key: 'triangulacion',             titulo: 'Triangulación',                           desc: 'Involucrar a un tercero (frecuentemente un hijo) para desviar el conflicto entre dos miembros (generalmente la pareja).' },
              { key: 'parentificacion',           titulo: 'Parentificación',                         desc: 'Inversión de roles donde un hijo asume responsabilidades parentales, emocionales o económicas que no corresponden a su edad.' },
              { key: 'comunicacion_patologica',   titulo: 'Comunicación patológica',                 desc: 'Presencia de dobles mensajes (mensajes contradictorios), descalificaciones continuas o secretos familiares disfuncionales.' },
              { key: 'rigidez_homeostatica',      titulo: 'Rigidez homeostática',                    desc: 'Incapacidad del sistema para cambiar y adaptarse a las nuevas etapas del ciclo vital (ej. tratar a un adolescente como si fuera un niño pequeño).' },
              { key: 'alianzas_destructivas',     titulo: 'Alianzas e interacciones destructivas',   desc: 'Coaliciones (unión de dos miembros contra un tercero) que rompen las jerarquías naturales de la familia.' },
              { key: 'ciclo_vital_no_resuelto',   titulo: 'Ciclo vital no resuelto',                 desc: 'Dificultades para transitar etapas evolutivas (nido vacío, adolescencia, jubilación).' },
              { key: 'lealtades_invisibles',      titulo: 'Lealtades invisibles',                    desc: 'Mandatos transgeneracionales no cuestionados.' },
              { key: 'delegacion_sintoma',        titulo: 'Delegación del síntoma',                  desc: 'Un miembro (identificado como paciente) porta el conflicto de todo el sistema.' },
            ]
            const FAM_PROTECCION = [
              { key: 'limites_claros',            titulo: 'Límites claros y flexibles',              desc: 'Reglas comprensibles que definen los roles de cada uno, permitiendo la cercanía emocional sin perder la autonomía individual.' },
              { key: 'cohesion_familiar',         titulo: 'Cohesión familiar',                       desc: 'Sentimiento de pertenencia, afecto mutuo y apoyo emocional disponible entre los miembros del grupo.' },
              { key: 'comunicacion_asertiva',     titulo: 'Comunicación asertiva y abierta',         desc: 'Capacidad para expresar emociones, resolver conflictos de forma directa y validar los puntos de vista de los demás.' },
              { key: 'flexibilidad',              titulo: 'Flexibilidad y adaptabilidad',             desc: 'Capacidad del sistema para reorganizar sus reglas, roles y jerarquías ante crisis o cambios del entorno.' },
              { key: 'jerarquia_parental',        titulo: 'Jerarquía parental clara',                desc: 'Figuras de autoridad (padres/cuidadores) coordinadas, que actúan de mutuo acuerdo y ejercen un liderazgo nutridor.' },
              { key: 'redes_apoyo',               titulo: 'Redes de apoyo externas',                 desc: 'Conexiones saludables con la familia extensa, la escuela, amigos o la comunidad que sostienen al sistema familiar.' },
            ]

            const PAR_RIESGO = [
              { key: 'escalada_simetrica',      titulo: 'Escalada simétrica',                 desc: 'Ambos escalan en intensidad sin ceder.' },
              { key: 'complementariedad_rigida', titulo: 'Complementariedad rígida',           desc: 'Uno siempre persigue, el otro siempre se distancia.' },
              { key: 'triangulacion_pareja',     titulo: 'Triangulación con hijos, familiares o terceros', desc: 'Involucrar a un tercero (frecuentemente un hijo) para desviar el conflicto entre los miembros de la pareja.' },
              { key: 'fronteras_difusas',        titulo: 'Fronteras difusas con familias de origen', desc: 'Intromisión parental.' },
              { key: 'perdida_rituales',         titulo: 'Pérdida de rituales de pareja',      desc: 'Desconexión emocional y sexual.' },
              { key: 'ciclo_vital_no_negociado', titulo: 'Ciclo vital no negociado',           desc: 'Transiciones (convivencia, hijos, nido vacío) sin renegociación de acuerdos.' },
              { key: 'lealtades_divididas',      titulo: 'Lealtades divididas',                desc: 'Conflicto entre pareja y familia de origen.' },
              { key: 'homeostasis_conflictiva',  titulo: 'Homeostasis conflictiva',            desc: 'El conflicto crónico como forma de mantenerse unidos.' },
            ]
            const PAR_PROTECCION = [
              { key: 'motivacion_mutua',         titulo: 'Motivación mutua de cambio',         desc: 'Ambos miembros comprometidos con mejorar la relación.' },
              { key: 'cohesion_pareja',          titulo: 'Cohesión de pareja',                 desc: 'Vínculo emocional y sentido de unidad entre ambos.' },
              { key: 'responsabilidad_compartida', titulo: 'Responsabilidad compartida',       desc: 'Disposición a asumir responsabilidades conjuntas.' },
              { key: 'capacidad_reflexiva',      titulo: 'Capacidad reflexiva',                desc: 'Habilidad de ambos para pensar sobre sus patrones e interacciones.' },
              { key: 'apoyo_socioeconomico',     titulo: 'Apoyo socioeconómico',               desc: 'Recursos externos que amortiguan el estrés de la relación.' },
            ]

            function toggleInd(
              setter: React.Dispatch<React.SetStateAction<{ individual: string[]; familiar: string[]; pareja: string[] }>>,
              key: string
            ) {
              setter(prev => ({
                ...prev,
                individual: prev.individual.includes(key)
                  ? prev.individual.filter(x => x !== key)
                  : [...prev.individual, key],
              }))
            }
            function toggleFam(
              setter: React.Dispatch<React.SetStateAction<{ individual: string[]; familiar: string[]; pareja: string[] }>>,
              key: string
            ) {
              setter(prev => ({
                ...prev,
                familiar: prev.familiar.includes(key)
                  ? prev.familiar.filter(x => x !== key)
                  : [...prev.familiar, key],
              }))
            }
            function togglePar(
              setter: React.Dispatch<React.SetStateAction<{ individual: string[]; familiar: string[]; pareja: string[] }>>,
              key: string
            ) {
              setter(prev => ({
                ...prev,
                pareja: prev.pareja.includes(key)
                  ? prev.pareja.filter(x => x !== key)
                  : [...prev.pareja, key],
              }))
            }

            return (
              <div className={`space-y-5${!tfsActive ? ' opacity-50 pointer-events-none select-none' : ''}`}>
                {/* Header acordeón TFS */}
                <button
                  type="button"
                  onClick={() => setOpenTFS(v => !v)}
                  className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-1 hover:text-gray-600 transition-colors"
                >
                  <span>{tfsActive ? '✅ ' : ''}Terapia Familiar Sistémica</span>
                  <svg className={`w-3.5 h-3.5 transition-transform ${openTFS ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>

                {openTFS && <>
                {/* ── INDIVIDUAL ── */}
                <div className={`space-y-3${!tipoIndActive ? ' opacity-50 pointer-events-none select-none' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenIndividual(v => !v)}
                    className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-primary-500 pb-0.5 hover:text-primary-700 transition-colors"
                  >
                    <span>{tipoIndActive ? '✅ ' : ''}Individual</span>
                    <svg className={`w-3 h-3 transition-transform ${openIndividual ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {openIndividual && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Riesgo Individual */}
                    <div>
                      <p className="text-xs font-semibold mb-3 text-red-500">Factores de Riesgo</p>
                      <div className="space-y-3">
                        {IND_RIESGO.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresRiesgo.individual.includes(f.key)}
                              onChange={() => toggleInd(setFactoresRiesgo, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#ef4444' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    {/* Protección Individual */}
                    <div>
                      <p className="text-xs font-semibold mb-3 text-emerald-600">Factores de Protección</p>
                      <div className="space-y-3">
                        {IND_PROTECCION.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresProteccion.individual.includes(f.key)}
                              onChange={() => toggleInd(setFactoresProteccion, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#059669' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* ── FAMILIAR ── */}
                <div className={`space-y-3 pt-4 border-t border-gray-100${!tipoFamActive ? ' opacity-50 pointer-events-none select-none' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenFamiliar(v => !v)}
                    className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-primary-500 pb-0.5 hover:text-primary-700 transition-colors"
                  >
                    <span>{tipoFamActive ? '✅ ' : ''}Familiar</span>
                    <svg className={`w-3 h-3 transition-transform ${openFamiliar ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {openFamiliar && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Riesgo Familiar */}
                    <div>
                      <p className="text-xs font-semibold mb-3 text-red-500">Factores de Riesgo</p>
                      <div className="space-y-3">
                        {FAM_RIESGO.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresRiesgo.familiar.includes(f.key)}
                              onChange={() => toggleFam(setFactoresRiesgo, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#ef4444' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    {/* Protección Familiar */}
                    <div>
                      <p className="text-xs font-semibold mb-3 text-emerald-600">Factores de Protección</p>
                      <div className="space-y-3">
                        {FAM_PROTECCION.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresProteccion.familiar.includes(f.key)}
                              onChange={() => toggleFam(setFactoresProteccion, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#059669' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* ── PAREJA ── */}
                <div className={`space-y-3 pt-4 border-t border-gray-100${!tipoParActive ? ' opacity-50 pointer-events-none select-none' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenPareja(v => !v)}
                    className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-primary-500 pb-0.5 hover:text-primary-700 transition-colors"
                  >
                    <span>{tipoParActive ? '✅ ' : ''}Pareja</span>
                    <svg className={`w-3 h-3 transition-transform ${openPareja ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {openPareja && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Riesgo Pareja */}
                    <div>
                      <p className="text-xs font-semibold mb-3 text-red-500">Factores de Riesgo</p>
                      <div className="space-y-3">
                        {PAR_RIESGO.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresRiesgo.pareja.includes(f.key)}
                              onChange={() => togglePar(setFactoresRiesgo, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#ef4444' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    {/* Protección Pareja */}
                    <div>
                      <p className="text-xs font-semibold mb-3 text-emerald-600">Factores de Protección</p>
                      <div className="space-y-3">
                        {PAR_PROTECCION.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresProteccion.pareja.includes(f.key)}
                              onChange={() => togglePar(setFactoresProteccion, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#059669' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}
                </div>
                </>}
              </div>
            )
          })()}

          {/* ── BLOQUE TREC ── */}
          {(() => {
            // ── INDIVIDUAL ──
            const IND_RIESGO_TREC = [
              { key: 'pensamiento_dicotomico',      titulo: 'Pensamiento dicotómico / Distorsiones cognitivas', desc: '"Todo o nada", "siempre/nunca", catastrofización.' },
              { key: 'baja_tolerancia_frustracion', titulo: 'Baja tolerancia a la frustración',                desc: 'Incapacidad de tolerar la incomodidad sin recurrir a conductas evitativas o impulsivas.' },
              { key: 'irracionalidad_creencias',    titulo: 'Irracionalidad de las creencias nucleares',       desc: 'Adherencia rígida a "debo…", "tengo que…", "es terrible que…"' },
              { key: 'exigencias_absolutistas',     titulo: 'Exigencias absolutistas (musturbation)',          desc: 'Reglas absolutas aplicadas a uno mismo, a los demás o al mundo.' },
              { key: 'autocondenacion',             titulo: 'Autocondenación',                                 desc: 'Condenarse como persona total por errores específicos.' },
              { key: 'baja_autoeficacia',           titulo: 'Baja autoeficacia percibida',                    desc: 'Creencia de no poder manejar la adversidad o el malestar emocional.' },
              { key: 'conductas_evitacion',         titulo: 'Conductas de evitación y seguridad',             desc: 'Evitar situaciones que generan malestar, lo que refuerza la creencia irracional.' },
            ]
            const IND_PROTECCION_TREC = [
              { key: 'flexibilidad_cognitiva',      titulo: 'Flexibilidad cognitiva',         desc: 'Capacidad de cuestionar y reformular creencias rígidas.' },
              { key: 'alta_tolerancia_frustracion', titulo: 'Alta tolerancia a la frustración', desc: 'Aceptar la incomodidad como parte natural de la vida.' },
              { key: 'autocompasion_funcional',     titulo: 'Autocompasión funcional',         desc: 'Distinguir conducta (evaluable) de valía global como persona.' },
              { key: 'capacidad_debate_racional',   titulo: 'Capacidad de debate racional',    desc: 'Habilidad para aplicar el debate socrático a las propias creencias.' },
              { key: 'orientacion_problema',        titulo: 'Orientación al problema',         desc: 'Enfoque en soluciones más que en la culpa o el resentimiento.' },
            ]
            // ── FAMILIAR ──
            const FAM_RIESGO_TREC = [
              { key: 'creencias_fam_disfuncionales', titulo: 'Sistema de creencias familiares disfuncionales', desc: 'Reglas implícitas del tipo "en esta familia nunca se muestra debilidad."' },
              { key: 'refuerzo_irracionalidad',      titulo: 'Refuerzo familiar de la irracionalidad',         desc: 'La familia valida o alimenta las creencias irracionales del paciente.' },
              { key: 'exigencia_parental',           titulo: 'Alta exigencia parental / perfeccionismo',        desc: 'Estándares excesivamente altos transmitidos como expectativas incondicionales.' },
              { key: 'invalidacion_emocional',       titulo: 'Invalidación emocional crónica',                 desc: 'Mensajes reiterados de que las emociones del paciente son exageradas o incorrectas.' },
              { key: 'modelos_baja_tolerancia',      titulo: 'Modelos de rol con baja tolerancia a la frustración', desc: 'Padres o cuidadores que modelan reacciones catastróficas o evitativas.' },
              { key: 'estigma_familiar',             titulo: 'Estigma familiar hacia la terapia o las emociones', desc: 'Creencia de que buscar ayuda o expresar emociones es signo de debilidad.' },
            ]
            const FAM_PROTECCION_TREC = [
              { key: 'clima_cuestionamiento',        titulo: 'Clima familiar de cuestionamiento racional', desc: 'Conversaciones abiertas donde se debaten creencias e ideas.' },
              { key: 'modelos_autorregulacion',      titulo: 'Modelos parentales de autorregulación',      desc: 'Cuidadores que demuestran manejo emocional y resolución de problemas.' },
              { key: 'apoyo_proceso_terapeutico',    titulo: 'Apoyo familiar ante el proceso terapéutico', desc: 'La familia refuerza la asistencia y los cambios trabajados en terapia.' },
              { key: 'flexibilidad_reglas_fam',      titulo: 'Flexibilidad en las reglas familiares',      desc: 'Capacidad de revisar y actualizar normas y expectativas según el contexto.' },
            ]
            // ── PAREJA ──
            const PAR_RIESGO_TREC = [
              { key: 'exigencias_absolutistas_par',  titulo: 'Exigencias absolutistas en la relación',         desc: '"Mi pareja debe…" o "la relación tiene que…" aplicados de forma rígida.' },
              { key: 'intolerancia_imperfeccion',    titulo: 'Intolerancia a la imperfección del otro',         desc: 'Baja tolerancia a los errores, limitaciones o diferencias de la pareja.' },
              { key: 'catastrofizacion_conflictos',  titulo: 'Catastrofización de conflictos',                  desc: 'Interpretar cada desacuerdo como el fin de la relación o como insoportable.' },
              { key: 'culpabilizacion_mutua',        titulo: 'Culpabilización y condenación mutua',             desc: 'Condenar al otro como persona total por conductas específicas.' },
              { key: 'comunicacion_irracional',      titulo: 'Comunicación basada en creencias irracionales',   desc: 'Exigir, agredir pasivamente o evitar el diálogo por miedo al rechazo.' },
              { key: 'baja_tolerancia_compartida',   titulo: 'Baja tolerancia a la frustración compartida',     desc: 'Ninguno tolera el malestar inherente a la negociación y el acuerdo.' },
              { key: 'dependencia_emocional',        titulo: 'Dependencia emocional basada en "necesidades"',   desc: 'Creer que "necesito" al otro para ser feliz o funcionar.' },
            ]
            const PAR_PROTECCION_TREC = [
              { key: 'preferencias_racionales',      titulo: 'Preferencias racionales en la relación',      desc: 'Desear sin exigir; aceptar la imperfección del otro como parte de la relación.' },
              { key: 'disputa_racional_compartida',  titulo: 'Capacidad de disputa racional compartida',    desc: 'Ambos pueden cuestionar sus propias creencias irracionales en el conflicto.' },
              { key: 'compromiso_terapia_pareja',    titulo: 'Compromiso con la terapia de pareja',         desc: 'Disposición de ambos a explorar y cambiar sus patrones cognitivo-conductuales.' },
            ]

            function toggleIndT(
              setter: React.Dispatch<React.SetStateAction<{ individual: string[]; familiar: string[]; pareja: string[] }>>,
              key: string
            ) {
              setter(prev => ({
                ...prev,
                individual: prev.individual.includes(key)
                  ? prev.individual.filter(x => x !== key)
                  : [...prev.individual, key],
              }))
            }
            function toggleFamT(
              setter: React.Dispatch<React.SetStateAction<{ individual: string[]; familiar: string[]; pareja: string[] }>>,
              key: string
            ) {
              setter(prev => ({
                ...prev,
                familiar: prev.familiar.includes(key)
                  ? prev.familiar.filter(x => x !== key)
                  : [...prev.familiar, key],
              }))
            }
            function toggleParT(
              setter: React.Dispatch<React.SetStateAction<{ individual: string[]; familiar: string[]; pareja: string[] }>>,
              key: string
            ) {
              setter(prev => ({
                ...prev,
                pareja: prev.pareja.includes(key)
                  ? prev.pareja.filter(x => x !== key)
                  : [...prev.pareja, key],
              }))
            }

            return (
              <div className={`space-y-5 mt-6 pt-6 border-t border-gray-200${!trecActive ? ' opacity-50 pointer-events-none select-none' : ''}`}>
                {/* Header acordeón TREC */}
                <button
                  type="button"
                  onClick={() => setOpenTREC(v => !v)}
                  className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-1 hover:text-gray-600 transition-colors"
                >
                  <span>{trecActive ? '✅ ' : ''}Terapia Racional Emotivo Conductual (TREC)</span>
                  <svg className={`w-3.5 h-3.5 transition-transform ${openTREC ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>

                {openTREC && <>
                {/* ── INDIVIDUAL ── */}
                <div className={`space-y-3${!tipoIndActive ? ' opacity-50 pointer-events-none select-none' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenIndividual(v => !v)}
                    className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-primary-500 pb-0.5 hover:text-primary-700 transition-colors"
                  >
                    <span>{tipoIndActive ? '✅ ' : ''}Individual</span>
                    <svg className={`w-3 h-3 transition-transform ${openIndividual ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {openIndividual && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold mb-3 text-red-500">Factores de Riesgo</p>
                      <div className="space-y-3">
                        {IND_RIESGO_TREC.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresRiesgoTREC.individual.includes(f.key)}
                              onChange={() => toggleIndT(setFactoresRiesgoTREC, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#ef4444' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-3 text-emerald-600">Factores de Protección</p>
                      <div className="space-y-3">
                        {IND_PROTECCION_TREC.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresProteccionTREC.individual.includes(f.key)}
                              onChange={() => toggleIndT(setFactoresProteccionTREC, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#059669' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* ── FAMILIAR ── */}
                <div className={`space-y-3 pt-4 border-t border-gray-100${!tipoFamActive ? ' opacity-50 pointer-events-none select-none' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenFamiliar(v => !v)}
                    className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-primary-500 pb-0.5 hover:text-primary-700 transition-colors"
                  >
                    <span>{tipoFamActive ? '✅ ' : ''}Familiar</span>
                    <svg className={`w-3 h-3 transition-transform ${openFamiliar ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {openFamiliar && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold mb-3 text-red-500">Factores de Riesgo</p>
                      <div className="space-y-3">
                        {FAM_RIESGO_TREC.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresRiesgoTREC.familiar.includes(f.key)}
                              onChange={() => toggleFamT(setFactoresRiesgoTREC, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#ef4444' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-3 text-emerald-600">Factores de Protección</p>
                      <div className="space-y-3">
                        {FAM_PROTECCION_TREC.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresProteccionTREC.familiar.includes(f.key)}
                              onChange={() => toggleFamT(setFactoresProteccionTREC, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#059669' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* ── PAREJA ── */}
                <div className={`space-y-3 pt-4 border-t border-gray-100${!tipoParActive ? ' opacity-50 pointer-events-none select-none' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenPareja(v => !v)}
                    className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-primary-500 pb-0.5 hover:text-primary-700 transition-colors"
                  >
                    <span>{tipoParActive ? '✅ ' : ''}Pareja</span>
                    <svg className={`w-3 h-3 transition-transform ${openPareja ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {openPareja && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold mb-3 text-red-500">Factores de Riesgo</p>
                      <div className="space-y-3">
                        {PAR_RIESGO_TREC.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresRiesgoTREC.pareja.includes(f.key)}
                              onChange={() => toggleParT(setFactoresRiesgoTREC, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#ef4444' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-3 text-emerald-600">Factores de Protección</p>
                      <div className="space-y-3">
                        {PAR_PROTECCION_TREC.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresProteccionTREC.pareja.includes(f.key)}
                              onChange={() => toggleParT(setFactoresProteccionTREC, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#059669' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}
                </div>
                </>}
              </div>
            )
          })()}

          {/* ── BLOQUE TCC ── */}
          {(() => {
            // ── INDIVIDUAL ──
            const IND_RIESGO_TCC = [
              { key: 'creencias_centrales_dis',    titulo: 'Creencias centrales disfuncionales',  desc: 'Ideas profundas y rígidas sobre uno mismo ("no valgo", "soy incapaz"), sobre los demás ("nadie es confiable") y sobre el mundo ("todo es peligroso").' },
              { key: 'distorsiones_cognitivas_tcc', titulo: 'Distorsiones cognitivas',            desc: 'Pensamientos automáticos erróneos: catastrofización, pensamiento dicotómico (todo o nada), lectura de mente, sobregeneralización.' },
              { key: 'deficit_habilidades',         titulo: 'Déficit de habilidades',             desc: 'Falta de habilidades sociales, de resolución de problemas o de regulación emocional.' },
              { key: 'evitacion_conductual_tcc',    titulo: 'Evitación conductual',               desc: 'Creencia de que no se es capaz de enfrentar situaciones o cambiar.' },
              { key: 'historia_aprendizaje_tcc',    titulo: 'Historia de aprendizaje',            desc: 'Experiencias tempranas de rechazo, crítica excesiva o inconsistencia que moldearon esquemas negativos.' },
              { key: 'sintomas_residuales',         titulo: 'Síntomas residuales',                desc: 'Presencia de síntomas leves persistentes tras un tratamiento, que aumentan el riesgo de recaída.' },
              { key: 'comorbilidad',                titulo: 'Comorbilidad',                       desc: 'Presencia simultánea de dos o más trastornos (ej. ansiedad y depresión) que complican el cuadro.' },
              { key: 'rigidez_cognitiva_tcc',       titulo: 'Rigidez cognitiva',                  desc: 'Dificultad para modificar creencias incluso ante evidencia contradictoria.' },
              { key: 'perfeccionismo_tcc',          titulo: 'Perfeccionismo',                     desc: 'Estándares excesivamente altos que generan frustración crónica y autoexigencia.' },
            ]
            const IND_PROTECCION_TCC = [
              { key: 'reestructuracion_cognitiva',   titulo: 'Capacidad de reestructuración cognitiva', desc: 'Identificar, evaluar y modificar pensamientos automáticos y creencias disfuncionales.' },
              { key: 'resolucion_problemas_tcc',     titulo: 'Habilidades de resolución de problemas',  desc: 'Analizar dificultades y generar soluciones de forma sistemática.' },
              { key: 'activacion_conductual_tcc',    titulo: 'Activación conductual',                   desc: 'Aumentar actividades positivas para mejorar el estado de ánimo.' },
              { key: 'automonitoreo_tcc',            titulo: 'Automonitoreo',                           desc: 'Observar y registrar los propios patrones de pensamiento, emoción y conducta.' },
              { key: 'repertorio_afrontamiento_tcc', titulo: 'Repertorio de afrontamiento',             desc: 'Contar con estrategias concretas para manejar situaciones de estrés.' },
            ]
            // ── FAMILIAR ──
            const FAM_RIESGO_TCC = [
              { key: 'alto_conflicto_fam_tcc',      titulo: 'Alto conflicto familiar',               desc: 'Discusiones frecuentes, hostilidad y tensión constante que generan estrés crónico en todos los miembros.' },
              { key: 'critica_culpa_parental',       titulo: 'Crítica y culpa parental',              desc: 'Padres que señalan constantemente los errores de los hijos, fomentando creencias de incapacidad y baja autoestima.' },
              { key: 'baja_cohesion_fam_tcc',        titulo: 'Baja cohesión familiar',               desc: 'Falta de apoyo emocional, desconexión entre miembros, cada uno "por su lado".' },
              { key: 'comunicacion_dis_fam_tcc',     titulo: 'Comunicación disfuncional',            desc: 'Mensajes contradictorios, dobles vínculos, falta de escucha activa, expresiones de emoción inadecuadas.' },
              { key: 'crianza_inconsistente',        titulo: 'Estilos de crianza inconsistentes',    desc: 'Alternar entre permisividad y autoritarismo, sin normas claras ni consecuencias predecibles.' },
              { key: 'modelamiento_desadaptativo',   titulo: 'Modelamiento de conductas desadaptativas', desc: 'Padres que muestran evitación, agresividad o desregulación emocional como forma de afrontamiento.' },
              { key: 'sobreproteccion_tcc',          titulo: 'Sobreprotección',                      desc: 'Impedir que los hijos enfrenten retos, lo que refuerza creencias de incapacidad y baja autoeficacia.' },
              { key: 'parentalizacion_tcc',          titulo: 'Parentalización',                      desc: 'Hijos que asumen roles de cuidado o sostén emocional que no les corresponden.' },
              { key: 'rigidez_roles_tcc',            titulo: 'Rigidez de roles',                     desc: 'Cada miembro atrapado en un papel fijo (chivo expiatorio, héroe, cuidador) sin posibilidad de cambio.' },
              { key: 'secretos_prohibidos_tcc',      titulo: 'Secretos y temas prohibidos',          desc: 'Información oculta o temas que no se pueden hablar, generando desconfianza y ansiedad.' },
              { key: 'expectativas_irreales_fam_tcc', titulo: 'Expectativas irreales',               desc: 'Demandas familiares que no coinciden con las capacidades o deseos del miembro.' },
              { key: 'falta_limites_tcc',            titulo: 'Falta de límites claros',              desc: 'Confusión entre subsistemas (conyugal, parental, filial), invasión de espacios y funciones.' },
            ]
            const FAM_PROTECCION_TCC = [
              { key: 'reestructuracion_cog_fam',    titulo: 'Capacidad de reestructuración cognitiva', desc: 'Identificar, evaluar y modificar pensamientos automáticos y creencias disfuncionales.' },
              { key: 'resolucion_prob_fam_tcc',     titulo: 'Habilidades de resolución de problemas',  desc: 'Analizar dificultades y generar soluciones de forma sistemática.' },
              { key: 'activacion_cond_fam_tcc',     titulo: 'Activación conductual',                   desc: 'Aumentar actividades positivas para mejorar el estado de ánimo.' },
              { key: 'automonitoreo_fam_tcc',       titulo: 'Automonitoreo',                           desc: 'Observar y registrar los propios patrones de pensamiento, emoción y conducta.' },
              { key: 'repertorio_afron_fam_tcc',    titulo: 'Repertorio de afrontamiento',             desc: 'Contar con estrategias concretas para manejar situaciones de estrés.' },
            ]
            // ── PAREJA ──
            const PAR_RIESGO_TCC = [
              { key: 'atribuciones_negativas',       titulo: 'Atribuciones negativas',              desc: 'Interpretar el comportamiento del otro como intencionalmente malo ("lo hace para molestarme").' },
              { key: 'lectura_mente_par_tcc',        titulo: 'Lectura de mente',                    desc: 'Asumir lo que el otro piensa o siente sin verificar ("sé que ya no me quiere").' },
              { key: 'catastrofizacion_par_tcc',     titulo: 'Catastrofización',                    desc: 'Convertir un problema menor en una crisis ("si llegó tarde, seguro me está engañando").' },
              { key: 'expectativas_irreales_par_tcc', titulo: 'Expectativas irreales',              desc: 'Creencias como "debería saber lo que necesito sin que se lo diga" o "el amor verdadero no tiene conflictos".' },
              { key: 'comunicacion_dis_par_tcc',     titulo: 'Comunicación disfuncional',           desc: 'Expresiones indirectas, sarcasmo, críticas constantes, falta de escucha, interrupciones.' },
              { key: 'ciclos_conflicto',             titulo: 'Ciclos de conflicto',                 desc: 'Patrón repetitivo: queja → defensa → crítica → desprecio → evitación o escalada.' },
              { key: 'evitacion_conflicto_par',      titulo: 'Evitación del conflicto',             desc: 'No hablar de temas importantes por miedo a la pelea, acumulando resentimiento.' },
              { key: 'falta_neg_par_tcc',            titulo: 'Falta de habilidades de negociación', desc: 'No saber llegar a acuerdos, ceder siempre o imponer siempre.' },
              { key: 'dependencia_emocional_par_tcc', titulo: 'Dependencia emocional',             desc: 'Uno de los miembros necesita constantemente validación y presencia del otro para sentirse bien.' },
              { key: 'celos_control',                titulo: 'Celos y control',                     desc: 'Conductas de vigilancia, prohibiciones o revisión que reflejan creencias de inseguridad y desconfianza.' },
              { key: 'descalificacion_mutua',        titulo: 'Descalificación mutua',               desc: 'Costumbre de menospreciar los sentimientos, opiniones o logros del otro.' },
              { key: 'desequilibrio_poder',          titulo: 'Desequilibrio de poder',              desc: 'Uno domina y el otro se somete, generando resentimiento y distancia emocional.' },
              { key: 'historia_aprendizaje_rel_tcc', titulo: 'Historia de aprendizaje relacional',  desc: 'Patrones aprendidos en familias de origen que se repiten en la relación actual.' },
              { key: 'falta_reforzamiento',          titulo: 'Falta de reforzamiento positivo',     desc: 'Poca expresión de afecto, gratitud o reconocimiento hacia el otro.' },
            ]
            const PAR_PROTECCION_TCC = [
              { key: 'ambiente_colaborativo',        titulo: 'Ambiente colaborativo',               desc: 'Ver el conflicto como "nuestro problema" y no como "yo contra ti".' },
              { key: 'tareas_interaccion_pos',       titulo: 'Tareas conductuales de interacción positiva', desc: 'Ejercicios estructurados de interacción positiva (como "días de amor").' },
              { key: 'entrenamiento_comunicacion',   titulo: 'Entrenamiento en comunicación',       desc: 'Aprender a expresar y escuchar, comprendiendo cómo los pensamientos automáticos interfieren.' },
              { key: 'identificacion_pa_par',        titulo: 'Identificación y modificación de pensamientos automáticos', desc: 'Detectar y cuestionar pensamientos negativos en situaciones de conflicto.' },
              { key: 'estrategias_conjuntas',        titulo: 'Estrategias conjuntas de resolución de problemas', desc: 'Aprender un método sistemático para resolver dificultades.' },
              { key: 'ajuste_creencias_par',         titulo: 'Ajuste del sistema de creencias',    desc: 'Identificar y modificar creencias rígidas y supuestos centrales sobre la relación.' },
              { key: 'prevencion_recaidas_par',      titulo: 'Prevención de recaídas',              desc: 'Anticipar problemas futuros y elaborar planes de afrontamiento.' },
            ]

            function toggleIndC(
              setter: React.Dispatch<React.SetStateAction<{ individual: string[]; familiar: string[]; pareja: string[] }>>,
              key: string
            ) {
              setter(prev => ({
                ...prev,
                individual: prev.individual.includes(key)
                  ? prev.individual.filter(x => x !== key)
                  : [...prev.individual, key],
              }))
            }
            function toggleFamC(
              setter: React.Dispatch<React.SetStateAction<{ individual: string[]; familiar: string[]; pareja: string[] }>>,
              key: string
            ) {
              setter(prev => ({
                ...prev,
                familiar: prev.familiar.includes(key)
                  ? prev.familiar.filter(x => x !== key)
                  : [...prev.familiar, key],
              }))
            }
            function toggleParC(
              setter: React.Dispatch<React.SetStateAction<{ individual: string[]; familiar: string[]; pareja: string[] }>>,
              key: string
            ) {
              setter(prev => ({
                ...prev,
                pareja: prev.pareja.includes(key)
                  ? prev.pareja.filter(x => x !== key)
                  : [...prev.pareja, key],
              }))
            }

            return (
              <div className={`space-y-5 mt-6 pt-6 border-t border-gray-200${!tccActive ? ' opacity-50 pointer-events-none select-none' : ''}`}>
                {/* Header acordeón TCC */}
                <button
                  type="button"
                  onClick={() => setOpenTCC(v => !v)}
                  className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-1 hover:text-gray-600 transition-colors"
                >
                  <span>{tccActive ? '✅ ' : ''}Terapia Cognitivo-Conductual (TCC)</span>
                  <svg className={`w-3.5 h-3.5 transition-transform ${openTCC ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>

                {openTCC && <>
                {/* ── INDIVIDUAL ── */}
                <div className={`space-y-3${!tipoIndActive ? ' opacity-50 pointer-events-none select-none' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenIndividual(v => !v)}
                    className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-primary-500 pb-0.5 hover:text-primary-700 transition-colors"
                  >
                    <span>{tipoIndActive ? '✅ ' : ''}Individual</span>
                    <svg className={`w-3 h-3 transition-transform ${openIndividual ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {openIndividual && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold mb-3 text-red-500">Factores de Riesgo</p>
                      <div className="space-y-3">
                        {IND_RIESGO_TCC.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresRiesgoTCC.individual.includes(f.key)}
                              onChange={() => toggleIndC(setFactoresRiesgoTCC, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#ef4444' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-3 text-emerald-600">Factores de Protección</p>
                      <div className="space-y-3">
                        {IND_PROTECCION_TCC.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresProteccionTCC.individual.includes(f.key)}
                              onChange={() => toggleIndC(setFactoresProteccionTCC, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#059669' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* ── FAMILIAR ── */}
                <div className={`space-y-3 pt-4 border-t border-gray-100${!tipoFamActive ? ' opacity-50 pointer-events-none select-none' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenFamiliar(v => !v)}
                    className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-primary-500 pb-0.5 hover:text-primary-700 transition-colors"
                  >
                    <span>{tipoFamActive ? '✅ ' : ''}Familiar</span>
                    <svg className={`w-3 h-3 transition-transform ${openFamiliar ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {openFamiliar && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold mb-3 text-red-500">Factores de Riesgo</p>
                      <div className="space-y-3">
                        {FAM_RIESGO_TCC.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresRiesgoTCC.familiar.includes(f.key)}
                              onChange={() => toggleFamC(setFactoresRiesgoTCC, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#ef4444' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-3 text-emerald-600">Factores de Protección</p>
                      <div className="space-y-3">
                        {FAM_PROTECCION_TCC.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresProteccionTCC.familiar.includes(f.key)}
                              onChange={() => toggleFamC(setFactoresProteccionTCC, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#059669' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* ── PAREJA ── */}
                <div className={`space-y-3 pt-4 border-t border-gray-100${!tipoParActive ? ' opacity-50 pointer-events-none select-none' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenPareja(v => !v)}
                    className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-primary-500 pb-0.5 hover:text-primary-700 transition-colors"
                  >
                    <span>{tipoParActive ? '✅ ' : ''}Pareja</span>
                    <svg className={`w-3 h-3 transition-transform ${openPareja ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {openPareja && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold mb-3 text-red-500">Factores de Riesgo</p>
                      <div className="space-y-3">
                        {PAR_RIESGO_TCC.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresRiesgoTCC.pareja.includes(f.key)}
                              onChange={() => toggleParC(setFactoresRiesgoTCC, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#ef4444' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-3 text-emerald-600">Factores de Protección</p>
                      <div className="space-y-3">
                        {PAR_PROTECCION_TCC.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresProteccionTCC.pareja.includes(f.key)}
                              onChange={() => toggleParC(setFactoresProteccionTCC, f.key)}
                              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                              style={{ accentColor: '#059669' }}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}
                </div>
                </>}
              </div>
            )
          })()}

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {savedNote.trim() ? '✓ Nota guardada — disponible para el análisis' : '⚠️ Sin nota — el análisis no puede generarse'}
            </p>
            <button
              onClick={saveNote}
              disabled={savingNote || !noteChanged}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold
                         hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingNote ? 'Guardando...' : noteSaved ? '✓ Guardado' : 'Guardar nota'}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: Derivaciones y Cierres ── */}
      {activeTab === 'derivaciones-cierres' && therapistId && (
        <DerivacionesCierresTab
          patientId={patientId}
          therapistId={therapistId}
        />
      )}

      {/* ── AVI-CLÍNICO tabs (controlados por el sidebar) ── */}
      {clinicoTabIds.includes(activeTab) && therapistId && isClinico && (
        <ExpedienteTab
          patientId={patientId}
          therapistId={therapistId}
          patientEmail={profile?.email ?? null}
          patientName={profile?.full_name ?? null}
          controlledSubTab={activeTab as 'individual' | 'familiar' | 'pareja' | 'prediagnostico' | 'analisis-clinicos' | 'cuestionarios' | 'impresiones'}
        />
      )}

        </main>
      </div>

      {/* ── M3 Bottom Sheet (solo móvil) ── */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSheetOpen(false)}
          />
          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto shadow-xl">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* AVI-Esencial */}
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-5 pb-2 pt-1">AVI-Esencial</p>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              {esencialItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setSheetOpen(false) }}
                  className={[
                    'flex items-center gap-2.5 p-3 rounded-xl border text-left transition-colors',
                    activeTab === item.id
                      ? 'bg-primary-50 border-primary-200 text-primary-700'
                      : 'border-gray-100 text-gray-600 active:bg-gray-50',
                  ].join(' ')}
                >
                  <item.Icon size={16} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-tight">{item.label}</p>
                    {item.badge !== undefined && item.badge !== 0 && item.badge !== '' && (
                      <p className="text-[10px] text-primary-600 font-semibold mt-0.5">{item.badge}</p>
                    )}
                  </div>
                  {item.alert && <AlertTriangle size={11} className="shrink-0 text-amber-500" />}
                </button>
              ))}
            </div>

            {/* Separador */}
            <div className="border-t border-gray-100 mx-4 mb-3" />

            {/* AVI-Clínico */}
            <div className="flex items-center gap-1.5 px-5 pb-2">
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${!isClinico ? 'text-gray-300' : 'text-gray-400'}`}>AVI-Clínico</p>
              {!isClinico && <Lock size={10} className="text-gray-300" />}
            </div>
            {!isClinico && (
              <p className="text-[10px] text-gray-300 px-5 pb-2 leading-relaxed">Disponible en plan Clínico</p>
            )}
            <div className="grid grid-cols-2 gap-2 px-4 pb-10">
              {clinicoItems.map(item => {
                const dim = item.dim || !isClinico
                return (
                  <button
                    key={item.id}
                    onClick={() => { if (!dim) { setActiveTab(item.id); setSheetOpen(false) } }}
                    disabled={dim}
                    className={[
                      'flex items-center gap-2.5 p-3 rounded-xl border text-left transition-colors',
                      dim
                        ? 'border-gray-50 bg-gray-50 text-gray-300 cursor-not-allowed'
                        : activeTab === item.id
                          ? 'bg-primary-50 border-primary-200 text-primary-700'
                          : 'border-gray-100 text-gray-600 active:bg-gray-50',
                    ].join(' ')}
                  >
                    <item.Icon size={16} className="shrink-0" />
                    <p className="text-xs font-medium leading-tight flex-1 min-w-0">{item.label}</p>
                    {dim && <Lock size={10} className="shrink-0 text-gray-300" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
