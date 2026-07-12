import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ContentTable from './ContentTable'
import AllowListTable from './AllowListTable'

export default function AdminScreen() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'content' | 'allowlist'>('content')

  return (
    <div className="min-h-screen bg-gray-50 safe-top safe-bottom">
      <header className="bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/home')} className="rounded-md p-1 text-gray-600 hover:bg-gray-100" aria-label="Back">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-brand-700">Admin</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setTab('content')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === 'content' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Content Library
          </button>
          <button
            onClick={() => setTab('allowlist')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === 'allowlist' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Allow List
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {tab === 'content' ? <ContentTable /> : <AllowListTable />}
      </main>
    </div>
  )
}
