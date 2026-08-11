import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

export interface GamePlayer {
  id: string
  game_id: string
  user_id: string
  seat_index: number | null
  role: string | null
  is_eliminated: boolean
  is_seated: boolean
  is_muted: boolean
  is_alive: boolean
  has_voted: boolean
  votes_received: number
  profile?: {
    username: string
    avatar_url: string
  }
}

export interface TrollUsGameState {
  gameId: string | null
  status: 'lobby' | 'live' | 'ended' | null
  currentRound: number
  prizePool: number
  winnerTeam: string | null
  players: GamePlayer[]
  isHost: boolean
  myRole: string | null
  isSeated: boolean
  isEliminated: boolean
  isMuted: boolean
}

interface UseTrollUsGameProps {
  streamId: string
}

export function useTrollUsGame({ streamId }: UseTrollUsGameProps) {
  const { user } = useAuthStore()
  const [gameId, setGameId] = useState<string | null>(null)
  const [status, setStatus] = useState<'lobby' | 'live' | 'ended' | null>(null)
  const [currentRound, setCurrentRound] = useState(0)
  const [prizePool, setPrizePool] = useState(2000)
  const [winnerTeam, setWinnerTeam] = useState<string | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [isSeated, setIsSeated] = useState(false)
  const [isEliminated, setIsEliminated] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  // Load game if exists
  useEffect(() => {
    async function loadGame() {
      if (!streamId) return

      const { data: game } = await supabase
        .from('games')
        .select('*')
        .eq('stream_id', streamId)
        .eq('type', 'troll_us')
        .in('status', ['lobby', 'live'])
        .single()

      if (game) {
        setGameId(game.id)
        setStatus(game.status)
        setCurrentRound(game.current_round)
        setPrizePool(game.prize_pool)
        setWinnerTeam(game.winner_team)
        setIsHost(game.host_id === user?.id)

        // Load players with profiles
        const { data: gamePlayers } = await supabase
          .from('game_players')
          .select(`
            *,
            profile:user_profiles(username, avatar_url)
          `)
          .eq('game_id', game.id)
          .order('seat_index')

        if (gamePlayers) {
          setPlayers(gamePlayers.map(p => ({
            ...p,
            profile: p.profile
          })))
        }

        // Get my role
        if (user) {
          const myPlayer = gamePlayers?.find(p => p.user_id === user.id)
          if (myPlayer) {
            setMyRole(myPlayer.role)
            setIsSeated(myPlayer.is_seated)
            setIsEliminated(myPlayer.is_eliminated)
            setIsMuted(myPlayer.is_muted)
          }
        }
      }
    }

    loadGame()
  }, [streamId, user])

  // Subscribe to game updates
  useEffect(() => {
    if (!gameId) return

    const channel = supabase.channel(`troll_us:${gameId}`)
      .on('broadcast', { event: 'game_update' }, (payload) => {
        const { type, data } = payload.payload
        if (type === 'status_change') {
          setStatus(data.status)
          setCurrentRound(data.current_round)
        } else if (type === 'player_joined') {
          setPlayers(prev => [...prev, data.player])
        } else if (type === 'player_eliminated') {
          setPlayers(prev => prev.map(p => 
            p.user_id === data.user_id 
              ? { ...p, is_eliminated: true, is_muted: true, is_alive: false }
              : p
          ))
        } else if (type === 'game_ended') {
          setStatus('ended')
          setWinnerTeam(data.winner_team)
        }
      })
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [gameId])

  // Create game
  const createGame = useCallback(async () => {
    if (!user) {
      toast.error('You must be logged in to create a game')
      return null
    }

    setIsLoading(true)
    try {
      console.log('[TrollUs] Creating game for stream:', streamId)
      
      const { data, error } = await supabase.rpc('create_troll_us_game', {
        p_stream_id: streamId,
        p_host_id: user.id
      })

      if (error) {
        console.error('[TrollUs] RPC error:', error)
        throw new Error(error.message)
      }
      
      console.log('[TrollUs] Game created:', data)

      // Update stream to game mode
      const { error: updateError } = await supabase
        .from('streams')
        .update({ broadcast_mode: 'game', active_game_id: data })
        .eq('id', streamId)

      if (updateError) {
        console.error('[TrollUs] Stream update error:', updateError)
      }

      setGameId(data)
      setStatus('lobby')
      setIsHost(true)
      toast.success('Game created!')

      return data
    } catch (err: any) {
      console.error('[TrollUs] Create game error:', err)
      toast.error(err.message || 'Failed to create game - make sure database is migrated')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [streamId, user])

  // Join game seat
  const joinSeat = useCallback(async (seatIndex: number) => {
    if (!user || !gameId) return

    setIsLoading(true)
    try {
      const { error } = await supabase.rpc('join_game_seat', {
        p_game_id: gameId,
        p_user_id: user.id,
        p_seat_index: seatIndex
      })

      if (error) throw error

      // Reload players
      const { data: gamePlayers } = await supabase
        .from('game_players')
        .select(`
          *,
          profile:user_profiles(username, avatar_url)
        `)
        .eq('game_id', gameId)

      if (gamePlayers) {
        setPlayers(gamePlayers.map(p => ({
          ...p,
          profile: p.profile
        })))
      }

      setIsSeated(true)
      toast.success('Joined the game!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to join seat')
    } finally {
      setIsLoading(false)
    }
  }, [gameId, user])

  // Start game
  const startGame = useCallback(async () => {
    if (!gameId || !isHost) return

    setIsLoading(true)
    try {
      const { error } = await supabase.rpc('start_troll_us_game', {
        p_game_id: gameId
      })

      if (error) throw error

      setStatus('live')
      setCurrentRound(1)

      // Get my role
      const { data: myPlayer } = await supabase
        .from('game_players')
        .select('role')
        .eq('game_id', gameId)
        .eq('user_id', user?.id)
        .single()

      if (myPlayer) {
        setMyRole(myPlayer.role)
      }

      toast.success('Game started!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to start game')
    } finally {
      setIsLoading(false)
    }
  }, [gameId, isHost, user])

  // Submit vote
  const submitVote = useCallback(async (targetUserId: string) => {
    if (!user || !gameId || isEliminated || !isSeated) return

    setIsLoading(true)
    try {
      const { error } = await supabase.rpc('submit_game_vote', {
        p_game_id: gameId,
        p_voter_id: user.id,
        p_target_id: targetUserId,
        p_round: currentRound
      })

      if (error) throw error

      toast.success('Vote submitted!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit vote')
    } finally {
      setIsLoading(false)
    }
  }, [gameId, user, currentRound, isEliminated, isSeated])

  // End round (host only)
  const endRound = useCallback(async () => {
    if (!gameId || !isHost) return

    setIsLoading(true)
    try {
      const { data, error } = await supabase.rpc('end_troll_us_round', {
        p_game_id: gameId
      })

      if (error) throw error

      if (data === 'hunters_win') {
        setWinnerTeam('hunters')
        setStatus('ended')
        toast.success('Hunters win! Prize distributed.')

        // Distribute prize
        await supabase.rpc('distribute_prize', { p_game_id: gameId })
      } else if (data === 'troll_win') {
        setWinnerTeam('troll')
        setStatus('ended')
        toast.success('Troll wins! Prize goes to troll.')
      } else {
        setCurrentRound(prev => prev + 1)
        toast.success(`Round ${currentRound} ended. Starting round ${currentRound + 1}...`)
      }

      // Reload players for vote counts
      const { data: gamePlayers } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_id', gameId)

      if (gamePlayers) {
        setPlayers(gamePlayers)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to end round')
    } finally {
      setIsLoading(false)
    }
  }, [gameId, isHost, currentRound])

  // End game
  const endGame = useCallback(async () => {
    if (!gameId || !isHost) return

    setIsLoading(true)
    try {
      // Reset stream
      await supabase
        .from('streams')
        .update({ broadcast_mode: 'normal', active_game_id: null })
        .eq('id', streamId)

      // End game
      await supabase
        .from('games')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', gameId)

      setGameId(null)
      setStatus(null)
      setPlayers([])
      setWinnerTeam(null)

      toast.success('Game ended')
    } catch (err: any) {
      toast.error(err.message || 'Failed to end game')
    } finally {
      setIsLoading(false)
    }
  }, [gameId, isHost, streamId])

  const gameState: TrollUsGameState = useMemo(() => ({
    gameId,
    status,
    currentRound,
    prizePool,
    winnerTeam,
    players,
    isHost,
    myRole: isHost ? null : myRole, // Don't expose role to non-hosts
    isSeated,
    isEliminated,
    isMuted
  }), [gameId, status, currentRound, prizePool, winnerTeam, players, isHost, myRole, isSeated, isEliminated, isMuted])

  return {
    gameState,
    isLoading,
    createGame,
    joinSeat,
    startGame,
    submitVote,
    endRound,
    endGame,
    myRole
  }
}