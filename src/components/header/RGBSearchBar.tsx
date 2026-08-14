
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, User, Radio, Play, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface ExploreStream {
  id: string;
  title: string;
  category: string | null;
  viewer_count: number | null;
  current_viewers: number | null;
  broadcaster_id: string | null;
  user_profiles?: { username: string; avatar_url: string | null } | null;
}

interface ExploreUser {
  id: string;
  username: string;
  avatar_url: string | null;
  is_admin?: boolean;
  role?: string | null;
}

const ITEMS_PER_PAGE = 6;

const RGBSearchBar = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user)
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Explore (discovery) panel state
  const [exploreStreams, setExploreStreams] = useState<ExploreStream[]>([]);
  const [exploreUsers, setExploreUsers] = useState<ExploreUser[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const exploreLoadedRef = useRef(false);

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load the Explore (discovery) feed: live streams + suggested people.
  // This mirrors the data fetching used by the Explore feed but surfaces it
  // directly inside the search bar so the contents of Explore live here.
  const loadExplore = useCallback(async () => {
    if (exploreLoadedRef.current) return;
    setExploreLoading(true);
    try {
      // Live streams
      const { data: streamsData } = await supabase
        .from('streams')
        .select('id, title, category, viewer_count, current_viewers, is_live, broadcaster_id')
        .or('is_live.eq.true,status.eq.live')
        .order('viewer_count', { ascending: false })
        .limit(ITEMS_PER_PAGE);

      let liveStreams: ExploreStream[] = [];
      if (streamsData && streamsData.length > 0) {
        const broadcasterIds = Array.from(
          new Set((streamsData as any[]).map((s) => s.broadcaster_id).filter(Boolean)),
        );
        let broadcasterMap = new Map<string, any>();
        if (broadcasterIds.length > 0) {
          const { data: broadcasters } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', broadcasterIds);
          if (broadcasters) {
            broadcasterMap = new Map((broadcasters as any[]).map((b) => [b.id, b]));
          }
        }
        liveStreams = (streamsData as any[]).map((stream) => ({
          ...stream,
          user_profiles: broadcasterMap.get(stream.broadcaster_id) || null,
        }));
      }

      // Suggested people (newest profiles)
      const { data: usersData } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, is_admin, role')
        .order('created_at', { ascending: false })
        .limit(ITEMS_PER_PAGE);

      setExploreStreams(liveStreams);
      setExploreUsers((usersData as ExploreUser[]) || []);
      exploreLoadedRef.current = true;
    } catch (err) {
      console.error('Explore load error:', err);
    } finally {
      setExploreLoading(false);
    }
  }, []);

  // Search for users when query changes (only for explicit searches)
  useEffect(() => {
    const searchUsers = async () => {
      const searchTerm = query.trim().replace('@', '').toLowerCase();

      if (searchTerm.length < 3) {
        setResults([]);
        return;
      }

      setIsLoading(true);

      try {
        const searchQuery = searchTerm.substring(0, 3);

        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .ilike('username', `${searchQuery}%`)
          .limit(10)
          .order('username', { ascending: true });

        if (error) {
          console.error('Search error:', error);
          setResults([]);
        } else {
          setResults(data || []);
        }
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const closePanel = () => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  const handleSelect = (user: SearchResult) => {
    closePanel();
    // Navigate by id so the profile page fetches the correct user
    navigate(`/profile/id/${user.id}`);
  };

  const handleStreamClick = (streamId: string, username?: string | null) => {
    closePanel();
    if (!user) {
      toast.info('Sign in to watch.')
      navigate('/auth')
      return
    }
    if (username) {
      navigate(`/live/${encodeURIComponent(username)}`)
    } else {
      navigate(`/watch/${streamId}`);
    }
  };

  const handleUserClick = (user: ExploreUser) => {
    closePanel();
    // Navigate by id so the profile page fetches the correct user
    navigate(`/profile/id/${user.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const trimmed = query.trim();
  const showExplore = isOpen && trimmed.length < 3;
  const showResults = isOpen && trimmed.length >= 3 && results.length > 0;

  return (
    <div ref={wrapperRef} className="relative group w-full max-w-md">
      <div
        className={cn(
          'absolute -inset-0.5 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 ',
          'rounded-full blur-md opacity-50 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-tilt'
        )}
      />
      <div className="relative flex items-center">
        <div className={cn("absolute left-3", isMobile ? "left-2" : "left-4")}>
          <Search className={cn("text-slate-500", isMobile ? "w-4 h-4" : "w-5 h-5")} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (trimmed.length < 3) {
              loadExplore();
            }
            setIsOpen(true);
          }}
          placeholder={isMobile ? "Search or explore..." : "Search or explore Mai Troll..."}
          className={cn(
            'w-full rounded-full text-white placeholder-slate-500',
            'bg-slate-900/80 border border-slate-700/50 backdrop-blur-sm',
            'focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all',
            isMobile
              ? 'pl-8 pr-3 py-2 text-sm'
              : 'pl-12 pr-4 py-2.5'
          )}
        />
      </div>

      {/* Explore (discovery) panel */}
      {showExplore && (
        <div className={cn(
          "absolute top-full mt-2 bg-slate-800/95 backdrop-blur-lg rounded-xl border border-slate-700 shadow-2xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto",
          isMobile ? "w-80 max-w-[calc(100vw-2rem)]" : "w-full"
        )}>
          {exploreLoading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-slate-400">
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading explore...</span>
            </div>
          ) : (
            <div className="py-2">
              {/* Live streams */}
              <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-red-400" /> Live Now
              </div>
              {exploreStreams.length === 0 ? (
                <div className="px-4 py-2 text-sm text-slate-500">No live streams right now</div>
              ) : (
                exploreStreams.map((stream) => (
                  <button
                    key={stream.id}
                    onClick={() => handleStreamClick(stream.id, stream.user_profiles?.username)}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0 flex items-center justify-center">
                      {stream.user_profiles?.avatar_url ? (
                        <img src={stream.user_profiles.avatar_url} alt={stream.user_profiles.username} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-white" />
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-slate-800" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">{stream.title || 'Untitled Stream'}</div>
                      <div className="truncate text-xs text-slate-400">
                        @{stream.user_profiles?.username || 'unknown'} · {(stream.current_viewers || stream.viewer_count || 0)} watching
                      </div>
                    </div>
                    <Play className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </button>
                ))
              )}

              {/* Suggested people */}
              <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 flex items-center gap-1.5">
                <Users className="w-3 h-3 text-cyan-400" /> Suggested People
              </div>
              {exploreUsers.length === 0 ? (
                <div className="px-4 py-2 text-sm text-slate-500">No suggestions</div>
              ) : (
                exploreUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserClick(user)}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-700/50 transition-colors text-left"
                  >
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <span className="text-white font-medium truncate">@{user.username}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Search Results Dropdown */}
      {showResults && (
        <div className={cn(
          "absolute top-full mt-2 bg-slate-800/95 backdrop-blur-lg rounded-xl border border-slate-700 shadow-2xl overflow-hidden z-50",
          isMobile ? "w-80 max-w-[calc(100vw-2rem)]" : "w-full"
        )}>
          <div className="py-2 max-h-80 overflow-y-auto">
            {results.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelect(user)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700/50 transition-colors text-left"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                <span className="text-white font-medium">@{user.username}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading indicator (explicit search) */}
      {isLoading && trimmed.length >= 3 && (
        <div className={cn(
          "absolute top-full mt-2 bg-slate-800/95 backdrop-blur-lg rounded-xl border border-slate-700 shadow-xl p-4 z-50",
          isMobile ? "w-80 max-w-[calc(100vw-2rem)]" : "w-full"
        )}>
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Searching...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RGBSearchBar;
