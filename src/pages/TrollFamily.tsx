// src/pages/TrollFamily.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Users, Crown, Search, Trophy, Flame } from 'lucide-react'

interface TrollFamily {
  id: string
  name: string
  description: string
  leader_id: string
  leader_username?: string
  member_count: number
  created_at: string
  weekly_tasks?: number
}

export default function TrollFamily() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [checking, setChecking] = useState(true)
  const [isLeader, setIsLeader] = useState(false)
  const [_userFamilyId, _setUserFamilyId] = useState<string | null>(null)

  const [families, setFamilies] = useState<TrollFamily[]>([])
  const [loadingFamilies, setLoadingFamilies] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')

  // =========================================
  // CHECK IF USER IS LEADER OR MEMBER
  // =========================================
  useEffect(() => {
    const checkFamilyMembership = async () => {
      if (!user) {
        setChecking(false)
        navigate('/family/browse', { replace: true })
        return
      }

      try {
        const { data: leaderData } = await supabase
          .from('troll_families')
          .select('id')
          .eq('leader_id', user.id)
          .maybeSingle()

        if (leaderData?.id) {
          setIsLeader(true)
          navigate('/family/home', { replace: true })
          return
        }

        const { data: memberData } = await supabase
          .from('family_members')
          .select('family_id')
          .eq('user_id', user.id)
          .eq('approval_status', 'approved')
          .limit(1)
          .maybeSingle()

        if (memberData?.family_id) {
          navigate('/family/home', { replace: true })
          return
        }

        setChecking(false)
      } catch (err) {
        console.error(err)
        setChecking(false)
      }
    }

    checkFamilyMembership()
  }, [navigate, user])

  // =========================================
  // FETCH FAMILIES + WEEKLY TASK DATA
  // =========================================
  useEffect(() => {
    const fetchFamilies = async () => {
      setLoadingFamilies(true)

      try {
        const { data: familiesData } = await supabase
          .from('troll_families')
          .select('*')

        const { data: members } = await supabase
          .from('family_members')
          .select('family_id')

        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username')

        const { data: weekly } = await supabase.rpc('get_weekly_family_task_counts')

        const countMap: Record<string, number> = {}
        members?.forEach(m => {
          countMap[m.family_id] = (countMap[m.family_id] || 0) + 1
        })

        const usernameMap: Record<string, string> = {}
        profiles?.forEach(p => {
          usernameMap[p.id] = p.username
        })

        const weeklyMap: Record<string, number> = {}
        weekly?.forEach((w: any) => {
          weeklyMap[w.family_id] = w.task_count
        })

        const combined = (familiesData || []).map(f => ({
          ...f,
          member_count: countMap[f.id] || 0,
          leader_username: usernameMap[f.leader_id] || 'Unknown',
          weekly_tasks: weeklyMap[f.id] || 0
        }))

        // 🔥 SORT BY DOMINANCE (weekly tasks first, then members)
        combined.sort((a, b) => {
          if (b.weekly_tasks !== a.weekly_tasks) return b.weekly_tasks - a.weekly_tasks
          return b.member_count - a.member_count
        })

        setFamilies(combined)
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingFamilies(false)
      }
    }

    fetchFamilies()
  }, [])

  // =========================================
  // FILTER
  // =========================================
  const filteredFamilies = useMemo(() => {
    return families.filter(f =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [families, searchTerm])

  if (checking) return <div className="text-white p-6">Loading...</div>

  return (
    <div className="min-h-screen bg-[#05010a] text-white p-6">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black mb-2">🏙️ Troll Families</h1>
          <p className="text-gray-400">Dominate the city. Build your legacy.</p>
        </div>

        {/* SEARCH */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-3 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search families..."
            className="w-full pl-10 py-3 bg-white/10 border border-white/20 rounded-xl"
          />
        </div>

        {/* ACTIONS */}
        <div className="flex gap-4 mb-6">
          {isLeader && (
            <button
              onClick={() => navigate('/family/home')}
              className="flex-1 bg-yellow-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              <Crown /> My Family
            </button>
          )}

           <button
             onClick={() => navigate('/family/create')}
             className="flex-1 bg-green-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
           >
             <Users /> Create Family
           </button>
        </div>

        {/* GRID */}
        {loadingFamilies ? (
          <div className="text-center py-10">Loading families...</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">

            {filteredFamilies.map((family, index) => {
              const isTop = index === 0

              return (
                <div
                  key={family.id}
                  onClick={() => navigate(`/family/${family.id}`)}
                  className={`p-5 rounded-xl cursor-pointer transition ${
                    isTop
                      ? 'bg-purple-900/40 border border-yellow-400'
                      : 'bg-white/10 border border-white/20 hover:bg-white/20'
                  }`}
                >
                  {/* HEADER */}
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      {isTop && <Trophy className="text-yellow-400" />}
                      {family.name}
                    </h3>

                    <span className="text-sm text-gray-400">
                      {family.member_count} members
                    </span>
                  </div>

                  {/* DESCRIPTION */}
                  <p className="text-gray-300 text-sm mb-3">
                    {family.description}
                  </p>

                  {/* STATS */}
                  <div className="flex justify-between text-sm">

                    <span className="flex items-center gap-1 text-purple-300">
                      <Flame size={14} />
                      {family.weekly_tasks} tasks
                    </span>

                    <span className="text-gray-500">
                      Leader: {family.leader_username}
                    </span>

                  </div>

                  {/* RANK */}
                  <div className="mt-3 text-xs text-gray-400">
                    Rank #{index + 1}
                  </div>
                </div>
              )
            })}

          </div>
        )}
      </div>
    </div>
  )
}