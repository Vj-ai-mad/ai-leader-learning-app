import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { confirmSignUp, resendSignUpCode } from 'aws-amplify/auth'

export default function OtpVerify() {
  const navigate = useNavigate()
  const location = useLocation()
  const { email } = (location.state as { email?: string }) ?? {}

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(60)
  const [resendEnabled, setResendEnabled] = useState(false)

  useEffect(() => {
    if (!email) {
      navigate('/signup', { replace: true })
      return
    }

    const interval = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          setResendEnabled(true)
          clearInterval(interval)
          return 0
        }
        return t - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [email, navigate])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await confirmSignUp({
        username: email!,
        confirmationCode: code
      })
      navigate('/signin', { state: { verified: true } })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed'
      if (message.includes('CodeMismatchException')) {
        setError('Invalid code. Please check and try again.')
      } else if (message.includes('ExpiredCodeException')) {
        setError('Code expired. Please request a new one.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResendEnabled(false)
    setResendTimer(60)

    try {
      await resendSignUpCode({ username: email! })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend code')
    }

    const interval = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          setResendEnabled(true)
          clearInterval(interval)
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-2xl font-semibold text-brand-700">
          Verify Your Account
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          We sent a verification code to <strong>{email}</strong>.
          Enter it below to complete sign-up.
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">
              Verification Code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-center text-lg tracking-widest shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="123456"
              maxLength={6}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          {resendEnabled ? (
            <button
              onClick={handleResend}
              className="font-medium text-brand-600 hover:text-brand-500"
            >
              Resend code
            </button>
          ) : (
            <span>Resend code in {resendTimer}s</span>
          )}
        </div>
      </div>
    </div>
  )
}
