import { NavLink, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/home', label: 'Home', icon: HomeIcon },
  { path: '/roadmap', label: 'Roadmap', icon: RoadmapIcon },
  { path: '/recap', label: 'Recap', icon: RecapIcon },
  { path: '/profile', label: 'Profile', icon: ProfileIcon }
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const showNav = !['/signin', '/signup', '/verify', '/onboarding', '/deeplink'].some(p => location.pathname.startsWith(p))
    && !location.pathname.startsWith('/onboarding')

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Centered container — same width at all breakpoints */}
      <div className="mx-auto max-w-md min-h-screen bg-white shadow-sm">
        {children}
      </div>

      {/* Fixed bottom nav */}
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white safe-bottom">
          <div className="mx-auto max-w-md flex items-center justify-around py-2">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
                    isActive ? 'text-navy-700 font-medium' : 'text-gray-400'
                  }`
                }
              >
                <Icon active={location.pathname === path} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-navy-700' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function RoadmapIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-navy-700' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

function RecapIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-navy-700' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-navy-700' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}
