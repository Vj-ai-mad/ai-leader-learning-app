import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { signIn, confirmSignIn } from 'aws-amplify/auth'
import { useAuthStore } from '@/store/authStore'

type Step = 'username' | 'otp'

export default function SignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const { init } = useAuthStore()

  const verified = (location.state as { verified?: boolean })?.verified

  const [step, setStep] = useState<Step>('username')
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Normalise: if it looks like a phone number, prefix +91
      const loginId = username.includes('@')
        ? username
        : username.startsWith('+')
          ? username
          : `+91${username.replace(/\D/g, '')}`

      const { nextStep } = await signIn({
        username: loginId,
        options: { authFlowType: 'CUSTOM_WITHOUT_SRP' }
      })

      if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE') {
        setStep('otp')
      } else if (nextStep.signInStep === 'DONE') {
        await init()
        navigate('/home', { replace: true })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in failed'
      if (message.includes('UserNotFoundException')) {
        setError('No account found with this email or phone. Try signing up.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { nextStep } = await confirmSignIn({
        challengeResponse: code
      })

      if (nextStep.signInStep === 'DONE') {
        await init()
        navigate('/home', { replace: true })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed'
      if (message.includes('CodeMismatchException')) {
        setError('Invalid code. Please try again.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-2xl font-semibold text-brand-700">
          Welcome Back
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          {step === 'username'
            ? 'Enter your email or phone to receive a sign-in code.'
            : `Enter the code sent to ${username}`}
        </p>

        {verified && step === 'username' && (
          <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
            Account verified. You can now sign in.
          </div>
        )}

        {step === 'username' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Email or Phone Number
              </label>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="you@example.com or 9876543210"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Sending code...' : 'Send Sign-in Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                Verification Code
              </label>
              <input
                id="otp"
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
              {loading ? 'Verifying...' : 'Verify and Sign In'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('username'); setCode(''); setError('') }}
              className="w-full text-sm text-gray-600 hover:text-brand-600"
            >
              Use a different email or phone
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium text-brand-600 hover:text-brand-500">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
