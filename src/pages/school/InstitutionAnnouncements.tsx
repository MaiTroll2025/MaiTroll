import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, Bell, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Announcement {
  id: string
  institution_id: string
  title: string
  content: string
  created_by_staff_id: string
  created_at: string
  updated_at: string
}

export default function InstitutionAnnouncements() {
  const { user } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ title: '', content: '' })
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        // Get institution from staff record
        const { data: staffData } = await supabase
          .from('institution_staff')
          .select('institutions(id)')
          .eq('user_id', user.id)
          .single()

        if (!staffData) {
          setLoading(false)
          return
        }

        const instId = staffData.institutions.id
        setInstitutionId(instId)

        // Fetch announcements
        const { data, error } = await supabase
          .from('institution_announcements')
          .select('*')
          .eq('institution_id', instId)
          .order('created_at', { ascending: false })

        if (error) throw error
        setAnnouncements((data as Announcement[]) || [])
      } catch (err) {
        console.error('Error fetching announcements:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const handleCreateAnnouncement = async () => {
    if (!institutionId || !formData.title || !formData.content) {
      toast.error('Please fill in all fields')
      return
    }

    setSubmitting(true)
    try {
      // Get staff record to get ID
      const { data: staffData } = await supabase
        .from('institution_staff')
        .select('id')
        .eq('user_id', user?.id)
        .single()

      if (!staffData) throw new Error('Staff record not found')

      const { error } = await supabase
        .from('institution_announcements')
        .insert({
          institution_id: institutionId,
          title: formData.title,
          content: formData.content,
          created_by_staff_id: staffData.id,
        })

      if (error) throw error

      toast.success('Announcement created')

      // Refresh announcements
      const { data } = await supabase
        .from('institution_announcements')
        .select('*')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })

      setAnnouncements((data as Announcement[]) || [])
      setFormData({ title: '', content: '' })
      setShowForm(false)
    } catch (err) {
      console.error('Error creating announcement:', err)
      toast.error('Failed to create announcement')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return

    try {
      const { error } = await supabase
        .from('institution_announcements')
        .delete()
        .eq('id', announcementId)

      if (error) throw error

      setAnnouncements(announcements.filter((a) => a.id !== announcementId))
      toast.success('Announcement deleted')
    } catch (err) {
      console.error('Error deleting announcement:', err)
      toast.error('Failed to delete announcement')
    }
  }

  return (
    <SchoolLayout requiredRole="institution_staff">
      <div className="flex h-screen bg-[#0f1419]">
        <SchoolSidebar
          isOpen={sidebarOpen}
          userType="institution_staff"
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 overflow-auto">
          <SchoolHeader
            title="Institution Announcements"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-4xl mx-auto p-4 md:p-6">
            {/* Header with Add Button */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Announcements</h2>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 px-4 py-2 bg-[#6366f1] hover:bg-[#7c3aed] rounded-lg text-white font-medium transition"
              >
                <Plus className="size-5" />
                Create Announcement
              </button>
            </div>

            {/* Create Announcement Form */}
            {showForm && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Create New Announcement</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">Title</label>
                    <input
                      type="text"
                      placeholder="Announcement title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#6366f1]"
                    />
                  </div>

                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">Content</label>
                    <textarea
                      placeholder="Announcement content..."
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#6366f1] resize-none h-32"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateAnnouncement}
                      disabled={submitting}
                      className="px-4 py-2 bg-[#6366f1] hover:bg-[#7c3aed] disabled:opacity-50 rounded-lg text-white font-medium transition"
                    >
                      {submitting ? 'Creating...' : 'Publish Announcement'}
                    </button>
                    <button
                      onClick={() => {
                        setShowForm(false)
                        setFormData({ title: '', content: '' })
                      }}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white font-medium transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Announcements List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-white size-8" />
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="size-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/60 text-lg">No announcements yet</p>
                <p className="text-white/40 text-sm">Create your first announcement to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">{announcement.title}</h3>
                        <p className="text-white/70 text-sm mt-1 line-clamp-3">{announcement.content}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        className="p-2 hover:bg-red-500/20 rounded text-red-400 transition flex-shrink-0 ml-2"
                        title="Delete announcement"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    <div className="text-xs text-white/40">
                      Posted: {new Date(announcement.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </SchoolLayout>
  )
}
