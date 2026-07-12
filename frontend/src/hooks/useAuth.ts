import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getProfile } from '@/api'

/**
 * Hook that initialises auth state on mount and fetches the user profile
 * to populate onboardingComplete and planStatus in the store.
 */
export function useAuth() {
  const store = useAuthStore()

  useEffect(() => {
    async function loadProfile() {
      if (!store.isAuthenticated || store.isLoading) return

      try {
        const profile = await getProfile()
        store.setProfile({
          name: profile.name,
          email: profile.email,
          onboardingComplete: profile.onboardingComplete,
          planStatus: profile.planStatus
        })
      } catch {
        // Profile not found = user hasn't completed onboarding yet
        store.setProfile({ onboardingComplete: false })
      }
    }

    loadProfile()
  }, [store.isAuthenticated, store.isLoading])

  return store
}
