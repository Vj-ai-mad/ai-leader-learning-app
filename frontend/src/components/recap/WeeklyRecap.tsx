import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProgress } from '@/api'
import type { ProgressResponse } from '@/types'

export default function WeeklyRecap() {
  const navigate = useNavigate()
  const [data, setData] = useState<ProgressResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try { setData(await getProgress()) } catch {} finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  // Compute weekly stats
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const allModules = data?.stages.flatMap(s => s.modules) ?? []
  const completedThisWeek = allModules.filter(m => m.completedAt && m.completedAt >= sevenDaysAgo)
  const upcoming = allModules
    .filter(m => !m.completedAt)
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-gray-50 safe-top safe-bottom">
      <header className="flex items-center gap-3 bg-white px-4 py-4 shadow-sm">
        <button onClick={() => navigate('/home')} className="rounded-md p-1 text-gray-600 hover:bg-gray-100" aria-label="Back">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-brand-700">Weekly Recap</h1>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-brand-700">{completedThisWeek.length}</p>
            <p className="text-xs text-gray-500">completed this week</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-brand-700">{data?.streakCount ?? 0}</p>
            <p className="text-xs text-gray-500">day streak</p>
          </div>
        </div>

        {/* Completed this week */}
        {completedThisWeek.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">Completed This Week</h2>
            <ul className="space-y-2">
              {completedThisWeek.map((m) => (
                <li key={m.dayIndex} className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="h-4 w-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Day {m.dayIndex + 1}: {m.title || `Module ${m.dayIndex + 1}`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {completedThisWeek.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center text-sm text-gray-500">
            No modules completed this week yet. Start today!
          </div>
        )}

        {/* Coming up next */}
        {upcoming.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">Coming Up Next</h2>
            <ul className="space-y-2">
              {upcoming.map((m) => (
                <li key={m.dayIndex} className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="h-4 w-4 rounded-full border border-gray-300 flex-shrink-0" />
                  <span>Day {m.dayIndex + 1}: {m.title || `Module ${m.dayIndex + 1}`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
