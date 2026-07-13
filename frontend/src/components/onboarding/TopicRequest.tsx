import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestTopic } from '@/api'

export default function TopicRequest() {
  const navigate = useNavigate()
  const [topics, setTopics] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(0)
  const [error, setError] = useState('')

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

    navigate('/home', { replace: true })
  }

  function handleSkip() {
    navigate('/home', { replace: true })
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
          <p className="mt-2 text-sm text-gray-600">
            Anything specific you'd like us to cover that's not already included?
          </p>
        </div>

        <div className="space-y-3">
          {topics.map((topic, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={topic}
                onChange={(e) => updateTopic(index, e.target.value)}
                placeholder="e.g. AI in contract negotiations"
                maxLength={200}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            <button
              onClick={addField}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              + Add another topic
            </button>
          )}
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
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Your topics will be added as extra modules at the end of your plan.
        </p>
      </div>
    </div>
  )
}
