import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlanStatus } from '@/api'
import { useAuthStore } from '@/store/authStore'

export default function PlanGenerating() {
  const navigate = useNavigate()
  const { setProfile } = useAuthStore()
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const status = await getPlanStatus()

        if (status.planStatus === 'active') {
          clearInterval(poll)
          setProfile({ planStatus: 'active', onboardingComplete: true })
          navigate('/home', { replace: true })
        } else if (status.planStatus === 'error') {
          clearInterval(poll)
          setError('Plan generation failed. Please retry.')
        }
      } catch {
        // Network error — keep polling
      }
    }, 2000)

    return () => clearInterval(poll)
  }, [navigate, setProfile])

  async function handleRetry() {
    setRetrying(true)
    setError('')
    setElapsed(0)

    try {
      // Re-trigger by calling plan/generate — the backend handles idempotency
      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/plan/generate`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      )
      if (!response.ok) throw new Error('Retry failed')
    } catch {
      setError('Retry failed. Please try again.')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        {!error ? (
          <>
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            <h1 className="mt-6 text-xl font-semibold text-brand-700">
              Generating your personalized plan
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Our AI is crafting a learning journey tailored to your role and goals.
              This usually takes 10–15 seconds.
            </p>
            {elapsed > 10 && (
              <p className="mt-3 text-xs text-gray-400">
                Taking a moment longer than usual... ({elapsed}s)
              </p>
            )}
          </>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="mt-6 text-xl font-semibold text-gray-900">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-red-600">{error}</p>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="mt-6 rounded-md bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {retrying ? 'Retrying...' : 'Retry'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
