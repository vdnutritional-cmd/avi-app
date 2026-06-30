// ─────────────────────────────────────────────────────────────────────────────
// Tipos TypeScript que reflejan el esquema de Supabase
// Generado manualmente — en producción usar: supabase gen types typescript
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'therapist' | 'patient'
export type SessionStatus = 'active' | 'completed'
export type SubscriptionStatus = 'active' | 'free_approved' | 'trialing' | 'cancelled' | 'inactive'
export type SubscriptionPlan = 'paid' | 'free'
export type MessageRole = 'user' | 'assistant'

// ── profiles ──────────────────────────────────────────────────────────────────
export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  email: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// ── subscriptions ─────────────────────────────────────────────────────────────
export interface Subscription {
  id: string
  therapist_id: string
  status: SubscriptionStatus
  plan: SubscriptionPlan
  amount_usd: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

// ── authorization_codes ───────────────────────────────────────────────────────
export interface AuthorizationCode {
  id: string
  code: string
  therapist_id: string
  patient_email: string | null
  used_by: string | null
  used_at: string | null
  expires_at: string
  is_active: boolean
  notes: string | null
  created_at: string
}

// ── therapist_patients ────────────────────────────────────────────────────────
export interface TherapistPatient {
  id: string
  therapist_id: string
  patient_id: string
  authorization_code_id: string | null
  is_active: boolean
  created_at: string
}

// ── sessions ──────────────────────────────────────────────────────────────────
export interface Session {
  id: string
  patient_id: string
  title: string | null
  status: SessionStatus
  started_at: string
  ended_at: string | null
  created_at: string
}

// ── messages ──────────────────────────────────────────────────────────────────
export interface Message {
  id: string
  session_id: string
  role: MessageRole
  content: string
  created_at: string
}

// ── patterns ──────────────────────────────────────────────────────────────────
export interface Pattern {
  id: string
  session_id: string
  patient_id: string
  summary: string | null
  emotional_patterns: string[]
  predominant_emotions: string[]
  reformulation: string | null
  crisis_detected: boolean
  raw_json: Record<string, unknown> | null
  created_at: string
}

// ── crisis_alerts ─────────────────────────────────────────────────────────────
export interface CrisisAlert {
  id: string
  patient_id: string
  session_id: string
  message_id: string | null
  detected_keywords: string[]
  therapist_notified: boolean
  notified_at: string | null
  created_at: string
}

// ── analyses ──────────────────────────────────────────────────────────────────
export interface Analysis {
  id: string
  patient_id: string
  therapist_id: string
  title: string
  content: string
  sessions_analyzed: string[]
  techniques_proposed: string[]
  session_plan: Record<string, unknown>[]
  created_at: string
  updated_at: string
}

// ── tipos compuestos para consultas con joins ─────────────────────────────────
export interface PatientWithProfile extends TherapistPatient {
  patient: Profile
}

export interface SessionWithPattern extends Session {
  patterns: Pattern | null
}

export interface AnalysisWithPatient extends Analysis {
  patient: Profile
}
