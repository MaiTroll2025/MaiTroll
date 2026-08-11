import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useEPaperStories,
  useEPaperStory,
  useIncrementEPaperViews,
  useTipEPaperStory,
  useUniverseEvents,
} from '@/hooks/useEPaper';
import { useAuthStore } from '@/lib/store';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Newspaper,
  Star,
  Clock,
  Heart,
  TrendingUp,
  Eye,
  AlertCircle,
  Loader2,
  CalendarClock,
  Trophy,
  Mic2,
  Swords,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  Globe2,
  Tv,
} from 'lucide-react';
import type { EPaperStory, UniverseNewspaperEvent } from '@/types/supporterEconomy';

const EVENT_META: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  show: {
    label: 'Mai Sing Off',
    icon: Mic2,
    className: 'border-pink-400/30 bg-pink-500/10 text-pink-300',
  },
  championship: {
    label: 'Championship',
    icon: Trophy,
    className: 'border-yellow-400/30 bg-yellow-500/10 text-yellow-300',
  },
  battle: {
    label: 'Troll Battle',
    icon: Swords,
    className: 'border-red-400/30 bg-red-500/10 text-red-300',
  },
  arrest: {
    label: 'Jail Report',
    icon: ShieldAlert,
    className: 'border-orange-400/30 bg-orange-500/10 text-orange-300',
  },
  universe: {
    label: 'Universe Event',
    icon: Globe2,
    className: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300',
  },
  showdown: {
    label: 'Showdown',
    icon: Sparkles,
    className: 'border-purple-400/30 bg-purple-500/10 text-purple-300',
  },
};

function EventIcon({ event }: { event: UniverseNewspaperEvent }) {
  const meta = EVENT_META[event.event_type] ?? EVENT_META.show;
  const Icon = meta.icon;
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.className}`}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

function EventBadge({ event }: { event: UniverseNewspaperEvent }) {
  const meta = EVENT_META[event.event_type] ?? EVENT_META.show;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function EventsSection({ events }: { events: UniverseNewspaperEvent[] }) {
  const navigate = useNavigate();

  if (events.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-500/15 bg-[#0A0814]">
      <header className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-cyan-600/10 to-blue-600/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">
            City Event Board
          </h2>
        </div>
        <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
          {events.length} upcoming
        </span>
      </header>

      <div className="divide-y divide-white/5">
        {events.slice(0, 8).map((event) => {
          const meta = EVENT_META[event.event_type] ?? EVENT_META.show;
          const date = event.occurs_at ? new Date(event.occurs_at) : null;
          const prize =
            event.meta?.grand_prize_coins != null
              ? Number(event.meta.grand_prize_coins).toLocaleString()
              : null;

          return (
            <button
              key={`${event.event_type}-${event.id}`}
              type="button"
              onClick={() => navigate(event.route)}
              className="group flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03]"
            >
              <EventIcon event={event} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-bold text-white">
                    {event.title}
                  </h3>
                  <EventBadge event={event} />
                </div>

                {event.subtitle && (
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {event.subtitle}
                  </p>
                )}

                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                  {date && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {date.toLocaleDateString()}{' '}
                      {date.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}

                  {prize && (
                    <span className="flex items-center gap-1 text-yellow-400">
                      <Trophy className="h-3 w-3" />
                      {prize} prize pool
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-cyan-400" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function EPaperPage() {
  const {
    data: stories = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useEPaperStories(10, 0, 'published');

  const {
    data: events = [],
    isLoading: isEventsLoading,
    isError: isEventsError,
  } = useUniverseEvents(40);

  const [selectedStorySlug, setSelectedStorySlug] = useState<string | null>(
    null
  );
  const [tipAmount, setTipAmount] = useState('');
  const [tipMessage, setTipMessage] = useState('');

  const {
    data: selectedStory,
    isLoading: isStoryLoading,
    isError: isStoryError,
  } = useEPaperStory(selectedStorySlug);

  const incrementViews = useIncrementEPaperViews();
  const tipMutation = useTipEPaperStory();
  const { profile } = useAuthStore();

  const handleStoryClick = (clickedStory: EPaperStory) => {
    setSelectedStorySlug(clickedStory.slug);

    incrementViews.mutate(clickedStory.id);
  };

  const handleTip = () => {
    const amount = Number.parseInt(tipAmount, 10);

    if (
      !selectedStory?.id ||
      !profile?.id ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return;
    }

    tipMutation.mutate(
      {
        story_id: selectedStory.id,
        tipper_id: profile.id,
        amount,
        coin_type: 'troll_coins',
        message: tipMessage.trim() || undefined,
      },
      {
        onSuccess: () => {
          setTipAmount('');
          setTipMessage('');
        },
      }
    );
  };

  return (
    <main className="min-h-screen bg-[#05040A] px-4 py-6 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* ===================== NEWSPAPER MASTHEAD ===================== */}
        <header className="relative overflow-hidden rounded-2xl border border-cyan-500/15 bg-gradient-to-r from-[#0A0814] via-[#0E0A1A] to-[#0A0814] px-6 py-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 15% 20%, rgba(34,211,238,.25), transparent 35%), radial-gradient(circle at 85% 40%, rgba(236,72,153,.2), transparent 35%)',
            }}
          />

          <div className="relative flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2">
                <Newspaper className="h-6 w-6 text-cyan-400" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">
                The Troll City Times
              </span>
            </div>

            <h1 className="font-serif text-4xl font-black uppercase tracking-wide text-white sm:text-5xl">
              E<span className="text-cyan-400">Paper</span>
            </h1>

            <p className="max-w-xl text-sm text-slate-400">
              The live newspaper for Mai Troll — battle results, broadcast
              milestones, championships, and the city&apos;s upcoming events.
            </p>

            <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span className="flex items-center gap-1">
                <Tv className="h-3 w-3 text-pink-400" />
                Live Entertainment
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Trophy className="h-3 w-3 text-yellow-400" />
                Championships
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3 w-3 text-cyan-400" />
                Upcoming Events
              </span>
            </div>
          </div>
        </header>

        {/* ===================== EVENTS FEED ===================== */}
        {isEventsLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0A0814] p-4 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading city events…
          </div>
        ) : isEventsError ? (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
            <AlertCircle className="h-4 w-4" />
            The city event board is momentarily unavailable.
          </div>
        ) : (
          <EventsSection events={events} />
        )}

        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card
                key={index}
                className="animate-pulse border-white/10 bg-[#0A0814]"
              >
                <CardContent className="space-y-3 p-5">
                  <div className="h-5 w-3/4 rounded bg-white/10" />
                  <div className="h-3 w-1/2 rounded bg-white/10" />
                  <div className="h-16 rounded bg-white/10" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <Card className="border-red-500/30 bg-red-500/10">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <AlertCircle className="h-8 w-8 text-red-400" />

              <div>
                <h2 className="font-bold text-white">
                  EPaper could not be loaded
                </h2>
                <p className="mt-1 max-w-xl text-sm text-red-200/70">
                  {error instanceof Error
                    ? error.message
                    : 'An unknown database error occurred.'}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => refetch()}
                className="border-red-400/30"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && stories.length === 0 && (
          <Card className="border-white/10 bg-[#0A0814]">
            <CardContent className="py-16 text-center">
              <Newspaper className="mx-auto h-12 w-12 text-slate-600" />

              <h2 className="mt-4 text-lg font-bold text-white">
                The first edition is being prepared
              </h2>

              <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
                No EPaper stories have been published yet. Battle results,
                broadcast milestones, wishlist completions, top gifters, and
                TCNN articles will appear here.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && stories.length > 0 && (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
                <Star className="h-3.5 w-3.5" />
                Latest Stories
              </h2>

              {stories.map((epaperStory) => (
                <Card
                  key={epaperStory.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer border-white/10 bg-[#0A0814] transition hover:border-cyan-500/40"
                  onClick={() => handleStoryClick(epaperStory)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleStoryClick(epaperStory);
                    }
                  }}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      {epaperStory.is_breaking && (
                        <Star className="mt-1 h-4 w-4 shrink-0 text-red-400" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          {epaperStory.is_breaking && (
                            <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400">
                              Breaking
                            </span>
                          )}

                          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                            {epaperStory.category || 'General'}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-white">
                          {epaperStory.title}
                        </h3>

                        {epaperStory.excerpt && (
                          <p className="mt-2 line-clamp-3 text-sm text-slate-400">
                            {epaperStory.excerpt}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>
                            {epaperStory.author_name || 'EPaper Desk'}
                          </span>

                          {epaperStory.published_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(
                                epaperStory.published_at
                              ).toLocaleDateString()}
                            </span>
                          )}

                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {epaperStory.view_count ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <aside>
              {!selectedStorySlug && (
                <Card className="border-white/10 bg-[#0A0814]">
                  <CardContent className="py-14 text-center">
                    <Newspaper className="mx-auto h-10 w-10 text-slate-600" />
                    <p className="mt-3 text-sm text-slate-400">
                      Select a story to read the full article.
                    </p>
                  </CardContent>
                </Card>
              )}

              {selectedStorySlug && isStoryLoading && (
                <Card className="border-white/10 bg-[#0A0814]">
                  <CardContent className="flex items-center justify-center gap-2 py-14 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading story
                  </CardContent>
                </Card>
              )}

              {selectedStorySlug && isStoryError && (
                <Card className="border-red-500/30 bg-red-500/10">
                  <CardContent className="py-10 text-center text-sm text-red-300">
                    This story could not be loaded.
                  </CardContent>
                </Card>
              )}

              {selectedStory && (
                <Card className="border-white/10 bg-[#0A0814]">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center gap-2">
                      {selectedStory.is_breaking && (
                        <Star className="h-4 w-4 text-red-400" />
                      )}

                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                        {selectedStory.category || 'General'}
                      </span>
                    </div>

                    <CardTitle className="text-xl font-black leading-tight text-white">
                      {selectedStory.title}
                    </CardTitle>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>
                        {selectedStory.author_name || 'EPaper Desk'}
                      </span>

                      {selectedStory.published_at && (
                        <span>
                          {new Date(
                            selectedStory.published_at
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <article className="space-y-3 text-sm leading-7 text-slate-300">
                      {(selectedStory.content || '')
                        .split('\n')
                        .filter(Boolean)
                        .map((line, index) => (
                          <p key={`${selectedStory.id}-${index}`}>{line}</p>
                        ))}
                    </article>

                    <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-4">
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Heart className="h-3.5 w-3.5" />
                        <span>{selectedStory.tip_count ?? 0} tips</span>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>
                          {Number(
                            selectedStory.tip_total_coins ?? 0
                          ).toLocaleString()}{' '}
                          coins
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Eye className="h-3.5 w-3.5" />
                        <span>{selectedStory.view_count ?? 0} views</span>
                      </div>
                    </div>

                    {profile ? (
                      <div className="space-y-2 border-t border-white/10 pt-4">
                        <p className="text-xs font-semibold text-slate-400">
                          Tip this EPaper story
                        </p>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            type="number"
                            inputMode="numeric"
                            placeholder="Coins"
                            value={tipAmount}
                            onChange={(event) =>
                              setTipAmount(event.target.value)
                            }
                            className="bg-white/5 text-white sm:w-28"
                            min={1}
                          />

                          <Input
                            placeholder="Message (optional)"
                            value={tipMessage}
                            onChange={(event) =>
                              setTipMessage(event.target.value)
                            }
                            className="flex-1 bg-white/5 text-white"
                          />

                          <Button
                            type="button"
                            onClick={handleTip}
                            disabled={
                              tipMutation.isPending ||
                              !tipAmount ||
                              Number.parseInt(tipAmount, 10) <= 0
                            }
                          >
                            {tipMutation.isPending ? 'Sending...' : 'Tip'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="border-t border-white/10 pt-4 text-xs text-slate-500">
                        Sign in to tip an EPaper story.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}

