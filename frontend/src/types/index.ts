// Shared TypeScript types used across frontend and referenced in API wrappers

export type Role = 'PM' | 'Delivery Manager' | 'Platform Lead' | 'RTE' | 'Other'

export type ContentFormat = 'article' | 'video' | 'podcast' | 'exercise' | 'template'

export type PlanStatus = 'generating' | 'active' | 'paused' | 'completed' | 'error'

export interface UserProfile {
  userId: string
  name: string
  email: string
  phone: string
  role: Role
  responsibilities: string
  careerGoal: string
  dailyMinutes: number
  activeDays: string[]
  onboardingComplete: boolean
  planId?: string
  planStatus: PlanStatus
  currentDayIndex: number
  streakCount: number
  lastCompletionDate?: string
  notifOptOut: boolean
}

export interface DayEntry {
  dayIndex: number
  stageNumber: number
  contentId: string
  aiSummary: string
  completedAt: string | null
}

export interface ModuleResponse {
  dayIndex: number
  stageNumber: number
  stageLabel: string
  contentId: string
  title: string
  url: string
  format: ContentFormat
  estimatedMinutes: number
  aiSummary: string
  completedAt: string | null
}

export interface StageProgress {
  stageNumber: number
  stageLabel: string
  totalModules: number
  completedModules: number
  modules: {
    dayIndex: number
    title: string
    completedAt: string | null
  }[]
}

export interface ProgressResponse {
  planStatus: PlanStatus
  currentDayIndex: number
  totalDays: number
  streakCount: number
  stages: StageProgress[]
}

export const STAGE_LABELS: Record<number, string> = {
  1: 'AI Literacy Foundations',
  2: 'AI in Delivery & Program Management',
  3: 'Leading AI-enabled Initiatives',
  4: 'Governance, Risk & Responsible AI',
  5: 'Becoming the AI-fluent Leader',
  6: 'Additional Topics'
}
