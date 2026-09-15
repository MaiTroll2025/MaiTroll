import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, BookOpen, Plus, Trash2 } from 'lucide-react'

interface Program {
  id: string
  institution_id: string
  program_name: string
  description: string | null
  created_at: string
  updated_at: string
}

export default function InstitutionPrograms() {
  const { user } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [institutionId, setInstitutionId] = useState<string | null>(null)

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

        // Fetch programs
        const { data, error } = await supabase
          .from('institution_programs')
          .select('*')
          .eq('institution_id', instId)
          .order('created_at', { ascending: false })

        if (error) throw error
        setPrograms((data as Program[]) || [])
      } catch (err) {
        console.error('Error fetching programs:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const handleAddProgram = async () => {
    if (!institutionId || !formData.name) return

    try {
      const { error } = await supabase
        .from('institution_programs')
        .insert({
          institution_id: institutionId,
          program_name: formData.name,
          description: formData.description,
        })

      if (error) throw error

      // Refresh programs
      const { data } = await supabase
        .from('institution_programs')
        .select('*')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })

      setPrograms((data as Program[]) || [])
      setFormData({ name: '', description: '' })
      setShowForm(false)
    } catch (err) {
      console.error('Error adding program:', err)
    }
  }

  const handleDeleteProgram = async (programId: string) => {
    if (!confirm('Are you sure you want to delete this program?')) return

    try {
      const { error } = await supabase
        .from('institution_programs')
        .delete()
        .eq('id', programId)

      if (error) throw error

      setPrograms(programs.filter((p) => p.id !== programId))
    } catch (err) {
      console.error('Error deleting program:', err)
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
            title="Institution Programs"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-6xl mx-auto p-4 md:p-6">
            {/* Header with Add Button */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Programs</h2>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 px-4 py-2 bg-[#6366f1] hover:bg-[#7c3aed] rounded-lg text-white font-medium transition"
              >
                <Plus className="size-5" />
                Add Program
              </button>
            </div>

            {/* Add Program Form */}
            {showForm && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Create New Program</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">Program Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Computer Science"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#6366f1]"
                    />
                  </div>

                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">Description</label>
                    <textarea
                      placeholder="Program description and details..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#6366f1] resize-none h-24"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAddProgram}
                      className="px-4 py-2 bg-[#6366f1] hover:bg-[#7c3aed] rounded-lg text-white font-medium transition"
                    >
                      Create Program
                    </button>
                    <button
                      onClick={() => {
                        setShowForm(false)
                        setFormData({ name: '', description: '' })
                      }}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white font-medium transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Programs List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-white size-8" />
              </div>
            ) : programs.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="size-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/60 text-lg">No programs yet</p>
                <p className="text-white/40 text-sm">Create your first program to get started</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {programs.map((program) => (
                  <div
                    key={program.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white">{program.program_name}</h3>
                      <button
                        onClick={() => handleDeleteProgram(program.id)}
                        className="p-2 hover:bg-red-500/20 rounded text-red-400 transition"
                        title="Delete program"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    {program.description && (
                      <p className="text-white/70 text-sm mb-3 line-clamp-3">{program.description}</p>
                    )}

                    <div className="text-xs text-white/40">
                      Created: {new Date(program.created_at).toLocaleDateString()}
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
