import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

export type ElectionState = 'draft' | 'open' | 'closed' | 'finalized';

export interface PresidentElection {
  id: string;
  starts_at: string;
  ends_at: string;
  title?: string;
  description?: string;
  status: ElectionState;
  winner_candidate_id: string | null;
  created_at: string;
  voting_strategy: 'standard' | 'coins';
  candidate_limit?: number;
  candidates?: PresidentCandidate[];
}

export interface PresidentCandidate {
  [x: string]: string;
  id: string;
  election_id: string;
  user_id: string;
  slogan: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  vote_count: number;
  score: number; // New score field
  created_at: string;
  is_approved?: boolean; // Derived helper
  username?: string; // Joined
  avatar_url?: string; // Joined
}

export interface PresidentAppointment {
  id: string;
  president_user_id: string;
  vice_president_user_id: string;
  starts_at: string;
  ends_at: string;
  status: 'active' | 'removed' | 'expired';
  appointee?: {
    username: string;
    avatar_url: string;
  };
  avatar_url?: string;
}

export interface TreasuryEntry {
  id: string;
  kind: 'deposit' | 'reserve' | 'release' | 'spend' | 'refund';
  amount_cents: number;
  currency: string;
  created_by: string; // actor_id
  created_at: string;
}

const PRESIDENT_CACHE_TTL_MS = 20 * 1000;

let currentElectionCache: { data: PresidentElection | null; fetchedAt: number } = {
  data: null,
  fetchedAt: 0,
};
let presidentElectionFetchPromise: Promise<void> | null = null;

let currentPresidentCache: { data: { user_id: string; username: string; avatar_url: string } | null; fetchedAt: number } = {
  data: null,
  fetchedAt: 0,
};
let currentPresidentFetchPromise: Promise<void> | null = null;

let currentVPCache: { data: PresidentAppointment | null; fetchedAt: number } = {
  data: null,
  fetchedAt: 0,
};
let currentVPFetchPromise: Promise<void> | null = null;

let treasuryBalanceCache: { data: number; fetchedAt: number } = {
  data: 0,
  fetchedAt: 0,
};
let treasuryBalanceFetchPromise: Promise<void> | null = null;

let proposalsCache: { data: any[]; fetchedAt: number } = {
  data: [],
  fetchedAt: 0,
};
let proposalsFetchPromise: Promise<void> | null = null;

let allElectionsCache: { data: PresidentElection[]; fetchedAt: number } = {
  data: [],
  fetchedAt: 0,
};
let allElectionsFetchPromise: Promise<void> | null = null;

const sortIds = (items: string[] = []) => [...items].sort();
const areIdsEqual = (a: string[] | null, b: string[] | null) => {
  if (!a || !b || a.length !== b.length) return false;
  const sortedA = sortIds(a);
  const sortedB = sortIds(b);
  return sortedA.every((value, index) => value === sortedB[index]);
};

export const usePresidentSystem = () => {
  const { user } = useAuthStore();
  const [currentElection, setCurrentElection] = useState<PresidentElection | null>(null);
  const [currentPresident, setCurrentPresident] = useState<{ user_id: string; username: string; avatar_url: string } | null>(null);
  const [currentVP, setCurrentVP] = useState<PresidentAppointment | null>(null);
  const [treasuryBalance, setTreasuryBalance] = useState<number>(0);
  const [proposals, setProposals] = useState<any[]>([]); // Added missing state
  const [allElections, setAllElections] = useState<PresidentElection[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const now = Date.now();
    if (currentElectionCache.data && now - currentElectionCache.fetchedAt < PRESIDENT_CACHE_TTL_MS) {
      setCurrentElection(currentElectionCache.data);
    }
    if (currentPresidentCache.data && now - currentPresidentCache.fetchedAt < PRESIDENT_CACHE_TTL_MS) {
      setCurrentPresident(currentPresidentCache.data);
    }
    if (currentVPCache.data && now - currentVPCache.fetchedAt < PRESIDENT_CACHE_TTL_MS) {
      setCurrentVP(currentVPCache.data);
    }
    if (now - treasuryBalanceCache.fetchedAt < PRESIDENT_CACHE_TTL_MS) {
      setTreasuryBalance(treasuryBalanceCache.data);
    }
    if (now - proposalsCache.fetchedAt < PRESIDENT_CACHE_TTL_MS) {
      setProposals(proposalsCache.data);
    }
    if (now - allElectionsCache.fetchedAt < PRESIDENT_CACHE_TTL_MS) {
      setAllElections(allElectionsCache.data);
    }
  }, []);

const fetchCurrentElection = useCallback(async () => {
     const now = Date.now();
     if (currentElectionCache.data && now - currentElectionCache.fetchedAt < PRESIDENT_CACHE_TTL_MS) {
       setCurrentElection(currentElectionCache.data);
       return;
     }

     if (presidentElectionFetchPromise) {
       await presidentElectionFetchPromise;
       if (currentElectionCache.data) {
         setCurrentElection(currentElectionCache.data);
       }
       return;
     }

     presidentElectionFetchPromise = (async () => {
       try {
         const { data, error } = await supabase
           .from('president_elections')
           .select(`
             *,
             candidates:president_candidates!president_candidates_election_id_fkey(
               *,
               user:user_profiles(username, avatar_url)
             )
           `)
           .order('created_at', { ascending: false })
           .limit(1)
           .maybeSingle();

         if (error) throw error;

         if (!data) {
           currentElectionCache = { data: null, fetchedAt: Date.now() };
           setCurrentElection(null);
           return;
         }

         console.log('[President] candidates loaded', data.candidates?.length ?? 0);

         let candidates = data.candidates?.map((c: any) => ({
           ...c,
           username: c.user?.username,
           avatar_url: c.user?.avatar_url,
           is_approved: c.status === 'approved'
         })) || [];

         const candidateIds = candidates.map((c: any) => c.id);
         const cachedCandidateIds = currentElectionCache.data?.candidates?.map((c) => c.id) || null;
         const useCachedVoteCounts = currentElectionCache.data && areIdsEqual(candidateIds, cachedCandidateIds);

         if (candidates.length > 0) {
           if (useCachedVoteCounts && currentElectionCache.data?.candidates) {
             const cachedVoteMap = currentElectionCache.data.candidates.reduce<Record<string, number>>((acc, candidate) => {
               acc[candidate.id] = candidate.vote_count ?? 0;
               return acc;
             }, {});

             candidates = candidates.map((c: any) => ({
               ...c,
               vote_count: cachedVoteMap[c.id] ?? c.vote_count ?? c.score ?? 0,
             }));
           } else {
             console.log('[President] fetching vote counts for candidates:', candidateIds);
             const { data: voteRows, error: voteError } = await supabase
               .from('president_votes')
               .select('candidate_id')
               .in('candidate_id', candidateIds);

             if (voteError) throw voteError;
             console.log('[President] vote rows loaded', voteRows?.length ?? 0);

             const voteCountMap: Record<string, number> = {};
             voteRows?.forEach((v: any) => {
               voteCountMap[v.candidate_id] = (voteCountMap[v.candidate_id] || 0) + 1;
             });
             console.log('[President] vote count map', voteCountMap);

             candidates = candidates.map((c: any) => ({
               ...c,
               vote_count: voteCountMap[c.id] ?? c.vote_count ?? c.score ?? 0,
             }));
           }
         }

         const electionWithCandidates = { ...data, candidates };
         currentElectionCache = { data: electionWithCandidates, fetchedAt: Date.now() };
         setCurrentElection(electionWithCandidates);
       } catch (err) {
         console.error('Error fetching election:', err);
       } finally {
         presidentElectionFetchPromise = null;
       }
     })();

     await presidentElectionFetchPromise;
   }, []);

  const fetchCurrentPresident = useCallback(async () => {
    const now = Date.now();
    if (currentPresidentCache.data && now - currentPresidentCache.fetchedAt < PRESIDENT_CACHE_TTL_MS) {
      setCurrentPresident(currentPresidentCache.data);
      return;
    }

    if (currentPresidentFetchPromise) {
      await currentPresidentFetchPromise;
      if (currentPresidentCache.data) {
        setCurrentPresident(currentPresidentCache.data);
      }
      return;
    }

    currentPresidentFetchPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .or('badge.eq.president,username_style.eq.gold')
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          currentPresidentCache = { data: { user_id: data.id, username: data.username, avatar_url: data.avatar_url }, fetchedAt: Date.now() };
          setCurrentPresident(currentPresidentCache.data);
          return;
        }

        const { data: election } = await supabase
          .from('president_elections')
          .select('winner_candidate_id')
          .eq('status', 'finalized')
          .order('end_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (election?.winner_candidate_id) {
          const { data: candidate } = await supabase
            .from('president_candidates')
            .select('user_id')
            .eq('id', election.winner_candidate_id)
            .maybeSingle();

          if (candidate) {
            const { data: user } = await supabase
              .from('user_profiles')
              .select('id, username, avatar_url')
              .eq('id', candidate.user_id)
              .maybeSingle();

            if (user) {
              currentPresidentCache = { data: { user_id: user.id, username: user.username, avatar_url: user.avatar_url }, fetchedAt: Date.now() };
              setCurrentPresident(currentPresidentCache.data);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching president:', err);
      } finally {
        currentPresidentFetchPromise = null;
      }
    })();

    await currentPresidentFetchPromise;
  }, []);

  const fetchVicePresident = useCallback(async () => {
      const now = Date.now();
      if (currentVPCache.data && now - currentVPCache.fetchedAt < PRESIDENT_CACHE_TTL_MS) {
        setCurrentVP(currentVPCache.data);
        return;
      }

      if (currentVPFetchPromise) {
        await currentVPFetchPromise;
        if (currentVPCache.data) {
          setCurrentVP(currentVPCache.data);
        }
        return;
      }

      currentVPFetchPromise = (async () => {
        try {
          const { data, error } = await supabase
            .from('president_appointments')
            .select(`
                *,
                appointee:user_profiles!president_appointments_vice_president_user_id_fkey(username, avatar_url)
            `)
            .eq('status', 'active')
            .maybeSingle();

          if (error) throw error;

          if (data) {
            currentVPCache = { data: data as PresidentAppointment, fetchedAt: Date.now() };
            setCurrentVP(currentVPCache.data);
          } else {
            currentVPCache = { data: null, fetchedAt: Date.now() };
            setCurrentVP(null);
          }
        } catch (err) {
          console.error('Error fetching VP:', err);
        } finally {
          currentVPFetchPromise = null;
        }
      })();

      await currentVPFetchPromise;
  }, []);

  const fetchPresidentAppointment = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('president_appointments')
        .select(`
          *,
          appointee:user_profiles!president_appointments_president_user_id_fkey(username, avatar_url)
        `)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCurrentPresident({
          user_id: data.president_user_id,
          username: data.appointee?.username,
          avatar_url: data.appointee?.avatar_url,
        });
      } else {
        // Leave currentPresident to other fetch as fallback
      }
    } catch (err) {
      console.error('Error fetching active president appointment:', err);
    }
  }, []);
  
  const fetchTreasuryBalance = useCallback(async () => {
      const now = Date.now();
      if (now - treasuryBalanceCache.fetchedAt < PRESIDENT_CACHE_TTL_MS) {
        setTreasuryBalance(treasuryBalanceCache.data);
        return;
      }

      if (treasuryBalanceFetchPromise) {
        await treasuryBalanceFetchPromise;
        setTreasuryBalance(treasuryBalanceCache.data);
        return;
      }

      treasuryBalanceFetchPromise = (async () => {
        try {
          const { data } = await supabase
            .from('president_treasury_balance')
            .select('balance_cents')
            .eq('currency', 'USD')
            .maybeSingle();

          if (data) {
            treasuryBalanceCache = { data: data.balance_cents / 100, fetchedAt: Date.now() };
            setTreasuryBalance(treasuryBalanceCache.data);
          } else {
            treasuryBalanceCache = { data: 0, fetchedAt: Date.now() };
            setTreasuryBalance(0);
          }
        } catch (err) {
          console.error(err);
        } finally {
          treasuryBalanceFetchPromise = null;
        }
      })();

      await treasuryBalanceFetchPromise;
  }, []);

  const fetchProposals = useCallback(async () => {
    const now = Date.now();
    if (now - proposalsCache.fetchedAt < PRESIDENT_CACHE_TTL_MS) {
      setProposals(proposalsCache.data);
      return;
    }

    if (proposalsFetchPromise) {
      await proposalsFetchPromise;
      setProposals(proposalsCache.data);
      return;
    }

    proposalsFetchPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('president_proposals')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        proposalsCache = { data: data || [], fetchedAt: Date.now() };
        setProposals(proposalsCache.data);
      } catch (err) {
        console.error('Error fetching proposals:', err);
      } finally {
        proposalsFetchPromise = null;
      }
    })();

    await proposalsFetchPromise;
  }, []);

  const createElection = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('create_president_election');
      if (error) throw error;
      toast.success('Election created successfully');
      fetchCurrentElection();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const finalizeElection = async (electionId: string) => {
    setLoading(true);
    try {
      // If election is still open, end it first (allows secretaries to finalize early)
      const { data: election } = await supabase
        .from('president_elections')
        .select('status')
        .eq('id', electionId)
        .maybeSingle();

      if (!election) {
        toast.error('Election not found');
        setLoading(false);
        return;
      }

      if (election?.status === 'open') {
        await supabase
          .from('president_elections')
          .update({ status: 'closed', ends_at: new Date(Date.now() - 1000).toISOString() })
          .eq('id', electionId);
      }

      const { error } = await supabase.rpc('finalize_president_election', {
        p_election_id: electionId
      });
      if (error) throw error;
      toast.success('Election finalized!');
      fetchCurrentElection();
      fetchCurrentPresident();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const endElection = async (electionId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('president_elections')
        .update({ status: 'closed', ends_at: new Date().toISOString() })
        .eq('id', electionId);

      if (error) throw error;
      toast.success('Election ended successfully');
      fetchCurrentElection();
      fetchAllElections();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteElection = async (electionId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('president_elections')
        .delete()
        .eq('id', electionId);

      if (error) throw error;
      toast.success('Election deleted successfully');
      fetchCurrentElection();
      fetchAllElections();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllElections = useCallback(async () => {
    const now = Date.now();
    if (now - allElectionsCache.fetchedAt < PRESIDENT_CACHE_TTL_MS) {
      setAllElections(allElectionsCache.data);
      return;
    }

    if (allElectionsFetchPromise) {
      await allElectionsFetchPromise;
      setAllElections(allElectionsCache.data);
      return;
    }

    allElectionsFetchPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('president_elections')
          .select(`
            *,
            candidates:president_candidates!president_candidates_election_id_fkey(
              *,
              user:user_profiles(username, avatar_url)
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          console.log('[President] all elections loaded', data.length);
          const formattedElections = data.map((election: any) => ({
            ...election,
            candidates: election.candidates?.map((c: any) => ({
              ...c,
              username: c.user?.username,
              avatar_url: c.user?.avatar_url,
              is_approved: c.status === 'approved'
            })) || []
          }));
          allElectionsCache = { data: formattedElections, fetchedAt: Date.now() };
          setAllElections(formattedElections);
        }
      } catch (err) {
        console.error('Error fetching all elections:', err);
      } finally {
        allElectionsFetchPromise = null;
      }
    })();

    await allElectionsFetchPromise;
  }, []);

   const signupCandidate = async (electionId: string, slogan: string, statement: string, bannerPath: string = 'default') => {
     setLoading(true);
     try {
       const { data: { user } } = await supabase.auth.getUser();
       
       // Check if user is currently jailed (active sentence)
       const { data: jailData } = await supabase
         .from('jail')
         .select('release_time')
         .eq('user_id', user?.id)
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle();
       
       if (jailData) {
         const releaseTime = new Date(jailData.release_time);
         if (releaseTime > new Date()) {
           toast.error('You cannot run for president while incarcerated. Please serve your sentence first.');
           setLoading(false);
           return;
         }
       }
       
       // Check if user has background jail status (released within last 24 hours)
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('is_background_jailed')
          .eq('id', user?.id)
          .maybeSingle();
          
        if (profileError) {
          console.error('Error fetching profile for background jail check:', profileError);
          // Don't block signup on profile fetch error, but log it
        } else if (profileData?.is_background_jailed) {
         toast.error('You cannot run for president while your jail record is recent. Please wait 24 hours after release.');
         setLoading(false);
         return;
       }
       
       const displayName = user?.user_metadata?.username || 'Unknown';

       const { error } = await supabase.rpc('signup_president_candidate', {
         p_election_id: electionId,
         p_banner_path: bannerPath,
         p_display_name: displayName,
         p_slogan: slogan,
         p_statement: statement
       });
       
       if (error) throw error;

       toast.success('Signed up as candidate!');
       fetchCurrentElection();
     } catch (err: any) {
       toast.error(err.message);
     } finally {
       setLoading(false);
     }
   };

  const approveCandidate = async (candidateId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('approve_president_candidate', {
        p_candidate_id: candidateId
      });
      if (error) throw error;
      toast.success('Candidate approved');
      fetchCurrentElection();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const rejectCandidate = async (candidateId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('reject_president_candidate', {
        p_candidate_id: candidateId
      });
      if (error) throw error;
      toast.success('Candidate rejected');
      fetchCurrentElection();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

const voteForCandidate = async (candidateId: string) => {
     setLoading(true);
     try {
       if (!currentElection) return;

       const { data, error } = await supabase.rpc('vote_for_president_candidate', {
         p_election_id: currentElection.id,
         p_candidate_id: candidateId
       });

       if (error) throw error;

       // Check if already voted
       if (data?.already_voted) {
         toast.success('You already voted this week');
         return;
       }

if (data?.success) {
          console.log('[President] vote submitted for candidate', candidateId);
          toast.success('Vote cast successfully!');
          await fetchCurrentElection();
          console.log('[President] refreshed vote counts');
        } else {
         toast.error(data?.message || 'Failed to cast vote');
       }
     } catch (err: any) {
       // Handle duplicate key constraint error gracefully
       if (err.message?.includes('duplicate') || err.message?.includes('already_voted')) {
         toast.success('You already voted this week');
       } else {
         toast.error(err.message || 'Failed to cast vote');
       }
     } finally {
       setLoading(false);
     }
   };

const voteWithCoins = async (candidateId: string, amount: number) => {
     setLoading(true);
     try {
       const { data, error } = await supabase.rpc('vote_candidate_with_coins', {
         p_candidate_id: candidateId,
         p_amount: amount
       });
       if (error) throw error;

       // Check if already voted
       if (data?.already_voted) {
         toast.success('You already voted this week');
         return;
       }

       toast.success(`Cast ${amount} coin votes!`);
       await fetchCurrentElection();
     } catch (err: any) {
       if (err.message?.includes('duplicate') || err.message?.includes('already_voted')) {
         toast.success('You already voted this week');
       } else {
         toast.error(err.message || 'Failed to vote');
       }
     } finally {
       setLoading(false);
     }
   };

  const createProposal = async (title: string, description: string, type: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('create_president_proposal', {
        p_title: title,
        p_description: description,
        p_type: type
      });
      if (error) throw error;
      toast.success('Proposal submitted successfully');
      fetchProposals();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const postAnnouncement = async (message: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('post_president_announcement', {
        p_message: message
      });
      if (error) throw error;
      toast.success('Announcement posted');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const spendTreasury = async (amount: number, reason: string) => {
    setLoading(true);
    try {
      // Amount in cents
      const amountCents = Math.floor(amount * 100);
      const { error } = await supabase.rpc('spend_president_treasury', {
        p_amount_cents: amountCents,
        p_reason: reason
      });
      if (error) throw error;
      toast.success('Treasury funds spent');
      fetchTreasuryBalance();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const flagUser = async (userId: string, reason: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('president_flag_user', {
        p_target_user_id: userId,
        p_reason: reason
      });
      if (error) throw error;
      toast.success('User flagged for review');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const raisePayouts = async (amount: number) => {
      setLoading(true);
      try {
          const { error } = await supabase.rpc('president_raise_payouts', {
              p_amount_cents: amount * 100 // Convert to cents
          });
          if (error) throw error;
          toast.success(`Payouts raised by $${amount}!`);
          fetchTreasuryBalance();
      } catch (err: any) {
          toast.error(err.message);
      } finally {
          setLoading(false);
      }
  };

  const appointVP = async (userId: string) => {
      setLoading(true);
      try {
          const { error } = await supabase.rpc('appoint_vice_president', {
              p_appointee_id: userId
          });
          if (error) throw error;
          toast.success('Vice President appointed!');
          fetchVicePresident();
      } catch (err: any) {
          toast.error(err.message);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    fetchCurrentElection();
    fetchCurrentPresident();
    fetchPresidentAppointment();
    fetchVicePresident();
    fetchTreasuryBalance();
    fetchProposals();
  }, [fetchCurrentElection, fetchCurrentPresident, fetchPresidentAppointment, fetchVicePresident, fetchTreasuryBalance, fetchProposals]);

  const isPresident = currentPresident?.user_id === user?.id;
  const isVP = currentVP?.vice_president_user_id === user?.id;

  const refresh = useCallback(async () => {
    try {
      await Promise.all([
        fetchCurrentElection(),
        fetchCurrentPresident(),
        fetchPresidentAppointment(),
        fetchVicePresident(),
        fetchTreasuryBalance(),
        fetchProposals()
      ]);
    } catch (err) {
      console.warn('Refresh error:', err);
    }
  }, [fetchCurrentElection, fetchCurrentPresident, fetchPresidentAppointment, fetchVicePresident, fetchTreasuryBalance, fetchProposals]);

  return {
    currentElection,
    currentPresident,
    currentVP,
    isPresident,
    isVP,
    treasuryBalance,
    proposals,
    loading,
    refresh,
    createElection,
    finalizeElection,
    endElection,
    deleteElection,
    allElections,
    fetchAllElections,
    signupCandidate,
    approveCandidate,
    rejectCandidate,
    voteForCandidate,
    voteWithCoins,
    createProposal,
    postAnnouncement,
    spendTreasury,
    flagUser,
    raisePayouts,
    appointVP,
    fetchProposals
  };
};
