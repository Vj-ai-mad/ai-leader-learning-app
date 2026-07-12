import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { signIn } from 'aws-amplify/auth'
import { useAuthStore } from '@/store/authStore'

export default function SignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const { init } = useAuthStore()

  const verified = (location.state as { verified?: boolean })?.verified

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { nextStep } = await signIn({
        username,
        password
      })

      if (nextStep.signInStep === 'DONE') {
        await init()
        navigate('/home', { replace: true })
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        navigate('/verify', { state: { email: username } })
      } else {
        setError(`Unexpected auth step: ${nextStep.signInStep}`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in failed'
      if (message.includes('UserNotFoundException') || message.includes('NotAuthorizedException')) {
        setError('Invalid email or password. Please try again.')
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
          Sign in with your email and password.
        </p>

        {verified && (
          <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
            Account verified. You can now sign in.
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="username"
              type="email"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Enter your password"
            />
            <p className="mt-1 text-xs text-gray-500">
              Tester phase: password provided by admin
            </p>
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
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

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
