import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { X, Calendar, Gavel, AlertTriangle, ShieldCheck, UserPlus } from 'lucide-react'
import { format } from 'date-fns'
import { UserSearchInput } from './UserSearchDropdown'

interface CourtDocketModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectCase?: (caseData: any) => void
  onSentenceCase?: (caseData: any) => void
  isJudge: boolean
  courtId: string
}

export default function CourtDocketModal({ isOpen, onClose, onSelectCase, onSentenceCase, isJudge, courtId }: CourtDocketModalProps) {
  const [dockets, setDockets] = useState<any[]>([])
  const [selectedDocketId, setSelectedDocketId] = useState<string | null>(null)
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [extendingCase, setExtendingCase] = useState<string | null>(null)
  const [newDate, setNewDate] = useState('')
  const [showAddCase, setShowAddCase] = useState(false)
  const [addUsername, setAddUsername] = useState('')
  const [defendantQuery, setDefendantQuery] = useState('')
  const [addDefendantId, setAddDefendantId] = useState<string | null>(null)
  const [addReason, setAddReason] = useState('')
  const [addingCase, setAddingCase] = useState(false)

  const { user } = useAuthStore()

  const fetchDockets = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('court_dockets')
      .select('*')
      .order('court_date', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching dockets:', error)
      toast.error('Failed to load dockets')
    } else {
      setDockets(data || [])
      if (data && data.length > 0) {
        setSelectedDocketId(prev => prev || data[0].id)
      }
    }
    setLoading(false)
  }, [])

  const fetchCases = useCallback(async (docketId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('court_cases')
      .select(`
        *,
        defendant:defendant_id(id, username, avatar_url, has_active_warrant, is_banned),
        plaintiff:plaintiff_id(username)
      `)
      .eq('docket_id', docketId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching cases:', error)
      toast.error('Failed to load cases')
    } else {
      setCases(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchDockets()
    }
  }, [isOpen, fetchDockets])

  useEffect(() => {
    if (selectedDocketId) {
      fetchCases(selectedDocketId)
    }
  }, [selectedDocketId, fetchCases])

  const handleExtend = async (caseId: string) => {
    if (!newDate) {
      toast.error('Please select a new date')
      return
    }

    try {
      const { data, error } = await supabase.rpc('extend_court_date', {
        p_case_id: caseId,
        p_new_date: newDate
      })

      if (error) throw error

      if (data && data.success) {
        toast.success('Court date extended and case moved to new docket')
        setExtendingCase(null)
        setNewDate('')
        fetchCases(selectedDocketId!) // Refresh list
      } else {
        toast.error(data?.error || 'Failed to extend date')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error extending date')
    }
  }

  const handlePardon = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to pardon @${username} and remove their ban/warrant?`)) return

    try {
      const { data, error } = await supabase.rpc('judge_pardon_user', {
        p_user_id: userId
      })

      if (error) throw error

      if (data && data.success) {
        toast.success(`@${username} has been pardoned`)
        fetchCases(selectedDocketId!) // Refresh list
      } else {
        toast.error(data?.error || 'Failed to pardon user')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error pardoning user')
    }
  }

  const handleAddCase = async () => {
    if (!addDefendantId) {
      toast.error('Select a defendant from the list')
      return
    }
    if (!addReason.trim()) {
      toast.error('Enter a reason for the case')
      return
    }

    setAddingCase(true)
    try {
      const { data, error } = await supabase.rpc('create_court_case', {
        p_defendant_id: addDefendantId,
        p_reason: addReason.trim(),
        p_plaintiff_id: user?.id || null,
      })

      if (error) throw error

      if (data && data.success === false) {
        toast.error(data?.error || 'Failed to create case')
        return
      }

      const { notifyAdminCourtStarted } = await import('../lib/notifications')
      notifyAdminCourtStarted(
        data?.case_id || '',
        addDefendantId,
        addUsername || 'Unknown',
        addReason.trim(),
        new Date().toLocaleDateString()
      ).catch((e) => console.warn('[CourtDocketModal] Failed to notify admins:', e))

      toast.success(`Case opened against @${addUsername || 'defendant'}. Call them to stand to issue a ruling.`)
      setShowAddCase(false)
      setAddUsername('')
      setDefendantQuery('')
      setAddDefendantId(null)
      setAddReason('')
      fetchDockets()
      if (data?.docket_id) {
        setSelectedDocketId(data.docket_id)
        fetchCases(data.docket_id)
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating case')
    } finally {
      setAddingCase(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#171427] border border-purple-500/30 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <Gavel className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-bold text-white">Court Dockets</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Sidebar: Dockets List */}
           <div className="w-full md:w-64 border-r border-white/10 bg-[#0A0814] overflow-y-auto p-4">
             <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Available Dockets</h3>

             {isJudge && (
               <div className="mb-3">
                 {showAddCase ? (
                   <div className="space-y-2 rounded-lg border border-purple-500/30 bg-black/30 p-3">
                     {addDefendantId ? (
                       <div className="flex items-center justify-between rounded bg-purple-600/20 border border-purple-500/30 px-2 py-1.5 text-xs text-white">
                         <span>Defendant: @{addUsername}</span>
                         <button
                           type="button"
                           onClick={() => {
                             setAddDefendantId(null)
                             setAddUsername('')
                             setDefendantQuery('')
                           }}
                           className="text-purple-200 hover:text-white"
                         >
                           <X size={14} />
                         </button>
                       </div>
                     ) : (
                       <div className="rounded bg-black/50 border border-white/10 px-2 py-1.5 space-y-2">
                         <input
                           type="text"
                           value={defendantQuery}
                           onChange={(e) => setDefendantQuery(e.target.value)}
                           placeholder="Search defendant username..."
                           className="w-full rounded bg-black/60 border border-white/10 px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                         />
                         <UserSearchInput
                           query={defendantQuery}
                           disableNavigation
                           onSelect={(userId, username) => {
                             setAddDefendantId(userId)
                             setAddUsername(username)
                             setDefendantQuery('')
                           }}
                         />
                       </div>
                     )}
                     <textarea
                       value={addReason}
                       onChange={(e) => setAddReason(e.target.value)}
                       placeholder="Reason for the case"
                       rows={2}
                       className="w-full rounded bg-black/50 border border-white/10 px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                     />
                     <div className="flex gap-1">
                       <button
                         onClick={handleAddCase}
                         disabled={addingCase}
                         className="flex-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold py-1.5 disabled:opacity-50"
                       >
                         {addingCase ? 'Opening...' : 'Open Case'}
                       </button>
                       <button
                         onClick={() => setShowAddCase(false)}
                         className="flex-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-[11px] py-1.5"
                       >
                         Cancel
                       </button>
                     </div>
                   </div>
                 ) : (
                   <button
                     onClick={() => setShowAddCase(true)}
                     className="w-full flex items-center justify-center gap-2 rounded-lg border border-purple-500/30 bg-purple-600/20 px-3 py-2 text-xs font-bold text-purple-200 hover:bg-purple-600/30 transition-colors"
                   >
                     <UserPlus size={14} />
                     Add Defendant
                   </button>
                 )}
                 <p className="mt-2 text-[10px] text-gray-500">
                   Open a case without a docket so you can issue a ruling immediately.
                 </p>
               </div>
             )}

             <div className="space-y-2">
               {dockets.map((docket) => (
                <button
                  key={docket.id}
                  onClick={() => setSelectedDocketId(docket.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedDocketId === docket.id
                      ? 'bg-purple-600/20 border-purple-500 text-white'
                      : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} />
                    <span className="font-medium">
                      {format(new Date(docket.court_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="text-xs opacity-70">
                    Status: {docket.status}
                  </div>
                </button>
              ))}
              {dockets.length === 0 && !loading && (
                <div className="text-sm text-gray-500 italic">No dockets found</div>
              )}
            </div>
          </div>

          {/* Main: Cases List */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#0D0D1A]">
            <h3 className="text-lg font-bold text-white mb-4">
              Cases for {dockets.find(d => d.id === selectedDocketId) ? format(new Date(dockets.find(d => d.id === selectedDocketId).court_date), 'MMMM d, yyyy') : 'Selected Docket'}
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              </div>
            ) : cases.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-white/5 rounded-xl border border-white/5 border-dashed">
                No cases scheduled for this docket.
              </div>
            ) : (
              <div className="space-y-4">
                {cases.map((caseItem) => (
                  <div key={caseItem.id} className="bg-[#151520] border border-white/10 rounded-xl p-4 hover:border-purple-500/30 transition-colors">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      
                      {/* Case Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 text-xs border border-purple-500/20">
                            Case #{caseItem.id.slice(0, 8)}
                          </span>
                          <span className="text-gray-400 text-xs">
                            {format(new Date(caseItem.created_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                              <img 
                                src={caseItem.defendant?.avatar_url || `https://ui-avatars.com/api/?name=${caseItem.defendant?.username}`} 
                                alt={caseItem.defendant?.username}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="font-bold text-white flex items-center gap-2">
                                @{caseItem.defendant?.username || 'Unknown'}
                                {caseItem.defendant?.has_active_warrant && (
                                  <span className="text-red-500 bg-red-900/20 px-1.5 py-0.5 rounded text-[10px] border border-red-500/30 flex items-center gap-1" title="Active Warrant">
                                    <AlertTriangle size={10} /> WARRANT
                                  </span>
                                )}
                                {caseItem.defendant?.is_banned && (
                                  <span className="text-red-500 bg-red-900/20 px-1.5 py-0.5 rounded text-[10px] border border-red-500/30">
                                    BANNED
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400">Defendant</div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-black/20 rounded p-3 mb-3">
                          <p className="text-sm text-gray-200">
                            <span className="text-gray-500 font-semibold mr-2">Reason:</span>
                            {caseItem.reason}
                          </p>
                          {caseItem.users_involved && (
                            <p className="text-xs text-gray-400 mt-2">
                              <span className="text-gray-500 font-semibold mr-2">Involved:</span>
                              {caseItem.users_involved}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {isJudge && (
                        <div className="flex flex-col gap-2 min-w-[140px] justify-center border-l border-white/5 pl-4 ml-2">
                          {onSelectCase && (
                            <button
                              onClick={() => onSelectCase(caseItem)}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors"
                            >
                              <Gavel size={14} />
                              Call to Stand
                            </button>
                          )}

                          {onSentenceCase && (
                            <button
                              onClick={() => onSentenceCase(caseItem)}
                              className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors"
                            >
                              <Gavel size={14} />
                              Issue Sentence
                            </button>
                          )}
                          
                          {(caseItem.defendant?.has_active_warrant || caseItem.defendant?.is_banned) && (
                            <button
                              onClick={() => handlePardon(caseItem.defendant_id, caseItem.defendant?.username)}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors"
                            >
                              <ShieldCheck size={14} />
                              Pardon / Unban
                            </button>
                          )}

                          <div className="relative">
                            {extendingCase === caseItem.id ? (
                              <div className="bg-zinc-800 p-2 rounded border border-white/10 absolute top-0 right-0 z-10 w-48 shadow-xl">
                                <label className="text-[10px] text-gray-400 mb-1 block">New Court Date</label>
                                <input
                                  type="date"
                                  className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-xs mb-2 text-white"
                                  value={newDate}
                                  onChange={(e) => setNewDate(e.target.value)}
                                />
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => handleExtend(caseItem.id)}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] py-1 rounded"
                                  >
                                    Confirm
                                  </button>
                                  <button 
                                    onClick={() => setExtendingCase(null)}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-[10px] py-1 rounded"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setExtendingCase(caseItem.id)}
                                className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors"
                              >
                                <Calendar size={14} />
                                Extend Date
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
