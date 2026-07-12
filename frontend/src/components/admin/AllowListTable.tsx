import { useEffect, useState } from 'react'
import { adminListAllowList, adminAddAllowList, adminDeleteAllowList } from '@/api'

interface AllowListEntry {
  value: string
  type: string
  note: string
  addedAt: string
}

export default function AllowListTable() {
  const [items, setItems] = useState<AllowListEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [newValue, setNewValue] = useState('')
  const [newType, setNewType] = useState<'email' | 'phone'>('email')
  const [newNote, setNewNote] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    try {
      const data = await adminListAllowList() as { items: AllowListEntry[] }
      setItems(data.items ?? [])
    } catch {} finally { setLoading(false) }
  }

  async function handleAdd() {
    if (!newValue.trim()) return
    setAdding(true)
    try {
      await adminAddAllowList(newValue.trim(), newType, newNote.trim())
      setNewValue('')
      setNewNote('')
      loadItems()
    } catch (err) {
      alert('Failed to add: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally { setAdding(false) }
  }

  async function handleDelete(value: string) {
    if (!confirm(`Remove "${value}" from the allow list?`)) return
    try {
      await adminDeleteAllowList(value)
      setItems(items.filter(i => i.value !== value))
    } catch (err) {
      alert('Failed to delete: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading allow list...</p>

  return (
    <div className="space-y-6">
      {/* Add new entry */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Add Entry</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-600">Email or Phone</label>
            <input
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder={newType === 'email' ? 'user@example.com' : '+919876543210'}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs text-gray-600">Type</label>
            <select value={newType} onChange={e => setNewType(e.target.value as 'email' | 'phone')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-600">Note (optional)</label>
            <input
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Tester name"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button onClick={handleAdd} disabled={adding || !newValue.trim()}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Value</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Note</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Added</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <tr key={item.value} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-900 font-mono text-xs">{item.value}</td>
                <td className="px-3 py-2 text-gray-600 capitalize">{item.type}</td>
                <td className="px-3 py-2 text-gray-600">{item.note || '—'}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{item.addedAt?.slice(0, 10) ?? '—'}</td>
                <td className="px-3 py-2">
                  <button onClick={() => handleDelete(item.value)}
                    className="text-xs text-red-600 hover:text-red-500">Remove</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">No entries yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        {items.length} entries. Users on this list can sign up for the app.
      </p>
    </div>
  )
}
