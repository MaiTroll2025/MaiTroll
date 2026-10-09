import { useEffect, useState } from 'react';
import type { AdPlacement, CityAd } from '../types/cityAds';
import { supabase } from '../lib/supabase';

export function useCityAds(placement: AdPlacement) {
  const [ads, setAds] = useState<CityAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAds() {
      try {
        const { data, error } = await supabase
          .from('city_ads')
          .select('*')
          .eq('placement', placement)
          .eq('is_active', true)
          .or('start_at.is.null,start_at.lte.' + new Date().toISOString())
          .or('end_at.is.null,end_at.gte.' + new Date().toISOString())
          .order('priority', { ascending: false })
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAds(data || []);
      } catch (error) {
        console.error('Failed to fetch ads:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAds();
  }, [placement]);

  return { ads, loading };
}
