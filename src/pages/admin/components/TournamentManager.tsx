import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { 
  Trophy, 
  Calendar, 
  Users, 
  DollarSign, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { Tournament } from '../../../components/universe-event/types'

const INITIAL_FORM: Partial<Tournament> = {
  title: '',
  subtitle: '',
  status: 'draft',
  season: '1',
  start_at: new Date().toISOString(),
  end_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  prize_pool: '',
  rules_text: '',
  description: '',
  max_participants: 64,
  entry_fee: 0
}

export default function TournamentManager() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<Tournament>>(INITIAL_FORM)

  const fetchTournaments = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('start_at', { ascending: false })
    
    if (error) {
      toast.error('Failed to load tournaments')
      console.error(error)
    } else {
      setTournaments(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTournaments()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.start_at) {
      toast.error('Title and Start Date are required')
      return
    }

    try {
      if (formData.id) {
        const { error } = await supabase
          .from('tournaments')
          .update(formData)
          .eq('id', formData.id)
        
        if (error) throw error
        toast.success('Tournament updated')
      } else {
        const { error } = await supabase
          .from('tournaments')
          .insert([formData])
        
        if (error) throw error
        toast.success('Tournament created')
      }

      setIsEditing(false)
      setFormData(INITIAL_FORM)
      fetchTournaments()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Operation failed')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will delete the tournament and all participants.')) return

    try {
      const { error, count } = await supabase
        .from('tournaments')
        .delete({ count: 'exact' })
        .eq('id', id)
      
      if (error) throw error

      if (count === 0) {
        throw new Error('No tournament deleted. You may not have permission.')
      }

      toast.success('Tournament deleted')
      fetchTournaments()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to delete')
    }
  }

  const handleEdit = (tournament: Tournament) => {
    setFormData(tournament)
    setIsEditing(true)
  }

  if (loading && !tournaments.length) {
    return <div className="p-8 text-center text-gray-400">Loading tournaments...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            Tournament Manager
          </h2>
          <p className="text-gray-400 mt-1">Create and manage universe events</p>
        </div>
        <button
          onClick={() => {
            setFormData(INITIAL_FORM)
            setIsEditing(true)
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Tournament
        </button>
      </div>

      {isEditing ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">
              {formData.id ? 'Edit Tournament' : 'New Tournament'}
            </h3>
            <button
              onClick={() => setIsEditing(false)}
              className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. Mai Troll Showdown"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Subtitle</label>
              <input
                type="text"
                value={formData.subtitle || ''}
                onChange={e => setFormData({ ...formData, subtitle: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. Season 1 Finale"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="draft">Draft</option>
                <option value="upcoming">Upcoming</option>
                <option value="open">Open (Registration)</option>
                <option value="live">Live</option>
                <option value="ended">Ended</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Season</label>
              <input
                type="number"
                value={formData.season || 1}
                onChange={e => setFormData({ ...formData, season: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Start Time</label>
              <input
                type="datetime-local"
                value={formData.start_at?.slice(0, 16)}
                onChange={e => setFormData({ ...formData, start_at: new Date(e.target.value).toISOString() })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">End Time</label>
              <input
                type="datetime-local"
                value={formData.end_at ? formData.end_at.slice(0, 16) : ''}
                onChange={e => setFormData({ ...formData, end_at: new Date(e.target.value).toISOString() })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Prize Pool</label>
              <input
                type="text"
                value={formData.prize_pool || ''}
                onChange={e => setFormData({ ...formData, prize_pool: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. 500,000 Coins"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Entry Fee (Coins)</label>
              <input
                type="number"
                value={formData.entry_fee || 0}
                onChange={e => setFormData({ ...formData, entry_fee: parseInt(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Max Participants</label>
              <input
                type="number"
                value={formData.max_participants || 64}
                onChange={e => setFormData({ ...formData, max_participants: parseInt(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-300">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                placeholder="Tournament description..."
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-300">Rules</label>
              <textarea
                value={formData.rules_text || ''}
                onChange={e => setFormData({ ...formData, rules_text: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                placeholder="Tournament rules..."
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Tournament
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid gap-4">
          {tournaments.map(tournament => (
            <div
              key={tournament.id}
              className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-bold text-white">{tournament.title}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    tournament.status === 'live' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                    tournament.status === 'open' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                    tournament.status === 'upcoming' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                    tournament.status === 'ended' ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30' :
                    'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  }`}>
                    {tournament.status.toUpperCase()}
                  </span>
                </div>
                {tournament.subtitle && (
                  <p className="text-sm text-gray-400 mb-2">{tournament.subtitle}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date(tournament.start_at).toLocaleDateString()}
                  </div>
                  {tournament.entry_fee > 0 && (
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4" />
                      {tournament.entry_fee} Coins
                    </div>
                  )}
                  {tournament.max_participants && (
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      Max {tournament.max_participants}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => handleEdit(tournament)}
                  className="flex-1 md:flex-none px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(tournament.id)}
                  className="flex-1 md:flex-none px-3 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-500/30 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}

          {tournaments.length === 0 && (
            <div className="text-center py-12 bg-gray-800/30 border border-gray-700/50 rounded-xl border-dashed">
              <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No tournaments found</p>
              <button
                onClick={() => {
                  setFormData(INITIAL_FORM)
                  setIsEditing(true)
                }}
                className="mt-4 text-blue-400 hover:text-blue-300 font-medium"
              >
                Create your first tournament
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
