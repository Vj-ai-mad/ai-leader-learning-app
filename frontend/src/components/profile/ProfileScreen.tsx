import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, setPauseState, setNotifOptOut } from '@/api'
import { useAuthStore } from '@/store/authStore'
import type { UserProfile } from '@/types'

export default function ProfileScreen() {
  const navigate = useNavigate()
  const { signOut, planStatus, setProfile } = useAuthStore()
  const [profile, setProfileData] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try { setProfileData(await getProfile()) } catch {} finally { setLoading(false) }
    }
    load()
  }, [])

  async function handlePauseToggle() {
    const newPaused = planStatus !== 'paused'
    try {
      await setPauseState(newPaused)
      setProfile({ planStatus: newPaused ? 'paused' : 'active' })
    } catch {}
  }

  async function handleNotifToggle() {
    if (!profile) return
    const newVal = !profile.notifOptOut
    try {
      await setNotifOptOut(newVal)
      setProfileData({ ...profile, notifOptOut: newVal })
    } catch {}
  }

  async function handleSignOut() {
    await signOut()
    navigate('/signin', { replace: true })
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 safe-top safe-bottom">
      <header className="flex items-center gap-3 bg-white px-4 py-4 shadow-sm">
        <button onClick={() => navigate('/home')} className="rounded-md p-1 text-gray-600 hover:bg-gray-100" aria-label="Back">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-brand-700">Profile & Settings</h1>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* Profile info */}
        {profile && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500">Name</p>
              <p className="text-sm font-medium text-gray-900">{profile.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Role</p>
              <p className="text-sm font-medium text-gray-900">{profile.role || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Daily time</p>
              <p className="text-sm font-medium text-gray-900">{profile.dailyMinutes ?? 15} minutes</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Active days</p>
              <p className="text-sm font-medium text-gray-900">
                {(profile.activeDays ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
          {/* Pause / Resume */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Pause plan</p>
              <p className="text-xs text-gray-500">Stop daily modules and notifications</p>
            </div>
            <button
              onClick={handlePauseToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                planStatus === 'paused' ? 'bg-amber-500' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                planStatus === 'paused' ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Notification opt-out */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">WhatsApp notifications</p>
              <p className="text-xs text-gray-500">Daily reminders and weekly recap</p>
            </div>
            <button
              onClick={handleNotifToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                !profile?.notifOptOut ? 'bg-brand-500' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                !profile?.notifOptOut ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full rounded-md border border-red-200 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Sign Out
        </button>
      </main>
    </div>
  )
}
