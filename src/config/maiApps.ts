// MAI Network Apps Configuration
// Copy this config and update for each MAI platform

export interface MaiApp {
  id: string;
  name: string;
  tagline: string;
  category: string;
  websiteUrl: string;
  googlePlayUrl?: string;
  appleStoreUrl?: string;
  status: 'live' | 'beta' | 'coming_soon';
  theme: 'city' | 'premium' | 'corporate' | 'auto' | 'health' | 'food' | 'payments';
  logoUrl?: string; // Optional: custom logo image URL
}

export const MAI_APPS: MaiApp[] = [
  {
    id: 'troll-city',
    name: 'MaiTroll',
    tagline: 'Go live, earn coins, enter the virtual city.',
    category: 'Live Social City',
    websiteUrl: 'https://maiMaiTroll.com',
    googlePlayUrl: '',
    appleStoreUrl: '',
    status: 'live',
    theme: 'city',
  },
  {
    id: 'maiplay',
    name: 'MaiPlay',
    tagline: 'Shorts, movies, music, and creator monetization.',
    category: 'Creator Video Platform',
    websiteUrl: 'https://maiplay.cloud',
    googlePlayUrl: '',
    appleStoreUrl: '',
    status: 'beta',
    theme: 'premium',
  },
  {
    id: 'maicorp',
    name: 'MaiCorp',
    tagline: 'The official home of the MAI ecosystem.',
    category: 'Corporate',
    websiteUrl: 'https://maicorp.online',
    googlePlayUrl: '',
    appleStoreUrl: '',
    status: 'live',
    theme: 'corporate',
  },
  {
    id: 'udryve-auto',
    name: 'UDryve Auto',
    tagline: 'Automotive services powered by MAI.',
    category: 'Auto',
    websiteUrl: 'https://udryveauto.com',
    googlePlayUrl: '',
    appleStoreUrl: '',
    status: 'coming_soon',
    theme: 'auto',
  },
  {
    id: 'udryve-health',
    name: 'UDryve Health',
    tagline: 'Health services in the UDryve network.',
    category: 'Health',
    websiteUrl: 'https://udryvehealth.com',
    googlePlayUrl: '',
    appleStoreUrl: '',
    status: 'coming_soon',
    theme: 'health',
  },
  {
    id: 'udryve-food',
    name: 'UDryve Food',
    tagline: 'Food delivery and local food services.',
    category: 'Food',
    websiteUrl: 'https://udryvefood.com',
    googlePlayUrl: '',
    appleStoreUrl: '',
    status: 'coming_soon',
    theme: 'food',
  },
  {
    id: 'maipay',
    name: 'MaiPay',
    tagline: 'Coins, payouts, and future MAI payments.',
    category: 'Payments',
    websiteUrl: 'https://maipay.app',
    googlePlayUrl: '',
    appleStoreUrl: '',
    status: 'coming_soon',
    theme: 'payments',
  },
];

// Theme color mapping for different MAI platforms
export const MAI_THEMES = {
  city: {
    primary: 'from-cyan-500 to-blue-600',
    secondary: 'bg-cyan-500/10',
    accent: 'text-cyan-400',
    border: 'border-cyan-500/30',
    button: 'bg-cyan-600 hover:bg-cyan-500',
    badgeLive: 'bg-green-500',
    badgeBeta: 'bg-purple-500',
    badgeComing: 'bg-orange-500',
  },
  premium: {
    primary: 'from-red-500 to-yellow-500',
    secondary: 'bg-red-500/10',
    accent: 'text-red-400',
    border: 'border-red-500/30',
    button: 'bg-red-600 hover:bg-red-500',
    badgeLive: 'bg-green-500',
    badgeBeta: 'bg-purple-500',
    badgeComing: 'bg-orange-500',
  },
  corporate: {
    primary: 'from-gray-700 to-gray-900',
    secondary: 'bg-gray-700/10',
    accent: 'text-gray-300',
    border: 'border-gray-500/30',
    button: 'bg-gray-700 hover:bg-gray-600',
    badgeLive: 'bg-green-500',
    badgeBeta: 'bg-purple-500',
    badgeComing: 'bg-orange-500',
  },
  auto: {
    primary: 'from-blue-600 to-indigo-700',
    secondary: 'bg-blue-600/10',
    accent: 'text-blue-400',
    border: 'border-blue-500/30',
    button: 'bg-blue-700 hover:bg-blue-600',
    badgeLive: 'bg-green-500',
    badgeBeta: 'bg-purple-500',
    badgeComing: 'bg-orange-500',
  },
  health: {
    primary: 'from-green-500 to-emerald-600',
    secondary: 'bg-green-500/10',
    accent: 'text-green-400',
    border: 'border-green-500/30',
    button: 'bg-green-600 hover:bg-green-500',
    badgeLive: 'bg-green-500',
    badgeBeta: 'bg-purple-500',
    badgeComing: 'bg-orange-500',
  },
  food: {
    primary: 'from-orange-500 to-red-500',
    secondary: 'bg-orange-500/10',
    accent: 'text-orange-400',
    border: 'border-orange-500/30',
    button: 'bg-orange-600 hover:bg-orange-500',
    badgeLive: 'bg-green-500',
    badgeBeta: 'bg-purple-500',
    badgeComing: 'bg-orange-500',
  },
  payments: {
    primary: 'from-yellow-500 to-amber-600',
    secondary: 'bg-yellow-500/10',
    accent: 'text-yellow-400',
    border: 'border-yellow-500/30',
    button: 'bg-yellow-600 hover:bg-yellow-500',
    badgeLive: 'bg-green-500',
    badgeBeta: 'bg-purple-500',
    badgeComing: 'bg-orange-500',
  },
};
