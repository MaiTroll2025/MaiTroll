import React from 'react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Tournament, Participant } from './types'
import { Calendar, Users, Trophy } from 'lucide-react'

interface TournamentHeroProps {
  tournament: Tournament
  participant?: Participant | null
  onJoin: () => void
  loading?: boolean
}

export default function TournamentHero({ tournament, participant, onJoin, loading }: TournamentHeroProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-red-600 hover:bg-red-700 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.7)]'
      case 'open': return 'bg-green-600 hover:bg-green-700 shadow-[0_0_15px_rgba(34,197,94,0.6)]'
      case 'upcoming': return 'bg-blue-600 hover:bg-blue-700 shadow-[0_0_15px_rgba(37,99,235,0.6)]'
      case 'ended': return 'bg-gray-600 hover:bg-gray-700'
      default: return 'bg-gray-600'
    }
  }

  const getPrimaryAction = () => {
    if (participant) {
      return (
        <Button size="lg" className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-8 shadow-[0_0_25px_rgba(147,51,234,0.5)] border border-purple-400/50 transition-all hover:scale-105">
          View My Entry
        </Button>
      )
    }

    if (tournament.status === 'ended') {
      return (
        <Button size="lg" variant="outline" className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10 hover:text-white transition-all">
          View Results
        </Button>
      )
    }

    if (tournament.status === 'live') {
      return (
        <Button size="lg" className="bg-red-600 hover:bg-red-500 text-white font-bold px-8 animate-pulse shadow-[0_0_30px_rgba(220,38,38,0.6)] border border-red-400/50">
          Watch Live Battle
        </Button>
      )
    }

    if (tournament.status === 'open' || tournament.status === 'upcoming') {
       return (
         <Button 
           size="lg" 
           className="bg-green-600 hover:bg-green-500 text-white font-bold px-8 shadow-[0_0_30px_rgba(34,197,94,0.6)] border border-green-400/50 transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(34,197,94,0.8)]"
           onClick={onJoin}
           disabled={loading}
         >
           {loading ? 'Joining...' : 'Join Tournament'}
         </Button>
       )
    }
    
    return null
  }

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-purple-500/50 bg-black/80 shadow-[0_0_50px_rgba(147,51,234,0.25)] group">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-900/40 via-black/80 to-slate-900/90 z-0" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-1000" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl opacity-30" />
      
      <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="space-y-6 max-w-2xl">
          <div className="flex items-center gap-3">
            <Badge className={`${getStatusColor(tournament.status)} text-white border-none px-4 py-1.5 uppercase tracking-widest font-bold text-xs`}>
              {tournament.status}
            </Badge>
            {tournament.season && (
              <Badge variant="outline" className="text-purple-300 border-purple-500/50 bg-purple-500/10 backdrop-blur-sm px-3 py-1">
                Season {tournament.season}
              </Badge>
            )}
          </div>
          
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-purple-300 tracking-tight uppercase drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
              {tournament.title.replace(/Neon City/i, 'MaiTroll')}
            </h1>
            
            <p className="text-xl md:text-2xl text-purple-100/80 font-light max-w-xl leading-relaxed">
              {(tournament.subtitle || "The ultimate citywide tournament series.").replace(/Neon City/i, 'MaiTroll')}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-6 text-sm font-medium pt-4">
            <div className="flex items-center gap-2 text-purple-200 bg-purple-900/30 px-3 py-1.5 rounded-lg border border-purple-500/30">
              <Calendar className="w-4 h-4 text-purple-400" />
              {new Date(tournament.start_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            {tournament.prize_pool && (
              <div className="flex items-center gap-2 text-yellow-100 bg-yellow-900/20 px-3 py-1.5 rounded-lg border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-200/70">Prize Pool:</span>
                <span className="text-yellow-400 font-bold tracking-wide">{tournament.prize_pool}</span>

              </div>
            )}
             {tournament.max_participants && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Max Participants: {tournament.max_participants}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 min-w-[200px]">
          {getPrimaryAction()}
        </div>
      </div>
    </div>
  )
}
