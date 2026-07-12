import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTodayModule, setPauseState } from '@/api'
import { useAuthStore } from '@/store/authStore'
import type { ModuleResponse } from '@/types'

const STAGE_COLORS: Record<number, string> = {
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  2: 'bg-teal-50 text-teal-700 border-teal-200',
  3: 'bg-purple-50 text-purple-700 border-purple-200',
  4: 'bg-orange-50 text-orange-700 border-orange-200',
  5: 'bg-amber-50 text-amber-700 border-amber-200'
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { planStatus, setProfile } = useAuthStore()
  const [module, setModule] = useState<ModuleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await getTodayModule()
        setModule(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load module')
      } finally {
        setLoading(false)
      }
    }
    if (planStatus !== 'paused') load()
    else setLoading(false)
  }, [planStatus])

  async function handleResume() {
    try {
      await setPauseState(false)
      setProfile({ planStatus: 'active' })
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-700 border-t-transparent" />
      </div>
    )
  }

  const stageColor = module ? STAGE_COLORS[module.stageNumber] ?? STAGE_COLORS[1] : ''

  return (
    <div className="pb-20">
      {/* Header */}
      <header className="bg-navy-700 px-4 py-5">
        <h1 className="text-lg font-bold text-white tracking-tight">Helm.</h1>
        <p className="mt-0.5 text-xs text-navy-200">Your AI literacy journey</p>
      </header>

      <main className="px-4 py-5 space-y-5">
        {/* Paused banner */}
        {planStatus === 'paused' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">Plan Paused</p>
            <p className="mt-1 text-xs text-amber-700">
              Your learning is on hold. No modules or notifications until you resume.
            </p>
            <button
              onClick={handleResume}
              className="mt-3 rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white"
            >
              Resume Plan
            </button>
          </div>
        )}

        {/* WhatsApp reminder banner (placeholder — shown when notifications are active) */}
        {module && planStatus !== 'paused' && (
          <div className="rounded-xl border border-green-200 bg-[#e7f5ea] p-3 flex items-center gap-3">
            <div className="flex-shrink-0 rounded-full bg-[#25d366] p-1.5">
              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              </svg>
            </div>
            <p className="text-xs text-green-800">
              Daily reminder arrives at 8:00 AM via WhatsApp
            </p>
          </div>
        )}

        {/* Today's module card */}
        {module && planStatus !== 'paused' && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${stageColor}`}>
                {module.stageLabel}
              </span>
              <span className="text-xs text-gray-400">Day {module.dayIndex + 1}</span>
            </div>

            <h2 className="mt-3 text-base font-semibold text-gray-900 leading-snug">
              {module.title}
            </h2>

            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {module.estimatedMinutes} min
              </span>
              <span className="capitalize">{module.format}</span>
            </div>

            <button
              onClick={() => navigate(`/module/${module.dayIndex}`)}
              className="mt-4 w-full rounded-lg bg-navy-700 px-4 py-3 text-sm font-medium text-white hover:bg-navy-800 transition"
            >
              Start Today's Module
            </button>

            {module.completedAt && (
              <p className="mt-2 text-center text-xs font-medium text-green-600">
                ✓ Completed today
              </p>
            )}
          </div>
        )}

        {/* Streak */}
        {module && !module.completedAt && planStatus !== 'paused' && (
          <p className="text-center text-xs text-gray-500">
            Complete today's module to build your streak
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
      </main>
    </div>
  )
}
