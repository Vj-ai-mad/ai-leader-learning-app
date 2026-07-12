import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getProgress } from '@/api'
import type { ProgressResponse, StageProgress } from '@/types'
import { STAGE_LABELS } from '@/types'

export default function RoadmapView() {
  const navigate = useNavigate()
  const [data, setData] = useState<ProgressResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedStage, setExpandedStage] = useState<number | null>(1)

  useEffect(() => {
    async function load() {
      try {
        const progress = await getProgress()
        setData(progress)
        // Auto-expand the stage that contains the current module
        const currentStage = progress.stages.find(s =>
          s.modules.some((m, idx) => {
            const globalIdx = progress.stages
              .slice(0, progress.stages.indexOf(s))
              .reduce((sum, st) => sum + st.modules.length, 0) + idx
            return globalIdx === progress.currentDayIndex
          })
        )
        if (currentStage) setExpandedStage(currentStage.stageNumber)
      } catch {} finally { setLoading(false) }
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

  if (!data) return <div className="p-6 text-sm text-gray-600">No progress data available.</div>

  return (
    <div className="min-h-screen bg-gray-50 safe-top safe-bottom">
      <header className="flex items-center gap-3 bg-white px-4 py-4 shadow-sm">
        <button onClick={() => navigate('/home')} className="rounded-md p-1 text-gray-600 hover:bg-gray-100" aria-label="Back">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-brand-700">Your Roadmap</h1>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-3">
        {/* Overall progress */}
        <div className="rounded-lg bg-white border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-brand-700">{data.stages.reduce((s, st) => s + st.completedModules, 0)}/{data.totalDays}</p>
          <p className="text-sm text-gray-500">modules completed</p>
          {data.streakCount > 0 && (
            <p className="mt-1 text-sm text-brand-600">{data.streakCount}-day streak</p>
          )}
        </div>

        {/* Stages */}
        {data.stages.map((stage) => (
          <StageSection
            key={stage.stageNumber}
            stage={stage}
            expanded={expandedStage === stage.stageNumber}
            onToggle={() => setExpandedStage(expandedStage === stage.stageNumber ? null : stage.stageNumber)}
            currentDayIndex={data.currentDayIndex}
            stageOffset={data.stages.slice(0, data.stages.indexOf(stage)).reduce((s, st) => s + st.modules.length, 0)}
          />
        ))}
      </main>
    </div>
  )
}

function StageSection({ stage, expanded, onToggle, currentDayIndex, stageOffset }: {
  stage: StageProgress
  expanded: boolean
  onToggle: () => void
  currentDayIndex: number
  stageOffset: number
}) {
  const pct = stage.totalModules > 0 ? Math.round((stage.completedModules / stage.totalModules) * 100) : 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div>
          <p className="text-sm font-medium text-gray-900">
            {STAGE_LABELS[stage.stageNumber] ?? `Stage ${stage.stageNumber}`}
          </p>
          <p className="text-xs text-gray-500">{stage.completedModules} of {stage.totalModules} complete</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-brand-600">{pct}%</span>
          <svg className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-2 space-y-1">
          {stage.modules.map((mod, idx) => {
            const globalIdx = stageOffset + idx
            const isCurrent = globalIdx === currentDayIndex
            const isCompleted = !!mod.completedAt
            const isFuture = globalIdx > currentDayIndex

            return (
              <Link
                key={mod.dayIndex}
                to={isCompleted || isCurrent ? `/module/${mod.dayIndex}` : '#'}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                  isCurrent ? 'bg-brand-50 font-medium text-brand-700' :
                  isCompleted ? 'text-gray-700 hover:bg-gray-50' :
                  'text-gray-400 cursor-default'
                }`}
                onClick={(e) => { if (isFuture) e.preventDefault() }}
              >
                {/* Status icon */}
                {isCompleted ? (
                  <svg className="h-4 w-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : isCurrent ? (
                  <div className="h-4 w-4 rounded-full border-2 border-brand-500 flex-shrink-0" />
                ) : (
                  <svg className="h-4 w-4 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="truncate">Day {mod.dayIndex + 1}: {mod.title || `Module ${mod.dayIndex + 1}`}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
