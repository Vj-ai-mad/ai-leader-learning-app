import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProgress } from '@/api'
import type { ProgressResponse, StageProgress } from '@/types'
import { STAGE_LABELS } from '@/types'

const STAGE_BG: Record<number, string> = {
  1: 'bg-blue-50 border-blue-200',
  2: 'bg-teal-50 border-teal-200',
  3: 'bg-purple-50 border-purple-200',
  4: 'bg-orange-50 border-orange-200',
  5: 'bg-amber-50 border-amber-200'
}
const STAGE_TEXT: Record<number, string> = {
  1: 'text-blue-700', 2: 'text-teal-700', 3: 'text-purple-700', 4: 'text-orange-700', 5: 'text-amber-700'
}
const STAGE_BAR: Record<number, string> = {
  1: 'bg-blue-500', 2: 'bg-teal-500', 3: 'bg-purple-500', 4: 'bg-orange-500', 5: 'bg-amber-500'
}

export default function RoadmapView() {
  const [data, setData] = useState<ProgressResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedStage, setExpandedStage] = useState<number | null>(1)

  useEffect(() => {
    async function load() {
      try {
        const progress = await getProgress()
        setData(progress)
        const currentStage = progress.stages.find(s =>
          s.modules.some((_m, idx) => {
            const offset = progress.stages.slice(0, progress.stages.indexOf(s)).reduce((sum, st) => sum + st.modules.length, 0)
            return offset + idx === progress.currentDayIndex
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy-700 border-t-transparent" />
      </div>
    )
  }

  if (!data) return <div className="p-6 text-sm text-gray-600">No progress data.</div>

  return (
    <div className="pb-20">
      <header className="bg-navy-700 px-4 py-4">
        <h1 className="text-lg font-bold text-white">Your Roadmap</h1>
      </header>

      <main className="px-4 py-5 space-y-3">
        <div className="rounded-xl bg-white border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-navy-700">
            {data.stages.reduce((s, st) => s + st.completedModules, 0)}/{data.totalDays}
          </p>
          <p className="text-xs text-gray-500">modules completed</p>
          {data.streakCount > 0 && (
            <p className="mt-1 text-xs font-medium text-amber-600">{data.streakCount}-day streak</p>
          )}
        </div>

        {data.stages.map((stage) => {
          const offset = data.stages.slice(0, data.stages.indexOf(stage)).reduce((s, st) => s + st.modules.length, 0)
          return (
            <StageCard
              key={stage.stageNumber}
              stage={stage}
              expanded={expandedStage === stage.stageNumber}
              onToggle={() => setExpandedStage(expandedStage === stage.stageNumber ? null : stage.stageNumber)}
              currentDayIndex={data.currentDayIndex}
              stageOffset={offset}
            />
          )
        })}
      </main>
    </div>
  )
}

function StageCard({ stage, expanded, onToggle, currentDayIndex, stageOffset }: {
  stage: StageProgress; expanded: boolean; onToggle: () => void; currentDayIndex: number; stageOffset: number
}) {
  const pct = stage.totalModules > 0 ? Math.round((stage.completedModules / stage.totalModules) * 100) : 0

  return (
    <div className={`rounded-xl border overflow-hidden ${STAGE_BG[stage.stageNumber] ?? ''}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div>
          <p className={`text-sm font-medium ${STAGE_TEXT[stage.stageNumber] ?? ''}`}>
            {STAGE_LABELS[stage.stageNumber] ?? `Stage ${stage.stageNumber}`}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 w-24 rounded-full bg-white/60">
              <div className={`h-full rounded-full ${STAGE_BAR[stage.stageNumber] ?? ''}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-500">{stage.completedModules}/{stage.totalModules}</span>
          </div>
        </div>
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/40 bg-white/50 px-4 py-2 space-y-1">
          {stage.modules.map((mod, idx) => {
            const globalIdx = stageOffset + idx
            const isCurrent = globalIdx === currentDayIndex
            const isCompleted = !!mod.completedAt
            const isFuture = globalIdx > currentDayIndex

            return (
              <Link
                key={mod.dayIndex}
                to={isCompleted || isCurrent ? `/module/${mod.dayIndex}` : '#'}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  isCurrent ? 'bg-white font-medium text-navy-700 shadow-sm' :
                  isCompleted ? 'text-gray-700 hover:bg-white/70' :
                  'text-gray-400 cursor-default'
                }`}
                onClick={(e) => { if (isFuture) e.preventDefault() }}
              >
                {isCompleted ? (
                  <svg className="h-4 w-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : isCurrent ? (
                  <div className="h-4 w-4 rounded-full border-2 border-navy-700 flex-shrink-0" />
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
