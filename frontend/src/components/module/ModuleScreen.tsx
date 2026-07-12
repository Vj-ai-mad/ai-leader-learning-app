import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getModule, completeModule } from '@/api'
import { queueCompletion } from '@/offline/db'
import type { ModuleResponse } from '@/types'

export default function ModuleScreen() {
  const { dayIndex } = useParams<{ dayIndex: string }>()
  const navigate = useNavigate()
  const [module, setModule] = useState<ModuleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const idx = dayIndex ? parseInt(dayIndex, 10) : undefined
        const data = idx !== undefined ? await getModule(idx) : null
        setModule(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load module')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [dayIndex])

  async function handleMarkDone() {
    if (!module) return
    setCompleting(true)

    try {
      if (!navigator.onLine) {
        // Queue offline
        await queueCompletion(module.dayIndex, 'current-user')
        navigate('/home', { replace: true })
        return
      }

      await completeModule(module.dayIndex)
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark complete')
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!module) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <p className="text-sm text-gray-600">{error || 'Module not found'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => navigate('/home')}
          className="rounded-md p-1 text-gray-600 hover:bg-gray-100"
          aria-label="Back to home"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <span className="text-xs text-gray-500">
            {module.stageLabel} · Day {module.dayIndex + 1}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-xl font-semibold text-gray-900">{module.title}</h1>

        <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
          <span>{module.estimatedMinutes} min</span>
          <span className="capitalize">{module.format}</span>
        </div>

        {/* AI Summary */}
        <article className="mt-6 prose prose-sm prose-gray max-w-none">
          {module.aiSummary.split('\n').map((paragraph, i) => (
            paragraph.trim() ? <p key={i}>{paragraph}</p> : null
          ))}
        </article>

        {/* External resource link */}
        {module.url && !module.url.startsWith('#') && (
          <a
            href={module.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center justify-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 hover:bg-brand-100"
          >
            Read / Watch Original
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}

        {/* Mark as Done */}
        {!module.completedAt && (
          <button
            onClick={handleMarkDone}
            disabled={completing}
            className="mt-6 w-full rounded-md bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {completing ? 'Marking...' : 'Mark as Done'}
          </button>
        )}

        {module.completedAt && (
          <div className="mt-6 rounded-md bg-green-50 p-3 text-center text-sm font-medium text-green-700">
            Completed
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
      </main>
    </div>
  )
}
