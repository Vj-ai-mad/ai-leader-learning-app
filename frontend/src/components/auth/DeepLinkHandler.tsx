import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exchangeDeepLinkToken } from '@/api'
import { useAuthStore } from '@/store/authStore'

export default function DeepLinkHandler() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { init } = useAuthStore()
  const [error, setError] = useState('')

  useEffect(() => {
    async function exchange() {
      const token = searchParams.get('token')
      if (!token) {
        setError('Invalid link — no token found.')
        return
      }

      try {
        const result = await exchangeDeepLinkToken(token) as {
          accessToken?: string
          idToken?: string
          refreshToken?: string
          dayIndex?: number
          error?: string
        }

        if (result.error) {
          setError(result.error === 'Token already used'
            ? 'This link has already been used. Please sign in normally.'
            : result.error === 'Token expired'
              ? 'This link has expired. Please sign in normally.'
              : result.error)
          return
        }

        // TODO: Store tokens in Amplify session
        // For now, re-init auth state and navigate
        await init()
        navigate(`/module/${result.dayIndex ?? 0}`, { replace: true })
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to authenticate via link')
      }
    }

    exchange()
  }, [searchParams, navigate, init])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <p className="mb-4 text-sm text-red-700">{error}</p>
          <button
            onClick={() => navigate('/signin')}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        <p className="mt-3 text-sm text-gray-600">Opening your module...</p>
      </div>
    </div>
  )
}
