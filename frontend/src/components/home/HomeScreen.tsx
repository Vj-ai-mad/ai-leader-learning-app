import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getTodayModule, setPauseState } from '@/api'
import { useAuthStore } from '@/store/authStore'
import type { ModuleResponse } from '@/types'

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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 safe-top safe-bottom">
      {/* Header */}
      <header className="bg-white px-4 py-4 shadow-sm">
        <h1 className="text-lg font-semibold text-brand-700">AI Learning for Leaders</h1>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* Paused state */}
        {planStatus === 'paused' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">Plan Paused</p>
            <p className="mt-1 text-sm text-amber-700">
              Your learning plan is paused. No daily modules or notifications.
            </p>
            <button
              onClick={handleResume}
              className="mt-3 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Resume Plan
            </button>
          </div>
        )}

        {/* Today's module card */}
        {module && planStatus !== 'paused' && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                {module.stageLabel}
              </span>
              <span>Day {module.dayIndex + 1}</span>
            </div>

            <h2 className="mt-3 text-lg font-semibold text-gray-900">
              {module.title}
            </h2>

            <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
              <span>{module.estimatedMinutes} min read</span>
              <span className="capitalize">{module.format}</span>
            </div>

            <button
              onClick={() => navigate(`/module/${module.dayIndex}`)}
              className="mt-4 w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Start Today's Module
            </button>
          </div>
        )}

        {/* Streak */}
        {module && (
          <div className="text-center text-sm text-gray-600">
            {module.completedAt
              ? <span className="text-green-700 font-medium">Today's module complete</span>
              : <span>Complete today's module to build your streak</span>
            }
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Quick nav */}
        <nav className="flex gap-3">
          <Link
            to="/roadmap"
            className="flex-1 rounded-md border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View Roadmap
          </Link>
          <Link
            to="/recap"
            className="flex-1 rounded-md border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Weekly Recap
          </Link>
        </nav>

        {/* Profile link */}
        <div className="text-center">
          <Link to="/profile" className="text-sm text-brand-600 hover:text-brand-500">
            Profile & Settings
          </Link>
        </div>
      </main>
    </div>
  )
}
