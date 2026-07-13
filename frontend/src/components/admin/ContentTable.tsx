import { useEffect, useState } from 'react'
import { adminListContent, adminUpsertContent, adminGenerateSummary } from '@/api'

interface ContentItem {
  contentId: string
  title: string
  url: string
  format: string
  stage: number
  estimatedMinutes: number
  active: string | boolean
  reviewedByAdmin: boolean
  aiSummary?: string
}

export default function ContentTable() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ContentItem | null>(null)
  const [generating, setGenerating] = useState(false)
  const [previewSummary, setPreviewSummary] = useState('')
  const [filter, setFilter] = useState<'all' | 'unreviewed'>('all')

  useEffect(() => {
    loadItems()
  }, [])

  async function loadItems() {
    try {
      const data = await adminListContent() as { items: ContentItem[] }
      setItems(data.items?.sort((a, b) => a.stage - b.stage) ?? [])
    } catch {} finally { setLoading(false) }
  }

  async function handleSave() {
    if (!editing) return
    try {
      await adminUpsertContent(editing.contentId, editing as unknown as Record<string, unknown>)
      setEditing(null)
      loadItems()
    } catch (err) {
      alert('Save failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  async function handleGenerateSummary() {
    if (!editing) return
    setGenerating(true)
    try {
      const result = await adminGenerateSummary(editing.contentId) as { aiSummary: string }
      setPreviewSummary(result.aiSummary)
    } catch (err) {
      setPreviewSummary('[Generation failed — Bedrock may not be available]')
    } finally { setGenerating(false) }
  }

  function handleNew() {
    setEditing({
      contentId: crypto.randomUUID(),
      title: '',
      url: '',
      format: 'article',
      stage: 1,
      estimatedMinutes: 15,
      active: 'true',
      reviewedByAdmin: false
    })
    setPreviewSummary('')
  }

  if (loading) return <p className="text-sm text-gray-500">Loading content...</p>

  // Edit form
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">
            {editing.title ? `Edit: ${editing.title}` : 'New Content Item'}
          </h2>
          <button onClick={() => setEditing(null)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700">Title</label>
            <input value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700">URL</label>
            <input value={editing.url} onChange={e => setEditing({...editing, url: e.target.value})}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Format</label>
            <select value={editing.format} onChange={e => setEditing({...editing, format: e.target.value})}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="article">Article</option>
              <option value="video">Video</option>
              <option value="podcast">Podcast</option>
              <option value="exercise">Exercise</option>
              <option value="template">Template</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Stage (1-5)</label>
            <select value={editing.stage} onChange={e => setEditing({...editing, stage: Number(e.target.value)})}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {[1,2,3,4,5].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Est. Minutes</label>
            <input type="number" value={editing.estimatedMinutes} onChange={e => setEditing({...editing, estimatedMinutes: Number(e.target.value)})}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-4 pt-5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.active === 'true' || editing.active === true}
                onChange={e => setEditing({...editing, active: e.target.checked ? 'true' : 'false'})} />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.reviewedByAdmin}
                onChange={e => setEditing({...editing, reviewedByAdmin: e.target.checked})} />
              Reviewed
            </label>
          </div>
        </div>

        {/* AI Summary generation */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-gray-700">AI Summary</label>
            <button onClick={handleGenerateSummary} disabled={generating}
              className="text-xs text-brand-600 hover:text-brand-500 disabled:opacity-50">
              {generating ? 'Generating...' : 'Generate AI Summary'}
            </button>
          </div>
          {previewSummary && (
            <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-gray-700 max-h-40 overflow-y-auto">
              {previewSummary}
              <button onClick={() => setEditing({...editing, aiSummary: previewSummary})}
                className="mt-2 block text-xs font-medium text-brand-600">
                Use this summary
              </button>
            </div>
          )}
        </div>

        <button onClick={handleSave}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Save
        </button>
      </div>
    )
  }

  // Table view
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">{items.length} items</p>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'unreviewed')}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="all">All items</option>
            <option value="unreviewed">Unreviewed only</option>
          </select>
        </div>
        <button onClick={handleNew}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          + Add New
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Title</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Stage</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Format</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Active</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Reviewed</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.filter(item => filter === 'all' || !item.reviewedByAdmin).map(item => (
              <tr key={item.contentId} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-900 max-w-[200px] truncate">{item.title}</td>
                <td className="px-3 py-2 text-gray-600">{item.stage}</td>
                <td className="px-3 py-2 text-gray-600 capitalize">{item.format}</td>
                <td className="px-3 py-2">{(item.active === 'true' || item.active === true) ? '✓' : '—'}</td>
                <td className="px-3 py-2">{item.reviewedByAdmin ? '✓' : '—'}</td>
                <td className="px-3 py-2">
                  <button onClick={() => { setEditing(item); setPreviewSummary('') }}
                    className="text-xs text-brand-600 hover:text-brand-500">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
