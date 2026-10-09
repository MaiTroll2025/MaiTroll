import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { ExecutiveIntake } from '../../../../types/admin'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle, Clock, ArrowUpCircle } from 'lucide-react'
import { useAuthStore } from '../../../../lib/store'

interface ExecutiveIntakeListProps {
  viewMode: 'admin' | 'secretary'
}

export default function ExecutiveIntakeList({ viewMode }: ExecutiveIntakeListProps) {
  const { user } = useAuthStore()
  const [intakeItems, setIntakeItems] = useState<ExecutiveIntake[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [selectedItem, setSelectedItem] = useState<ExecutiveIntake | null>(null)
  const [notes, setNotes] = useState('')

  const fetchIntake = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_executive_intake' }
      })

      if (error) throw error
      if (data.error) throw new Error(data.error)
      setIntakeItems(data.intake || [])
    } catch (error) {
      console.error('Error fetching intake:', error)
      toast.error('Failed to load intake items')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIntake()
    
    // Converted to polling to reduce DB load
    const interval = setInterval(() => {
      fetchIntake()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchIntake])

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'update_intake_status',
          requestId: id,
          status: newStatus
        }
      })

      if (error) throw error
      toast.success('Status updated')
      fetchIntake()
    } catch (error) {
      console.error(error)
      toast.error('Failed to update status')
    }
  }

  const handleAssignSelf = async (id: string) => {
    if (!user) return
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'assign_intake',
          requestId: id,
          assigneeId: user.id
        }
      })

      if (error) throw error
      toast.success('Assigned to self')
      fetchIntake()
    } catch (error) {
      console.error(error)
      toast.error('Failed to assign')
    }
  }

  const handleSaveNotes = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'update_intake_notes',
          requestId: id,
          notes: notes
        }
      })

      if (error) throw error
      toast.success('Notes saved')
      setSelectedItem(null)
      fetchIntake()
    } catch (error) {
      console.error(error)
      toast.error('Failed to save notes')
    }
  }

  const handleEscalate = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'escalate_intake',
          requestId: id
        }
      })

      if (error) throw error
      toast.success('Escalated to Admin')
      fetchIntake()
    } catch (error) {
      console.error(error)
      toast.error('Failed to escalate')
    }
  }

  const filteredItems = intakeItems.filter(item => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false
    if (filterSeverity !== 'all' && item.severity !== filterSeverity) return false
    return true
  })

  // Sort: Critical severity first, then payout related (if we had a way to identify them easily, maybe category)
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1
    if (a.severity !== 'critical' && b.severity === 'critical') return 1
    // Assume category 'payout' or similar exists
    if (a.category === 'payout' && b.category !== 'payout') return -1
    if (a.category !== 'payout' && b.category === 'payout') return 1
    return 0
  })

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          Executive Intake
        </h2>
        <div className="flex gap-2">
          <select 
            className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm text-white"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_review">In Review</option>
            <option value="resolved">Resolved</option>
            <option value="escalated">Escalated</option>
          </select>
          <select 
            className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm text-white"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading intake...</div>
        ) : sortedItems.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No intake items found</div>
        ) : (
          sortedItems.map(item => (
            <div 
              key={item.id} 
              className={`bg-slate-900/50 p-4 rounded-lg border ${
                item.severity === 'critical' ? 'border-red-500/50 bg-red-900/10' : 'border-slate-700'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {item.severity === 'critical' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    <span className="font-semibold text-white">{item.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.status === 'open' ? 'bg-blue-500/20 text-blue-300' :
                      item.status === 'resolved' ? 'bg-green-500/20 text-green-300' :
                      item.status === 'escalated' ? 'bg-purple-500/20 text-purple-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {item.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400 border border-slate-700 px-2 py-0.5 rounded">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">{item.description}</p>
                  <div className="text-xs text-slate-500 flex gap-4">
                    <span>ID: {item.id.slice(0, 8)}</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    {item.assigned_secretary && <span className="text-blue-400">Assigned: {item.assigned_secretary}</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {viewMode === 'secretary' && !item.assigned_secretary && (
                    <button 
                      onClick={() => handleAssignSelf(item.id)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
                    >
                      Assign to Me
                    </button>
                  )}
                  
                  {selectedItem?.id === item.id ? (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <textarea
                        className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white"
                        placeholder="Secretary notes..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleSaveNotes(item.id)}
                          className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs py-1 rounded"
                        >
                          Save
                        </button>
                        <button 
                          onClick={() => setSelectedItem(null)}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs py-1 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setSelectedItem(item)
                        setNotes(item.secretary_notes || '')
                      }}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors"
                    >
                      {item.secretary_notes ? 'Edit Notes' : 'Add Notes'}
                    </button>
                  )}

                  {item.status !== 'resolved' && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'resolved')}
                      className="px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-600/50 text-xs rounded transition-colors flex items-center justify-center gap-1"
                    >
                      <CheckCircle className="w-3 h-3" /> Resolve
                    </button>
                  )}

                  {item.status !== 'escalated' && !item.escalated_to_admin && (
                    <button 
                      onClick={() => handleEscalate(item.id)}
                      className="px-3 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-600/50 text-xs rounded transition-colors flex items-center justify-center gap-1"
                    >
                      <ArrowUpCircle className="w-3 h-3" /> Escalate
                    </button>
                  )}
                </div>
              </div>
              {item.secretary_notes && selectedItem?.id !== item.id && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-xs text-slate-400 font-mono">NOTES: {item.secretary_notes}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
