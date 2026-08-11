import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EPaperStory, EPaperStoryTip, CreateEPaperStoryInput, TipEPaperStoryInput, UniverseNewspaperEvent } from '@/types/supporterEconomy';

export function useEPaperStories(p_limit: number = 10, p_offset: number = 0, p_status: string = 'published') {
  return useQuery<EPaperStory[]>({
    queryKey: ['epaper-stories', p_limit, p_offset, p_status],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_epaper_stories', {
        p_limit,
        p_offset,
        p_status,
      });

      if (error) throw error;
      return data as EPaperStory[];
    },
    staleTime: 60000,
  });
}

export function useEPaperStory(p_slug: string | null) {
  return useQuery<EPaperStory>({
    queryKey: ['epaper-story', p_slug],
    queryFn: async () => {
      if (!p_slug) {
        throw new Error('A story slug is required');
      }

      const { data, error } = await supabase
        .from('epaper_stories')
        .select('*')
        .eq('slug', p_slug)
        .eq('status', 'published')
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    enabled: Boolean(p_slug),
    staleTime: 60000,
  });
}

export function useIncrementEPaperViews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (p_storyId: string) => {
      const { error } = await supabase.rpc('increment_epaper_views', { p_story_id: p_storyId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epaper-stories'] });
    },
  });
}

export function useTipEPaperStory() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; error: string | null; tip_id: string }, Error, TipEPaperStoryInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.rpc('tip_epaper_story', {
        p_story_id: input.story_id,
        p_tipper_id: input.tipper_id,
        p_amount: input.amount,
        p_coin_type: input.coin_type,
        p_message: input.message,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epaper-stories'] });
    },
  });
}

export function useUniverseEvents(limit: number = 40) {
  return useQuery<UniverseNewspaperEvent[]>({
    queryKey: ['universe-events', limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('epaper_get_universe_events', { p_limit: limit });
      if (error) throw error;
      return (data as UniverseNewspaperEvent[]) ?? [];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useCreateEPaperStory() {
  const queryClient = useQueryClient();

  return useMutation<EPaperStory, Error, CreateEPaperStoryInput>({
    mutationFn: async (input) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.from('epaper_stories').insert({
        title: input.title,
        slug: input.slug,
        excerpt: input.excerpt,
        content: input.content,
        featured_image_url: input.featured_image_url,
        author_id: input.author_id,
        category: input.category ?? 'general',
        tags: input.tags ?? [],
        is_breaking: input.is_breaking ?? false,
        status: 'draft',
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epaper-stories'] });
    },
  });
}