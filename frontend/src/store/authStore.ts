import { create } from 'zustand'
import { getCurrentUser, fetchAuthSession, signOut as amplifySignOut } from 'aws-amplify/auth'

export type PlanStatus = 'generating' | 'active' | 'paused' | 'completed' | 'error' | null

interface AuthState {
  userId: string | null
  name: string | null
  email: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  onboardingComplete: boolean
  planStatus: PlanStatus
  isLoading: boolean

  init: () => Promise<void>
  setProfile: (profile: Partial<AuthState>) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  name: null,
  email: null,
  isAuthenticated: false,
  isAdmin: false,
  onboardingComplete: false,
  planStatus: null,
  isLoading: true,

  init: async () => {
    try {
      const user = await getCurrentUser()
      const session = await fetchAuthSession()
      const groups =
        (session.tokens?.idToken?.payload['cognito:groups'] as string[]) ?? []

      set({
        userId: user.userId,
        isAuthenticated: true,
        isAdmin: groups.includes('admin'),
        isLoading: false
      })

      // Fetch profile to get onboardingComplete and planStatus
      try {
        const token = session.tokens?.idToken?.toString()
        const apiEndpoint = import.meta.env.VITE_API_ENDPOINT ?? ''
        const res = await fetch(`${apiEndpoint}/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const profile = await res.json()
          set({
            name: profile.name,
            onboardingComplete: profile.onboardingComplete ?? !!profile.role,
            planStatus: profile.planStatus ?? null
          })
        }
      } catch {
        // Profile fetch failed — user may not have completed onboarding yet
      }
    } catch {
      set({ isAuthenticated: false, isLoading: false })
    }
  },

  setProfile: (profile) => set((s) => ({ ...s, ...profile })),

  signOut: async () => {
    await amplifySignOut()
    set({
      userId: null,
      name: null,
      email: null,
      isAuthenticated: false,
      isAdmin: false,
      onboardingComplete: false,
      planStatus: null
    })
  }
}))
