import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signUp, signIn } from 'aws-amplify/auth'
import { checkAllowList } from '@/api'
import { useAuthStore } from '@/store/authStore'

export default function SignUp() {
  const navigate = useNavigate()
  const { init } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validate password match
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    try {
      // Normalise phone to E.164
      const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone}`

      // 1. Check allow-list first for a friendly error
      const result = await checkAllowList(email, normalizedPhone) as { allowed?: boolean }
      if (!result?.allowed) {
        setError('This app is currently invite-only. Contact Vijay to request access.')
        setLoading(false)
        return
      }

      // 2. Cognito sign-up with password
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            phone_number: normalizedPhone,
            name
          }
        }
      })

      // 3. Auto sign-in after successful sign-up
      const { nextStep } = await signIn({ username: email, password })

      if (nextStep.signInStep === 'DONE') {
        await init()
        navigate('/home', { replace: true })
      } else {
        // Fallback: go to sign-in page
        navigate('/signin', { state: { verified: true } })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-up failed. Please try again.'
      if (message.includes('invite-only') || message.includes('PreSignUp')) {
        setError('This app is currently invite-only. Contact Vijay to request access.')
      } else if (message.includes('UsernameExistsException')) {
        setError('An account with this email already exists. Try signing in.')
      } else if (message.includes('InvalidPasswordException')) {
        setError('Password must be at least 8 characters.')
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
          Helm.
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          Create your account to start your personalized AI literacy journey.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone Number (WhatsApp)
            </label>
            <div className="mt-1 flex">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
                +91
              </span>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="block w-full rounded-r-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="9876543210"
                maxLength={10}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Used for daily WhatsApp reminders</p>
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
              placeholder="Minimum 8 characters"
              minLength={8}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Re-enter password"
              minLength={8}
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
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/signin" className="font-medium text-brand-600 hover:text-brand-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
