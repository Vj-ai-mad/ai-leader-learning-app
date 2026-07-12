/**
 * Typed API wrappers around Amplify REST API calls.
 * All authenticated routes pass the Cognito JWT automatically via Amplify.
 */
import { get, post, put, patch, del } from 'aws-amplify/api'
import type {
  ModuleResponse,
  ProgressResponse,
  UserProfile,
  PlanStatus
} from '@/types'

const API_NAME = 'api'

// ─── Auth (unauthenticated) ────────────────────────────────────────────────

export async function checkAllowList(email: string, phone: string) {
  const { body } = await post({
    apiName: API_NAME,
    path: '/auth/check-allowlist',
    options: { body: { email, phone } as unknown as ReadableStream }
  }).response
  return body.json()
}

export async function exchangeDeepLinkToken(token: string) {
  const { body } = await post({
    apiName: API_NAME,
    path: '/auth/deeplink/exchange',
    options: { body: { token } as unknown as ReadableStream }
  }).response
  return body.json()
}

// ─── Onboarding ────────────────────────────────────────────────────────────

export async function submitOnboarding(data: {
  role: string
  responsibilities: string
  careerGoal: string
  dailyMinutes: number
  activeDays: string[]
}): Promise<{ planStatus: PlanStatus }> {
  const { body } = await post({
    apiName: API_NAME,
    path: '/onboarding',
    options: { body: data as unknown as ReadableStream }
  }).response
  return body.json() as Promise<{ planStatus: PlanStatus }>
}

// ─── Plan ──────────────────────────────────────────────────────────────────

export async function getPlanStatus(): Promise<{
  planStatus: PlanStatus
  currentDayIndex: number
  totalDays: number
}> {
  const { body } = await get({
    apiName: API_NAME,
    path: '/plan/status'
  }).response
  return body.json() as Promise<{ planStatus: PlanStatus; currentDayIndex: number; totalDays: number }>
}

// ─── Modules ───────────────────────────────────────────────────────────────

export async function getTodayModule(): Promise<ModuleResponse> {
  const { body } = await get({ apiName: API_NAME, path: '/module/today' }).response
  return body.json() as Promise<ModuleResponse>
}

export async function getModule(dayIndex: number): Promise<ModuleResponse> {
  const { body } = await get({ apiName: API_NAME, path: `/module/${dayIndex}` }).response
  return body.json() as Promise<ModuleResponse>
}

export async function completeModule(dayIndex: number): Promise<{
  streakCount: number
  currentDayIndex: number
}> {
  const { body } = await post({
    apiName: API_NAME,
    path: `/module/${dayIndex}/complete`,
    options: { body: {} as unknown as ReadableStream }
  }).response
  return body.json() as Promise<{ streakCount: number; currentDayIndex: number }>
}

// ─── Progress ──────────────────────────────────────────────────────────────

export async function getProgress(): Promise<ProgressResponse> {
  const { body } = await get({ apiName: API_NAME, path: '/progress' }).response
  return body.json() as Promise<ProgressResponse>
}

export async function setPauseState(paused: boolean) {
  const { body } = await patch({
    apiName: API_NAME,
    path: '/progress/pause',
    options: { body: { paused } as unknown as ReadableStream }
  }).response
  return body.json()
}

// ─── Profile ───────────────────────────────────────────────────────────────

export async function getProfile(): Promise<UserProfile> {
  const { body } = await get({ apiName: API_NAME, path: '/profile' }).response
  return body.json() as Promise<UserProfile>
}

export async function setNotifOptOut(notifOptOut: boolean) {
  const { body } = await patch({
    apiName: API_NAME,
    path: '/profile/notifications',
    options: { body: { notifOptOut } as unknown as ReadableStream }
  }).response
  return body.json()
}

// ─── Admin ─────────────────────────────────────────────────────────────────

export async function adminListContent() {
  const { body } = await get({ apiName: API_NAME, path: '/admin/content' }).response
  return body.json()
}

export async function adminUpsertContent(contentId: string, data: Record<string, unknown>) {
  const { body } = await put({
    apiName: API_NAME,
    path: `/admin/content/${contentId}`,
    options: { body: data as unknown as ReadableStream }
  }).response
  return body.json()
}

export async function adminGenerateSummary(contentId: string) {
  const { body } = await post({
    apiName: API_NAME,
    path: `/admin/content/${contentId}/summarise`,
    options: { body: {} as unknown as ReadableStream }
  }).response
  return body.json()
}

export async function adminListAllowList() {
  const { body } = await get({ apiName: API_NAME, path: '/admin/allowlist' }).response
  return body.json()
}

export async function adminAddAllowList(value: string, type: 'email' | 'phone', note: string) {
  const { body } = await post({
    apiName: API_NAME,
    path: '/admin/allowlist',
    options: { body: { value, type, note } as unknown as ReadableStream }
  }).response
  return body.json()
}

export async function adminDeleteAllowList(value: string) {
  const { body } = await del({
    apiName: API_NAME,
    path: `/admin/allowlist/${encodeURIComponent(value)}`
  }).response
  return body.json()
}
