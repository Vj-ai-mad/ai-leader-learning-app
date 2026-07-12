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

// App screens
import HomeScreen from '@/components/home/HomeScreen'
import ModuleScreen from '@/components/module/ModuleScreen'
import RoadmapView from '@/components/roadmap/RoadmapView'
import WeeklyRecap from '@/components/recap/WeeklyRecap'
import ProfileScreen from '@/components/profile/ProfileScreen'

// Admin
import AdminScreen from '@/components/admin/AdminScreen'

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

function AdminGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/signin" replace />
  if (!isAdmin) return <Navigate to="/home" replace />

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
        <Route path="/admin"         element={<AdminGate><AdminScreen /></AdminGate>} />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
