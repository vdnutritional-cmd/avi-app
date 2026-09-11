'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { checkPassword } from '@/lib/password-strength'
import PasswordStrengthBar from '@/components/PasswordStrengthBar'

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Hijo { nombre: string; edad: string; ocupacion: string; vive_en_casa: string }
interface DatosGenerales {
  asesorado_nombre: string; asesorado_sexo: string; asesorado_edad: string
  asesorado_fecha_nacimiento: string; asesorado_lugar_nacimiento: string
  asesorado_estado_civil: string; asesorado_escolaridad: string
  asesorado_ocupacion: string; asesorado_religion: string; asesorado_parroquia: string
  contacto_telefono: string; contacto_domicilio: string
  pareja_nombre: string; pareja_sexo: string; pareja_edad: string; pareja_fecha_nacimiento: string
  hijos: Hijo[]
  salud_padece_enfermedad: string; salud_ayuda_psicologica: string
  salud_ayuda_tiempo: string; salud_medicamentos: string; salud_medicamentos_cual: string
}

const hijoVacio = (): Hijo => ({ nombre: '', edad: '', ocupacion: '', vive_en_casa: '' })

const datosBlancos = (): DatosGenerales => ({
  asesorado_nombre: '', asesorado_sexo: '', asesorado_edad: '',
  asesorado_fecha_nacimiento: '', asesorado_lugar_nacimiento: '',
  asesorado_estado_civil: '', asesorado_escolaridad: '',
  asesorado_ocupacion: '', asesorado_religion: '', asesorado_parroquia: '',
  contacto_telefono: '', contacto_domicilio: '',
  pareja_nombre: '', pareja_sexo: '', pareja_edad: '', pareja_fecha_nacimiento: '',
  hijos: [hijoVacio()],
  salud_padece_enfermedad: '', salud_ayuda_psicologica: '',
  salud_ayuda_tiempo: '', salud_medicamentos: '', salud_medicamentos_cual: '',
})

const STEPS = [
  { id: 'cuenta',    label: 'Cuenta'    },
  { id: 'asesorado', label: 'Asesorado' },
  { id: 'contacto',  label: 'Contacto'  },
  { id: 'pareja',    label: 'Pareja'    },
  { id: 'hijos',     label: 'Hijos'     },
  { id: 'salud',     label: 'Salud'     },
]

// ── Componentes de campo ─────────────────────────────────────────────────────
function Field({ label, children, optional }: { label: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}{optional && <span className="text-gray-400 font-normal text-xs ml-1">(opcional)</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition text-sm bg-white"
const selectCls = inputCls

// ── Formulario principal ─────────────────────────────────────────────────────
function RegistroConsultorioForm() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const token       = searchParams.get('t') ?? ''

  const [therapistName, setTherapistName] = useState<string | null>(null)
  const [tokenInvalido, setTokenInvalido] = useState(false)
  const [step, setStep] = useState(0)

  // Datos de cuenta
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)

  // Datos generales
  const [dg, setDg] = useState<DatosGenerales>(datosBlancos)

  const [error,     setError]     = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [registrado, setRegistrado] = useState(false)

  // Validar token
  useEffect(() => {
    if (!token) { setTokenInvalido(true); return }
    fetch(`/api/auth/registro-consultorio?t=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setTokenInvalido(true); else setTherapistName(d.therapistName) })
      .catch(() => setTokenInvalido(true))
  }, [token])

  function setField(k: keyof DatosGenerales, v: string) {
    setDg(prev => ({ ...prev, [k]: v }))
  }

  function setHijo(idx: number, k: keyof Hijo, v: string) {
    setDg(prev => {
      const hijos = [...prev.hijos]
      hijos[idx] = { ...hijos[idx], [k]: v }
      return { ...prev, hijos }
    })
  }

  function addHijo() {
    if (dg.hijos.length >= 6) return
    setDg(prev => ({ ...prev, hijos: [...prev.hijos, hijoVacio()] }))
  }

  function removeHijo(idx: number) {
    setDg(prev => ({ ...prev, hijos: prev.hijos.filter((_, i) => i !== idx) }))
  }

  // ── Validaciones por paso ────────────────────────────────────────────────
  function validarPasoActual(): string | null {
    if (step === 0) {
      if (!email.includes('@'))    return 'Ingresa un correo válido'
      const pw = checkPassword(password)
      if (!pw.valid) return 'La contraseña no cumple los requisitos: ' + pw.errors.join(', ')
    }
    if (step === 1) {
      if (!dg.asesorado_nombre.trim()) return 'El nombre completo es requerido'
      if (!dg.asesorado_sexo)          return 'Selecciona el sexo'
    }
    return null
  }

  function siguiente() {
    setError(null)
    const err = validarPasoActual()
    if (err) { setError(err); return }
    setStep(s => s + 1)
    window.scrollTo(0, 0)
  }

  function anterior() {
    setError(null)
    setStep(s => s - 1)
    window.scrollTo(0, 0)
  }

  async function handleEnviar() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/registro-consultorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: email.trim().toLowerCase(),
          password,
          datosGenerales: { ...dg, hijos: dg.hijos.filter(h => h.nombre.trim()) },
        }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Error al crear la cuenta'); setLoading(false); return }
      if (body.autoLogin) {
        router.push('/patient/chat')
        router.refresh()
      } else {
        setRegistrado(true)
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setLoading(false)
    }
  }

  // ── Pantallas especiales ─────────────────────────────────────────────────
  if (tokenInvalido) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="text-5xl">🔗</div>
        <h2 className="text-xl font-bold text-gray-800">Código no válido</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Este código de registro no existe. Pide a tu terapeuta que te muestre el QR correcto.
        </p>
        <Link href="/auth/login" className="text-primary-600 text-sm hover:underline">Iniciar sesión</Link>
      </div>
    </div>
  )

  if (therapistName === null) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Verificando código…</p>
    </div>
  )

  if (registrado) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-gray-800">¡Cuenta creada!</h2>
        <p className="text-gray-500 text-sm">Tu cuenta quedó vinculada con <strong>{therapistName}</strong>. Inicia sesión para comenzar.</p>
        <Link href="/auth/login" className="block w-full py-3 bg-primary-600 text-white font-semibold rounded-2xl text-sm">Iniciar sesión</Link>
      </div>
    </div>
  )

  // ── Layout del wizard ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4 py-6">
      <div className="w-full max-w-lg mx-auto space-y-5">

        {/* Encabezado */}
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-primary-700">AVI</Link>
          <p className="text-gray-500 text-xs mt-1">Registro con <strong>{therapistName}</strong></p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-full h-1.5 rounded-full transition-colors ${i <= step ? 'bg-primary-600' : 'bg-gray-200'}`} />
              <span className={`text-[10px] ${i === step ? 'text-primary-700 font-semibold' : 'text-gray-400'}`}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Tarjeta del paso actual */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">

          {/* ── Paso 0: Cuenta ── */}
          {step === 0 && <>
            <h2 className="text-base font-semibold text-gray-800">Datos de tu cuenta</h2>
            <Field label="Correo electrónico">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com" className={inputCls} />
            </Field>
            <Field label="Contraseña">
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  className={inputCls + ' pr-12'} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
              <PasswordStrengthBar password={password} />
            </Field>
          </>}

          {/* ── Paso 1: Asesorado ── */}
          {step === 1 && <>
            <h2 className="text-base font-semibold text-gray-800">Datos del asesorado</h2>
            <Field label="Nombre completo">
              <input type="text" value={dg.asesorado_nombre} onChange={e => setField('asesorado_nombre', e.target.value)}
                placeholder="María González" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sexo">
                <select value={dg.asesorado_sexo} onChange={e => setField('asesorado_sexo', e.target.value)} className={selectCls}>
                  <option value="">Seleccionar</option>
                  <option>Masculino</option><option>Femenino</option><option>Otro</option>
                </select>
              </Field>
              <Field label="Edad">
                <input type="number" min="0" max="120" value={dg.asesorado_edad}
                  onChange={e => setField('asesorado_edad', e.target.value)} placeholder="35" className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha de nacimiento">
                <input type="date" value={dg.asesorado_fecha_nacimiento}
                  onChange={e => setField('asesorado_fecha_nacimiento', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Lugar de nacimiento">
                <input type="text" value={dg.asesorado_lugar_nacimiento}
                  onChange={e => setField('asesorado_lugar_nacimiento', e.target.value)}
                  placeholder="Ciudad, Estado" className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estado civil">
                <select value={dg.asesorado_estado_civil} onChange={e => setField('asesorado_estado_civil', e.target.value)} className={selectCls}>
                  <option value="">Seleccionar</option>
                  {['Soltero/a','Casado/a','Divorciado/a','Viudo/a','Unión libre','Separado/a'].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Escolaridad">
                <select value={dg.asesorado_escolaridad} onChange={e => setField('asesorado_escolaridad', e.target.value)} className={selectCls}>
                  <option value="">Seleccionar</option>
                  {['Primaria','Secundaria','Preparatoria','Técnico','Licenciatura','Maestría','Doctorado','Sin escolaridad'].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Ocupación">
              <input type="text" value={dg.asesorado_ocupacion}
                onChange={e => setField('asesorado_ocupacion', e.target.value)}
                placeholder="Contador, Maestro, Estudiante…" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Religión" optional>
                <input type="text" value={dg.asesorado_religion}
                  onChange={e => setField('asesorado_religion', e.target.value)}
                  placeholder="Católica, Cristiana…" className={inputCls} />
              </Field>
              <Field label="Parroquia" optional>
                <input type="text" value={dg.asesorado_parroquia}
                  onChange={e => setField('asesorado_parroquia', e.target.value)}
                  placeholder="San Juan Bosco…" className={inputCls} />
              </Field>
            </div>
          </>}

          {/* ── Paso 2: Contacto ── */}
          {step === 2 && <>
            <h2 className="text-base font-semibold text-gray-800">Datos de contacto</h2>
            <Field label="Correo electrónico">
              <input type="email" value={email} disabled
                className={inputCls + ' bg-gray-50 text-gray-400 cursor-not-allowed'} />
              <p className="text-xs text-gray-400 mt-1">Tomado de los datos de tu cuenta</p>
            </Field>
            <Field label="Teléfono / WhatsApp">
              <input type="tel" value={dg.contacto_telefono}
                onChange={e => setField('contacto_telefono', e.target.value)}
                placeholder="3312345678" className={inputCls} />
            </Field>
            <Field label="Domicilio" optional>
              <input type="text" value={dg.contacto_domicilio}
                onChange={e => setField('contacto_domicilio', e.target.value)}
                placeholder="Calle, Colonia, Ciudad" className={inputCls} />
            </Field>
          </>}

          {/* ── Paso 3: Pareja ── */}
          {step === 3 && <>
            <h2 className="text-base font-semibold text-gray-800">Datos de la pareja</h2>
            <p className="text-xs text-gray-400">Si no aplica, deja los campos en blanco.</p>
            <Field label="Nombre completo" optional>
              <input type="text" value={dg.pareja_nombre}
                onChange={e => setField('pareja_nombre', e.target.value)}
                placeholder="Nombre de la pareja" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sexo" optional>
                <select value={dg.pareja_sexo} onChange={e => setField('pareja_sexo', e.target.value)} className={selectCls}>
                  <option value="">Seleccionar</option>
                  <option>Masculino</option><option>Femenino</option><option>Otro</option>
                </select>
              </Field>
              <Field label="Edad" optional>
                <input type="number" min="0" max="120" value={dg.pareja_edad}
                  onChange={e => setField('pareja_edad', e.target.value)} placeholder="35" className={inputCls} />
              </Field>
            </div>
            <Field label="Fecha de nacimiento" optional>
              <input type="date" value={dg.pareja_fecha_nacimiento}
                onChange={e => setField('pareja_fecha_nacimiento', e.target.value)} className={inputCls} />
            </Field>
          </>}

          {/* ── Paso 4: Hijos ── */}
          {step === 4 && <>
            <h2 className="text-base font-semibold text-gray-800">Hijos</h2>
            <p className="text-xs text-gray-400">Si no hay hijos, deja la tabla en blanco y continúa.</p>
            <div className="space-y-4">
              {dg.hijos.map((h, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl p-4 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">Hijo {i + 1}</span>
                    {dg.hijos.length > 1 && (
                      <button onClick={() => removeHijo(i)} className="text-xs text-red-400 hover:text-red-600">✕ Quitar</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Nombre">
                      <input type="text" value={h.nombre} onChange={e => setHijo(i, 'nombre', e.target.value)}
                        placeholder="Nombre" className={inputCls} />
                    </Field>
                    <Field label="Edad">
                      <input type="number" min="0" max="100" value={h.edad} onChange={e => setHijo(i, 'edad', e.target.value)}
                        placeholder="12" className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Ocupación">
                      <input type="text" value={h.ocupacion} onChange={e => setHijo(i, 'ocupacion', e.target.value)}
                        placeholder="Estudiante" className={inputCls} />
                    </Field>
                    <Field label="¿Vive en casa?">
                      <select value={h.vive_en_casa} onChange={e => setHijo(i, 'vive_en_casa', e.target.value)} className={selectCls}>
                        <option value="">Seleccionar</option>
                        <option>Sí</option><option>No</option>
                      </select>
                    </Field>
                  </div>
                </div>
              ))}
            </div>
            {dg.hijos.length < 6 && (
              <button onClick={addHijo}
                className="w-full py-2.5 border-2 border-dashed border-gray-300 text-gray-400 rounded-2xl text-sm hover:border-primary-300 hover:text-primary-600 transition-colors">
                + Agregar hijo
              </button>
            )}
          </>}

          {/* ── Paso 5: Salud ── */}
          {step === 5 && <>
            <h2 className="text-base font-semibold text-gray-800">Salud</h2>
            <Field label="¿Padece alguna enfermedad?" optional>
              <input type="text" value={dg.salud_padece_enfermedad}
                onChange={e => setField('salud_padece_enfermedad', e.target.value)}
                placeholder="Diabetes, hipertensión…" className={inputCls} />
            </Field>
            <Field label="¿Ha recibido ayuda psicológica antes?" optional>
              <select value={dg.salud_ayuda_psicologica} onChange={e => setField('salud_ayuda_psicologica', e.target.value)} className={selectCls}>
                <option value="">Seleccionar</option>
                <option>Sí</option><option>No</option>
              </select>
            </Field>
            {dg.salud_ayuda_psicologica === 'Sí' && (
              <Field label="¿Por cuánto tiempo?" optional>
                <input type="text" value={dg.salud_ayuda_tiempo}
                  onChange={e => setField('salud_ayuda_tiempo', e.target.value)}
                  placeholder="6 meses, 1 año…" className={inputCls} />
              </Field>
            )}
            <Field label="¿Toma medicamentos actualmente?" optional>
              <select value={dg.salud_medicamentos} onChange={e => setField('salud_medicamentos', e.target.value)} className={selectCls}>
                <option value="">Seleccionar</option>
                <option>Sí</option><option>No</option>
              </select>
            </Field>
            {dg.salud_medicamentos === 'Sí' && (
              <Field label="¿Cuáles?" optional>
                <input type="text" value={dg.salud_medicamentos_cual}
                  onChange={e => setField('salud_medicamentos_cual', e.target.value)}
                  placeholder="Metformina, Losartán…" className={inputCls} />
              </Field>
            )}
          </>}

          {/* Error */}
          {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
        </div>

        {/* Navegación */}
        <div className="flex gap-3 pb-6">
          {step > 0 && (
            <button onClick={anterior}
              className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors">
              ← Anterior
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={siguiente}
              className="flex-1 py-3 rounded-2xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
              Siguiente →
            </button>
          ) : (
            <button onClick={handleEnviar} disabled={loading}
              className="flex-1 py-3 rounded-2xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50">
              {loading ? 'Creando cuenta…' : '✓ Crear cuenta y entrar a AVI'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RegistroConsultorioPage() {
  return <Suspense><RegistroConsultorioForm /></Suspense>
}
