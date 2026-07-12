    import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

// Auth screens
import SignUp from '@/components/auth/SignUp'
import OtpVerify from '@/components/auth/OtpVerify'
import SignIn from '@/components/auth/SignIn'
import DeepLinkHandler from '@/components/auth/DeepLinkHandler'

// Onboarding
import OnboardingForm from '@/components/onboarding/OnboardingForm'
import PlanGenerating from '@/components/onboarding/PlanGenerating'

// App screens (stubs — implemented in later phases)
import HomeScreen from '@/components/home/HomeScreen'

// Placeholder stubs for routes not yet implemented
const RoadmapView    = () => <div className="p-6">Roadmap — coming in Phase 6</div>
const WeeklyRecap    = () => <div className="p-6">Weekly Recap — coming in Phase 6</div>
const ProfileScreen  = () => <div className="p-6">Profile — coming in Phase 6</div>
const ModuleScreen   = () => <div className="p-6">Module — coming in Phase 5</div>
const AdminScreen    = () => <div className="p-6">Admin — coming in Phase 8</div>

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, onboardingComplete, planStatus, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/signin" replace />
  if (!onboardingComplete) return <Navigate to="/onboarding" replace />
  if (planStatus === 'generating') return <Navigate to="/onboarding/generating" replace />

  return <>{children}</>
}

export default function App() {
  const { init } = useAuthStore()

  useEffect(() => {
    init()
  }, [init])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/signup"  element={<SignUp />} />
        <Route path="/verify"  element={<OtpVerify />} />
        <Route path="/signin"  element={<SignIn />} />
        <Route path="/deeplink" element={<DeepLinkHandler />} />

        {/* Onboarding (auth required, plan not yet required) */}
        <Route path="/onboarding"            element={<OnboardingForm />} />
        <Route path="/onboarding/generating" element={<PlanGenerating />} />

        {/* Protected app routes */}
        <Route path="/home"          element={<AuthGate><HomeScreen /></AuthGate>} />
        <Route path="/module/:dayIndex" element={<AuthGate><ModuleScreen /></AuthGate>} />
        <Route path="/roadmap"       element={<AuthGate><RoadmapView /></AuthGate>} />
        <Route path="/recap"         element={<AuthGate><WeeklyRecap /></AuthGate>} />
        <Route path="/profile"       element={<AuthGate><ProfileScreen /></AuthGate>} />
        <Route path="/admin"         element={<AuthGate><AdminScreen /></AuthGate>} />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
