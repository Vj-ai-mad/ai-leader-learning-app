import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestTopic, getProgress } from '@/api'
import type { ProgressResponse } from '@/types'
import { STAGE_LABELS } from '@/types'

export default function TopicRequest() {
  const navigate = useNavigate()
  const [plan, setPlan] = useState<ProgressResponse | null>(null)
  const [topics, setTopics] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(0)
  const [error, setError] = useState('')
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [showUpdatedPlan, setShowUpdatedPlan] = useState(false)

  useEffect(() => {
    async function loadPlan() {
      try {
        const data = await getProgress()
        setPlan(data)
      } catch {} finally { setLoadingPlan(false) }
    }
    loadPlan()
  }, [])

  function addField() {
    if (topics.length < 5) setTopics([...topics, ''])
  }

  function updateTopic(index: number, value: string) {
    const updated = [...topics]
    updated[index] = value
    setTopics(updated)
  }

  function removeTopic(index: number) {
    setTopics(topics.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    const validTopics = topics.map(t => t.trim()).filter(t => t.length >= 3)
    if (validTopics.length === 0) {
      navigate('/home', { replace: true })
      return
    }

    setSubmitting(true)
    setError('')

    for (const topic of validTopics) {
      try {
        await requestTopic(topic)
        setSubmitted(prev => prev + 1)
      } catch (err) {
        console.error('Failed to submit topic:', topic, err)
      }
    }

    try {
      const updatedPlan = await getProgress()
      setPlan(updatedPlan)
    } catch {}

    setSubmitting(false)
    setShowUpdatedPlan(true)
  }

  function handleSkip() {
    navigate('/home', { replace: true })
  }

  if (loadingPlan) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  // After topics submitted — show updated plan with custom topics highlighted
  if (showUpdatedPlan && plan) {
    const coreStages = plan.stages.filter(s => s.stageNumber <= 5)
    const customStages = plan.stages.filter(s => s.stageNumber > 5)

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Plan updated!</h1>
            <p className="mt-1 text-sm text-gray-500">
              {plan.totalDays} modules total — your custom topics have been added
            </p>
          </div>

          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Your learning path</p>
            {coreStages.map((stage) => (
              <StageRow key={stage.stageNumber} stage={stage} />
            ))}

            {customStages.length > 0 && (
              <>
                <div className="pt-3 mt-2 border-t border-gray-200">
                  <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">Additional Topics (your requests)</p>
                </div>
                {customStages.flatMap(s => s.modules).map((mod, idx) => (
                  <p key={mod.dayIndex} className="text-sm text-gray-700 py-1 pl-2">
                    {idx + 1}. {mod.title || `Custom module ${idx + 1}`}
                  </p>
                ))}
              </>
            )}
          </div>

          <button
            onClick={() => navigate('/home', { replace: true })}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            Start Learning
          </button>
          <button
            onClick={() => setShowUpdatedPlan(false)}
            className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Add more topics
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Your plan is ready!</h1>
          <p className="mt-1 text-sm text-gray-500">
            {plan?.totalDays ?? 46} modules across 5 stages
          </p>
        </div>

        {plan && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Your learning path</p>
            {plan.stages.map((stage) => (
              <StageRow key={stage.stageNumber} stage={stage} />
            ))}
          </div>
        )}

        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <p className="text-sm font-medium text-gray-900">
            Anything specific you'd like us to cover that's not already included?
          </p>
          <p className="mt-1 text-xs text-gray-500">
            We'll generate custom modules and add them to the end of your plan.
          </p>

          <div className="mt-4 space-y-3">
            {topics.map((topic, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => updateTopic(index, e.target.value)}
                  placeholder="e.g. AI in contract negotiations"
                  maxLength={200}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {topics.length > 1 && (
                  <button
                    onClick={() => removeTopic(index)}
                    className="rounded-md p-1.5 text-gray-400 hover:text-red-500"
                    aria-label="Remove"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            {topics.length < 5 && (
              <button onClick={addField} className="text-sm text-blue-600 hover:text-blue-500">
                + Add another topic
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {submitting && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Generating {submitted}/{topics.filter(t => t.trim().length >= 3).length} topics...
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSkip}
            disabled={submitting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Skip, start learning
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StageRow({ stage }: { stage: { stageNumber: number; totalModules: number; modules: { dayIndex: number; title: string }[] } }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-2 text-left hover:bg-gray-50 rounded-md px-1"
      >
        <span className="text-sm text-gray-700">
          {STAGE_LABELS[stage.stageNumber] ?? `Stage ${stage.stageNumber}`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{stage.totalModules} modules</span>
          <svg className={`h-3.5 w-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="pl-3 pb-2 space-y-1">
          {stage.modules.map((mod, idx) => (
            <p key={mod.dayIndex} className="text-xs text-gray-500 py-0.5">
              {idx + 1}. {mod.title || `Module ${mod.dayIndex + 1}`}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
