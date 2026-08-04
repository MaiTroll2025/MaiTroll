import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Search, MapPin, Clock, DollarSign, Users, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface CareerPosition {
  id: string
  title: string
  department: string
  location: string
  type: string
  description: string
  requirements: string[]
  benefits: string[]
  salary: string
  status: string
}

const careerPositions: CareerPosition[] = [
  {
    id: '1',
    title: 'Community Manager',
    department: 'Operations',
    location: 'Remote',
    type: 'Full-time',
    description: 'Manage community engagement, moderate discussions, and foster a positive environment across all platforms.',
    requirements: ['Strong communication skills', 'Experience in community management', 'Familiarity with social media platforms'],
    benefits: ['Competitive salary', 'Remote work flexibility', 'Health insurance', 'Professional development budget'],
    salary: '$55,000 - $75,000',
    status: 'open',
  },
  {
    id: '2',
    title: 'Content Creator',
    department: 'Marketing',
    location: 'Remote',
    type: 'Full-time',
    description: 'Create engaging content for social media, blog posts, and video campaigns to grow brand awareness.',
    requirements: ['Creative writing skills', 'Video editing experience', 'Understanding of social media trends'],
    benefits: ['Competitive salary', 'Remote work flexibility', 'Content creation tools', 'Creative freedom'],
    salary: '$50,000 - $70,000',
    status: 'open',
  },
  {
    id: '3',
    title: 'Developer',
    department: 'Engineering',
    location: 'Hybrid',
    type: 'Full-time',
    description: 'Build and maintain web applications, APIs, and backend services using modern technologies.',
    requirements: ['React/TypeScript experience', 'Node.js or Python knowledge', 'Database design skills'],
    benefits: ['Competitive salary', 'Hybrid work model', 'Stock options', 'Learning & development'],
    salary: '$80,000 - $120,000',
    status: 'open',
  },
  {
    id: '4',
    title: 'Customer Support Specialist',
    department: 'Support',
    location: 'Remote',
    type: 'Part-time',
    description: 'Provide excellent customer support via chat, email, and phone to ensure user satisfaction.',
    requirements: ['Patience and empathy', 'Problem-solving skills', 'Multitasking ability'],
    benefits: ['Flexible hours', 'Remote work', 'Training provided', 'Part-time schedule'],
    salary: '$20 - $25/hr',
    status: 'open',
  },
]

export default function CareersPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [filter, setFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())

  const filteredPositions = careerPositions.filter((pos) => {
    const matchesFilter = filter === 'all' || pos.department.toLowerCase() === filter.toLowerCase()
    const matchesSearch = pos.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pos.department.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const departments = ['all', ...new Set(careerPositions.map((p) => p.department))]

  const handleApply = async (positionId: string) => {
    if (!user) {
      toast.error('Please sign in to apply for positions')
      navigate('/auth')
      return
    }
    try {
      const { error } = await supabase.from('career_applications').insert({
        user_id: user.id,
        position_id: positionId,
        status: 'applied',
        applied_at: new Date().toISOString(),
      })
      if (error) throw error
      setAppliedIds((prev) => new Set(prev).add(positionId))
      toast.success('Application submitted successfully!')
    } catch (err) {
      console.error('Application error:', err)
      toast.error('Failed to submit application. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1a0a2e] via-[#0d1b2a] to-[#1b2838]">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3')] bg-cover bg-center opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
              <Briefcase className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-medium">Join Our Team</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black mb-6">
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                Careers at TrollCity
              </span>
            </h1>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Build the future of community-driven entertainment. Find your role and help shape the next generation of interactive experiences.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Open Positions', value: careerPositions.filter((p) => p.status === 'open').length, icon: Briefcase },
            { label: 'Departments', value: departments.length - 1, icon: Users },
            { label: 'Remote Friendly', value: '100%', icon: MapPin },
          ].map((stat, idx) => (
            <div key={idx} className="bg-[#121212] border border-[#2C2C2C] rounded-2xl p-6 text-center">
              <stat.icon className="w-8 h-8 text-amber-400 mx-auto mb-3" />
              <div className="text-3xl font-black text-white">{stat.value}</div>
              <div className="text-sm text-zinc-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search positions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[#121212] border border-[#2C2C2C] rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setFilter(dept)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  filter === dept
                    ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                    : 'bg-[#121212] border border-[#2C2C2C] text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {dept === 'all' ? 'All' : dept}
              </button>
            ))}
          </div>
        </div>

        {/* Job Listings */}
        <div className="space-y-4">
          {filteredPositions.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-500">No positions found matching your search.</p>
            </div>
          ) : (
            filteredPositions.map((position) => (
              <div
                key={position.id}
                className="bg-[#121212] border border-[#2C2C2C] rounded-2xl p-6 hover:border-amber-500/30 transition-all group"
              >
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                        {position.title}
                      </h3>
                      <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                        {position.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-zinc-400 mb-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {position.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {position.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {position.type}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-sm mb-4">{position.description}</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {position.requirements.map((req, idx) => (
                        <span key={idx} className="px-2 py-1 rounded-full bg-[#1a1a2e] text-zinc-400 text-xs border border-[#2C2C2C]">
                          {req}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                      <DollarSign className="w-4 h-4" />
                      {position.salary}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 md:min-w-[140px]">
                    {appliedIds.has(position.id) ? (
                      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Applied
                      </div>
                    ) : (
                      <button
                        onClick={() => handleApply(position.id)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold rounded-xl transition-all hover:scale-105 text-sm"
                      >
                        Apply
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                    <button className="text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors text-center">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}