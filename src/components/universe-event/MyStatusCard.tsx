import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Participant, Tournament } from './types'
import { Crown, Trophy, AlertCircle, Share2, LogOut } from 'lucide-react'
import { useAuthStore } from '../../lib/store'
import { useNavigate } from 'react-router-dom'

interface MyStatusCardProps {
  participant?: Participant | null
  tournament?: Tournament | null
  onJoin: () => void
  onWithdraw?: () => void
  loading?: boolean
}

export default function MyStatusCard({ participant, tournament, onJoin, onWithdraw, loading }: MyStatusCardProps) {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  if (!user) {
    return (
       <Card className="bg-black/60 border-purple-500/50 backdrop-blur-md shadow-[0_0_20px_rgba(147,51,234,0.15)]">
        <CardHeader>
           <CardTitle className="text-white font-bold flex items-center gap-2">
             <AlertCircle className="w-5 h-5 text-purple-400" />
             Join the Action
           </CardTitle>
        </CardHeader>
        <CardContent>
           <p className="text-gray-300 mb-6 text-sm">Log in to participate in the tournament and track your progress.</p>
           <Button className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-[0_0_15px_rgba(147,51,234,0.4)] transition-all hover:scale-105" onClick={() => navigate('/auth')}>
             Log In to Join
           </Button>
        </CardContent>
       </Card>
    )
  }

  if (!tournament) return null

  if (!participant) {
    const canJoin = tournament.status === 'open' || tournament.status === 'upcoming'
    const isFull = tournament.max_participants && (tournament as any).participant_count >= tournament.max_participants // Assuming we get count

    return (
      <Card className="bg-black/60 border-purple-500/50 backdrop-blur-md shadow-[0_0_20px_rgba(147,51,234,0.15)]">
        <CardHeader>
           <CardTitle className="text-white flex items-center gap-2 font-bold">
             <Trophy className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.6)]" />
             My Status
           </CardTitle>
        </CardHeader>
        <CardContent>
           <p className="text-gray-300 mb-6 text-sm">You haven&apos;t joined this tournament yet. Sign up now to compete!</p>
           {canJoin ? (
             <Button 
               className="w-full bg-green-600 hover:bg-green-500 text-white font-bold shadow-[0_0_20px_rgba(34,197,94,0.5)] border border-green-400/50 transition-all hover:scale-105"
               onClick={onJoin}
               disabled={loading || isFull}
             >
               {loading ? 'Joining...' : isFull ? 'Tournament Full' : 'Join Tournament'}
             </Button>
           ) : (
             <Button className="w-full bg-gray-700/50 text-gray-400 border border-gray-600" variant="secondary" disabled>
               Registration Closed
             </Button>
           )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-black/60 border-purple-500/50 backdrop-blur-md shadow-[0_0_30px_rgba(147,51,234,0.25)] relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
        <Crown className="w-32 h-32 text-purple-500 rotate-12" />
      </div>
      
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2 font-bold">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
          You are Registered
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4 relative z-10">
        <div className="flex justify-between items-center bg-purple-900/30 p-3 rounded-xl border border-purple-500/30">
          <span className="text-purple-200/70 text-sm font-medium">Status</span>
          <span className={`font-bold ${participant.status === 'active' ? 'text-green-400 drop-shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'text-red-400'}`}>
            {(participant.status || 'Active').toUpperCase()}
          </span>
        </div>
        
        {participant.placement && (
           <div className="flex justify-between items-center bg-yellow-900/20 p-3 rounded-xl border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
             <span className="text-yellow-200/70 text-sm font-medium">Current Rank</span>
             <span className="font-black text-yellow-400 text-xl drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]">#{participant.placement}</span>
           </div>
        )}

        <div className="grid grid-cols-2 gap-3">
           <div className="bg-black/40 p-3 rounded-xl border border-gray-800 hover:border-purple-500/30 transition-colors">
             <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Wins</div>
             <div className="text-xl font-bold text-white">{participant.wins || 0}</div>
           </div>
           <div className="bg-black/40 p-3 rounded-xl border border-gray-800 hover:border-purple-500/30 transition-colors">
             <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Points</div>
             <div className="text-xl font-bold text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]">{participant.points || 0}</div>
           </div>
        </div>

        <div className="pt-2 flex gap-2">
           <Button variant="outline" size="sm" className="flex-1 border-purple-500/30 hover:bg-purple-900/20 text-white">
             <Share2 className="w-4 h-4 mr-2" /> Share
           </Button>
           {tournament.status === 'open' && onWithdraw && (
             <Button 
               variant="destructive" 
               size="sm" 
               className="flex-1 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50"
               onClick={onWithdraw}
             >
               <LogOut className="w-4 h-4 mr-2" /> Withdraw
             </Button>
           )}
        </div>
      </CardContent>
    </Card>
  )
}
