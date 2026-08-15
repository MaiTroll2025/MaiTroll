export interface SubscriberEmote {
  id: string
  name: string
  url: string
  tiers: string[]
}

export const SUBSCRIBER_EMOTES: SubscriberEmote[] = [
  { id: 'fan_heart', name: '<3', url: '/emotes/fan_heart.png', tiers: ['Fan', 'VIP', 'Elite', 'Mythic'] },
  { id: 'fan_cool', name: ':)', url: '/emotes/fan_cool.png', tiers: ['Fan', 'VIP', 'Elite', 'Mythic'] },
  { id: 'vip_crown', name: 'VIP', url: '/emotes/vip_crown.png', tiers: ['VIP', 'Elite', 'Mythic'] },
  { id: 'vip_fire', name: 'FIRE', url: '/emotes/vip_fire.png', tiers: ['VIP', 'Elite', 'Mythic'] },
  { id: 'elite_gem', name: 'GEM', url: '/emotes/elite_gem.png', tiers: ['Elite', 'Mythic'] },
  { id: 'elite_star', name: 'STAR', url: '/emotes/elite_star.png', tiers: ['Elite', 'Mythic'] },
  { id: 'mythic_king', name: 'KING', url: '/emotes/mythic_king.png', tiers: ['Mythic'] },
  { id: 'mythic_queen', name: 'QUEEN', url: '/emotes/mythic_queen.png', tiers: ['Mythic'] },
]

export function getEmotesForTier(tierName: string | null): SubscriberEmote[] {
  if (!tierName) return []
  return SUBSCRIBER_EMOTES.filter(emote => emote.tiers.includes(tierName))
}

export function parseEmotesInText(text: string): { text: string; emotes: { start: number; end: number; emote: SubscriberEmote }[] } {
  const emotes: { start: number; end: number; emote: SubscriberEmote }[] = []
  const cleanText = text

  for (const emote of SUBSCRIBER_EMOTES) {
    const regex = new RegExp(`\\b${emote.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
    let match
    while ((match = regex.exec(text)) !== null) {
      emotes.push({ start: match.index, end: match.index + match[0].length, emote })
    }
  }

  emotes.sort((a, b) => a.start - b.start)

  return { text: cleanText, emotes }
}
