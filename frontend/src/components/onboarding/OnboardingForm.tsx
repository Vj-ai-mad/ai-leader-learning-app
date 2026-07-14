import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { submitOnboarding } from '@/api'
import { useAuthStore } from '@/store/authStore'

const ROLES = [
  'Program Manager',
  'Delivery Manager',
  'Platform Lead',
  'RTE / RTM (Release Train Engineer/Manager)',
  'Production Manager',
  'Test Manager / QA Manager',
  'Service Delivery Manager (SDM)',
  'DevOps Engineer',
  'SRE',
  'Other (please specify)'
] as const
const TIME_OPTIONS = [10, 15, 20, 25, 30] as const
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export default function OnboardingForm() {
  const navigate = useNavigate()
  const { setProfile } = useAuthStore()

  const [step, setStep] = useState(1)
  const [role, setRole] = useState('')
  const [otherRole, setOtherRole] = useState('')
  const [responsibilities, setResponsibilities] = useState('')
  const [careerGoal, setCareerGoal] = useState('')
  const [dailyMinutes, setDailyMinutes] = useState(15)
  const [activeDays, setActiveDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function toggleDay(day: string) {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  function canProceed(): boolean {
    if (step === 1) return !!role && (role !== 'Other (please specify)' || otherRole.trim().length >= 2)
    if (step === 4) return activeDays.length > 0
    return true
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)

    try {
      const result = await submitOnboarding({
        role: role === 'Other (please specify)' ? otherRole.trim() : role,
        responsibilities,
        careerGoal,
        dailyMinutes,
        activeDays
      })

      setProfile({ onboardingComplete: true, planStatus: result.planStatus })
      navigate('/onboarding/generating', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="mb-6 flex items-center justify-between">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  s <= step ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s}
              </div>
              {s < 4 && (
                <div className={`mx-2 h-0.5 w-8 ${s < step ? 'bg-brand-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <h1 className="mb-1 text-xl font-semibold text-brand-700">
          {step === 1 && 'What is your role?'}
          {step === 2 && 'Current responsibilities'}
          {step === 3 && 'Your 5-year career goal'}
          {step === 4 && 'Learning schedule'}
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          {step === 1 && 'Select the role that best describes you.'}
          {step === 2 && 'Briefly describe what you currently manage. (Optional)'}
          {step === 3 && 'Where do you want to be in 5 years? (Optional)'}
          {step === 4 && 'How much time can you spend daily, and on which days?'}
        </p>

        {/* Step 1: Role */}
        {step === 1 && (
          <div className="space-y-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`w-full rounded-md border px-4 py-3 text-left text-sm transition ${
                  role === r
                    ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {r}
              </button>
            ))}
            {role === 'Other (please specify)' && (
              <input
                type="text"
                value={otherRole}
                onChange={(e) => setOtherRole(e.target.value)}
                placeholder="Enter your role title"
                className="mt-2 w-full rounded-md border border-gray-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                maxLength={100}
              />
            )}
          </div>
        )}

        {/* Step 2: Responsibilities */}
        {step === 2 && (
          <div>
            <textarea
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value.slice(0, 500))}
              rows={5}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="e.g. I manage a team of 12 across 3 agile teams, handle stakeholder communication, and oversee release planning..."
            />
            <p className="mt-1 text-right text-xs text-gray-400">{responsibilities.length}/500</p>
          </div>
        )}

        {/* Step 3: Career goal */}
        {step === 3 && (
          <div>
            <textarea
              value={careerGoal}
              onChange={(e) => setCareerGoal(e.target.value.slice(0, 500))}
              rows={5}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="e.g. I want to lead AI-driven transformation programs and become a VP of Delivery at a tech-forward org..."
            />
            <p className="mt-1 text-right text-xs text-gray-400">{careerGoal.length}/500</p>
          </div>
        )}

        {/* Step 4: Time + days */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Daily time available
              </label>
              <div className="flex gap-2 flex-wrap">
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDailyMinutes(t)}
                    className={`rounded-md border px-4 py-2 text-sm ${
                      dailyMinutes === t
                        ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {t} min
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Active learning days
              </label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      activeDays.includes(d)
                        ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              disabled={!canProceed()}
              onClick={() => setStep(step + 1)}
              className="rounded-md bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={loading || !canProceed()}
              onClick={handleSubmit}
              className="rounded-md bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Generate My Plan'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
