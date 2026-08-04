import React, { useState } from 'react'
import { Tournament } from './types'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import ParticipantsList from './ParticipantsList'
import Leaderboard from './Leaderboard'
import { FileText, Users, Trophy, GitBranch, Info } from 'lucide-react'

interface TournamentTabsProps {
  tournament: Tournament
}

export default function TournamentTabs({ tournament }: TournamentTabsProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'bracket', label: 'Bracket', icon: GitBranch },
    { id: 'participants', label: 'Participants', icon: Users },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'rules', label: 'Rules & Rewards', icon: FileText },
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-black/40 border-purple-500/20 backdrop-blur-md overflow-hidden relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <CardHeader>
                <CardTitle className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-200 uppercase tracking-tight">About This Event</CardTitle>
              </CardHeader>
              <CardContent className="text-gray-300 space-y-8 relative z-10">
                <p className="text-lg leading-relaxed font-light text-gray-200">{(tournament.description || "No description provided.").replace(/Neon City/i, 'MaiTroll')}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-purple-900/20 to-black p-6 rounded-2xl border border-purple-500/20 relative overflow-hidden group/card">
                    <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
                    <h3 className="font-bold text-purple-300 mb-2 uppercase tracking-wider text-sm flex items-center gap-2">
                      <Trophy className="w-4 h-4" /> Prize Pool
                    </h3>
                    <p className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">{tournament.prize_pool || "TBD"}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-900/20 to-black p-6 rounded-2xl border border-purple-500/20 relative overflow-hidden group/card">
                    <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
                    <h3 className="font-bold text-purple-300 mb-2 uppercase tracking-wider text-sm flex items-center gap-2">
                      <Users className="w-4 h-4" /> Entry Fee
                    </h3>
                    <p className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                      {tournament.entry_fee ? `${tournament.entry_fee} Coins` : "Free Entry"}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <h3 className="font-bold text-white mb-4 text-lg flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-400" />
                    How it Works
                  </h3>
                  <ul className="space-y-3 text-gray-400">
                    {[
                      "Register before the start date.",
                      "Compete in matches to earn points.",
                      "Top players advance to the finals.",
                      "Win big prizes and exclusive badges!"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
                        <span className="flex-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      case 'bracket':
        return (
          <Card className="bg-black/40 border-purple-500/20 min-h-[400px] flex items-center justify-center backdrop-blur-md relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent pointer-events-none" />
            <div className="text-center relative z-10">
              <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
                <GitBranch className="w-10 h-10 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Bracket Coming Soon</h3>
              <p className="text-gray-400 max-w-sm mx-auto">Matches will be generated once the tournament starts. Stay tuned for the pairings!</p>
            </div>
          </Card>
        )
      case 'participants':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ParticipantsList tournamentId={tournament.id} />
          </div>
        )
      case 'leaderboard':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Leaderboard tournamentId={tournament.id} />
          </div>
        )
      case 'rules':
        return (
          <Card className="bg-black/40 border-purple-500/20 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle className="text-2xl font-black text-white">Rules & Rewards</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300 space-y-4 whitespace-pre-wrap leading-relaxed font-light">
              {tournament.rules_text || "Standard Mai Troll tournament rules apply."}
            </CardContent>
          </Card>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex overflow-x-auto pb-4 gap-3 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative flex items-center gap-2.5 px-6 py-3 rounded-xl whitespace-nowrap transition-all duration-300 font-bold tracking-wide
                ${isActive 
                  ? 'bg-purple-600/20 text-white shadow-[0_0_20px_rgba(168,85,247,0.2)] border border-purple-500/50 backdrop-blur-md ring-1 ring-purple-500/30' 
                  : 'bg-black/20 text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-white/5 hover:border-white/10'}
              `}
            >
              {isActive && (
                <div className="absolute inset-0 bg-purple-500/10 rounded-xl animate-pulse pointer-events-none" />
              )}
              <Icon className={`w-5 h-5 ${isActive ? 'text-purple-300 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]' : ''}`} />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="min-h-[400px]">
        {renderContent()}
      </div>
    </div>
  )
}
