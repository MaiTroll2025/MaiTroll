import { supabase } from './supabase'
import type { CityAd, PromoAdCardProps } from '../types/cityAds'

// Types for maitalent integration
export interface MaitalentPromo {
  id: string
  title: string
  image_url: string
  cta_link: string
  subtitle?: string
  label?: string
  description?: string
  background_style?: string
  click_tracking_id?: string
  impression_tracking_id?: string
  // Additional maitalent-specific fields
  platform: 'maitalent'
  campaign_id?: string
  start_date: string
  end_date?: string
  target_audience?: {
    platforms?: string[]
    countries?: string[]
    age_range?: [number, number]
  }
}

export interface MaitalentIntegrationOptions {
  // Enable/disable specific integration features
  enableRealtimeUpdates?: boolean
  enableTracking?: boolean
  enableDynamicTargeting?: boolean
  // Optional callback for custom processing
  onPromoUpdate?: (promo: MaitalentPromo) => void
}

export class MaitalentIntegrator {
  private options: MaitalentIntegrationOptions
  private channel: any

  constructor(options: MaitalentIntegrationOptions = {}) {
    this.options = options
    this.channel = null
    this.setupIntegration()
  }

  private async setupIntegration() {
    // Subscribe to maitalent promo updates if realtime is enabled
    if (this.options.enableRealtimeUpdates) {
      try {
        this.channel = supabase
          .channel('maitalent_promo_updates')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'maitalent_promos',
          }, (payload) => {
            if (payload.new) {
              this.handlePromoUpdate(payload.new)
            }
          })
          .subscribe()
      } catch (error) {
        console.warn('[MaitalentIntegrator] Failed to subscribe to updates', error)
      }
    }
  }

  private handlePromoUpdate(promo: MaitalentPromo) {
    // Dispatch update to Mai Troll promo system
    window.dispatchEvent(new CustomEvent('maitalent-promo-update', { detail: promo }))
    
    // Optional custom callback
    if (this.options.onPromoUpdate) {
      this.options.onPromoUpdate(promo)
    }
  }

  // Get active promos from maitalent platform
  async fetchActivePromos() {
    try {
      const { data, error } = await supabase
        .from('maitalent_promos')
        .select('*')
        .eq('status', 'active')
        .order('start_date', { ascending: true })

      if (error) throw error
      
      // Filter based on current user context
      return this.applyRLSPolicies(data || [])
    } catch (error) {
      console.error('[MaitalentIntegrator] Failed to fetch promos', error)
      return []
    }
  }

  // Apply RLS policies to promos based on current user
  private applyRLSPolicies(promos: MaitalentPromo[]): MaitalentPromo[] {
    // In a real implementation, this would check RLS conditions
    // For now, we'll filter based on simple criteria
    
    return promos.filter(promo => {
      // Allow public promos
      if (promo.label?.includes('Public') || !promo.label) return true
      
      // Check if user is authorized (simplified)
      const userRoles = this.getUserRoles()
      const isAdminOrMod = userRoles.includes('admin') || userRoles.includes('moderator')
      
      // Allow if user is admin/moderator, or if promo is public
      return isAdminOrMod || !promo.label?.includes('Private')
    })
  }

  // Get current user roles (simplified)
  private getUserRoles(): string[] {
    // This would check user's profile/role in the system
    // For now, return empty array - in reality would query supabase user profile
    return []
  }

  // Track promo impression/click
  async trackEvent(eventType: 'impression' | 'click', promoId: string) {
    try {
      const { error } = await supabase.rpc('track_maitalent_promo_event', {
        p_promo_id: promoId,
        p_event_type: eventType
      })
      if (error) throw error
    } catch (error) {
      console.error('[MaitalentIntegrator] Event tracking failed', error)
    }
  }

  // Cleanup subscription on unmount
  cleanup() {
    if (this.channel) {
      supabase.removeChannel(this.channel)
      this.channel = null
    }
  }
}

// Export singleton instance for easy access
export const maitalentIntegrator = new MaitalentIntegrator({
  enableRealtimeUpdates: true,
  enableTracking: true,
  enableDynamicTargeting: true
})