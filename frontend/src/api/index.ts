/**
 * Typed API wrappers using fetch + Cognito JWT from Amplify session.
 */
import { fetchAuthSession } from 'aws-amplify/auth'
import type { ModuleResponse, ProgressResponse, UserProfile, PlanStatus } from '@/types'

const BASE_URL = import.meta.env.VITE_API_ENDPOINT ?? ''

async function getToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession()
    return session.tokens?.idToken?.toString() ?? null
  } catch {
    return null
  }
}

async function apiCall(path: string, options: RequestInit = {}) {
  const token = await getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {})
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }

  return res.json()
}

// ─── Auth (unauthenticated) ────────────────────────────────────────────────

export async function checkAllowList(email: string, phone: string) {
  const res = await fetch(`${BASE_URL}/auth/check-allowlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, phone })
  })
  return res.json()
}

export async function exchangeDeepLinkToken(token: string) {
  const res = await fetch(`${BASE_URL}/auth/deeplink/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  })
  return res.json()
}

// ─── Onboarding ────────────────────────────────────────────────────────────

export async function submitOnboarding(data: {
  role: string
  responsibilities: string
  careerGoal: string
  dailyMinutes: number
  activeDays: string[]
}): Promise<{ planStatus: PlanStatus }> {
  return apiCall('/onboarding', { method: 'POST', body: JSON.stringify(data) })
}

// ─── Plan ──────────────────────────────────────────────────────────────────

export async function getPlanStatus(): Promise<{
  planStatus: PlanStatus
  currentDayIndex: number
  totalDays: number
}> {
  return apiCall('/plan/status')
}

export async function requestTopic(topic: string): Promise<{
  contentId: string
  title: string
  aiSummary: string
  message: string
}> {
  return apiCall('/plan/request-topic', { method: 'POST', body: JSON.stringify({ topic }) })
}

// ─── Modules ───────────────────────────────────────────────────────────────

export async function getTodayModule(): Promise<ModuleResponse> {
  return apiCall('/module/today')
}

export async function getModule(dayIndex: number): Promise<ModuleResponse> {
  return apiCall(`/module/${dayIndex}`)
}

export async function completeModule(dayIndex: number): Promise<{
  streakCount: number
  currentDayIndex: number
}> {
  return apiCall(`/module/${dayIndex}/complete`, { method: 'POST' })
}

// ─── Progress ──────────────────────────────────────────────────────────────

export async function getProgress(): Promise<ProgressResponse> {
  return apiCall('/progress')
}

export async function setPauseState(paused: boolean) {
  return apiCall('/progress/pause', { method: 'PATCH', body: JSON.stringify({ paused }) })
}

// ─── Profile ───────────────────────────────────────────────────────────────

export async function getProfile(): Promise<UserProfile> {
  return apiCall('/profile')
}

export async function setNotifOptOut(notifOptOut: boolean) {
  return apiCall('/profile/notifications', { method: 'PATCH', body: JSON.stringify({ notifOptOut }) })
}

// ─── Admin ─────────────────────────────────────────────────────────────────

export async function adminListContent() {
  return apiCall('/admin/content')
}

export async function adminUpsertContent(contentId: string, data: Record<string, unknown>) {
  return apiCall(`/admin/content/${contentId}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function adminGenerateSummary(contentId: string) {
  return apiCall(`/admin/content/${contentId}/summarise`, { method: 'POST' })
}

export async function adminListAllowList() {
  return apiCall('/admin/allowlist')
}

export async function adminAddAllowList(value: string, type: 'email' | 'phone', note: string) {
  return apiCall('/admin/allowlist', { method: 'POST', body: JSON.stringify({ value, type, note }) })
}

export async function adminDeleteAllowList(value: string) {
  return apiCall(`/admin/allowlist/${encodeURIComponent(value)}`, { method: 'DELETE' })
}
