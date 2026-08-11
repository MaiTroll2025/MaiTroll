import React, { useState } from 'react';
import { useEPaperStories, useEPaperStory, useIncrementEPaperViews, useTipEPaperStory } from '@/hooks/useEPaper';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Newspaper, Star, Clock, ArrowLeft, Heart, MessageCircle, TrendingUp, Eye } from 'lucide-react';
import type { EPaperStory, EPaperStoryTip } from '@/types/supporterEconomy';

export function EPaperPage() {
  const { data: stories, isLoading } = useEPaperStories(10, 0, 'published');
  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState('');
  const [tipMessage, setTipMessage] = useState('');

  const { data: story } = useEPaperStory(selectedStory ?? '');
  const incrementViews = useIncrementEPaperViews();
  const tipMutation = useTipEPaperStory();
  const { profile } = useAuthStore();

  const handleStoryClick = (slug: string) => {
    setSelectedStory(slug);
    if (story) {
      incrementViews.mutate(story.id);
    }
  };

  const handleTip = () => {
    if (!tipAmount || !profile) return;
    tipMutation.mutate({
      story_id: story?.id ?? '',
      tipper_id: profile.id,
      amount: parseInt(tipAmount),
      coin_type: 'troll_coins',
      message: tipMessage || undefined,
    });
    setTipAmount('');
    setTipMessage('');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="bg-[#0A0814] border-white/10 animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-white/10 rounded w-3/4" />
              <div className="h-3 bg-white/10 rounded w-1/2 mt-2" />
              <div className="h-16 bg-white/10 rounded mt-3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Newspaper className="h-5 w-5 text-cyan-400" />
        <h2 className="text-lg font-bold text-white">EPaper</h2>
      </div>

      {stories && stories.length > 0 ? (
        <div className="space-y-3">
          {stories.map((story) => (
            <Card
              key={story.id}
              className="bg-[#0A0814] border-white/10 cursor-pointer hover:border-cyan-500/30 transition-colors"
              onClick={() => handleStoryClick(story.slug)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {story.is_breaking && (
                    <Star className="h-4 w-4 text-red-400 shrink-0 mt-1" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      {story.title}
                    </h3>
                    {story.excerpt && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {story.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                      <span>{story.author_name ?? 'Unknown'}</span>
                      <span>{story.category}</span>
                      {story.published_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-2 w-2" />
                          {new Date(story.published_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500 text-sm">
          No stories published yet
        </div>
      )}

      {story && selectedStory && (
        <Card className="bg-[#0A0814] border-white/10 mt-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {story.is_breaking && (
                <Star className="h-4 w-4 text-red-400" />
              )}
              <CardTitle className="text-base font-bold text-white">
                {story.title}
              </CardTitle>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{story.author_name ?? 'Unknown'}</span>
              <span>{story.category}</span>
              <span>{story.published_at ? new Date(story.published_at).toLocaleDateString() : ''}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm max-w-none text-slate-300">
              {story.content.split('\n').map((line, i) => (
                <p key={i} className="mb-2">
                  {line}
                </p>
              ))}
            </div>

            <div className="flex items-center gap-4 pt-2 border-t border-white/10">
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Heart className="h-3 w-3" />
                <span>{story.tip_count} tips</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <TrendingUp className="h-3 w-3" />
                <span>{story.tip_total_coins.toLocaleString()} coins</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Eye className="h-3 w-3" />
                <span>{story.view_count} views</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Amount"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                className="w-24 bg-white/5 border-white/10 text-white text-sm"
                min={1}
              />
              <Input
                placeholder="Message (optional)"
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-sm"
              />
              <Button
                size="sm"
                onClick={handleTip}
                disabled={!tipAmount || parseInt(tipAmount) <= 0}
              >
                Tip
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}