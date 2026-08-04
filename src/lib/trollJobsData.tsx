import type { ReactNode } from 'react'
import {
  Briefcase,
  Shield,
  FileText,
  Users,
  Cross,
  Video,
  Star,
  Store,
  Newspaper,
  Mic,
  Radio,
} from 'lucide-react'

export interface JobPosition {
  id: string
  title: string
  department: string
  description: string
  requirements: string[]
  benefits: string[]
  icon: ReactNode
  color: string
}

export const jobPositions: JobPosition[] = [
  {
    id: 'lead_officer',
    title: 'Lead Troll Officer',
    department: 'Leadership',
    description:
      'Senior enforcement role overseeing Troll Officers. Reviews cases, escalates decisions, and ensures city rules are applied consistently.',
    requirements: [
      'Previous Troll Officer experience',
      'Strong leadership and communication skills',
      'Ability to train and mentor new officers',
      'Strategic thinking and problem-solving',
      'Commitment to platform success',
    ],
    benefits: [
      'Leadership role with higher responsibility',
      'Access to admin dashboard',
      'Platform-wide influence',
      'Community recognition as leader',
    ],
    icon: <Star className="h-6 w-6" />,
    color: 'from-yellow-500 to-orange-500',
  },
  {
    id: 'troll_officer',
    title: 'Troll Officer',
    department: 'Moderation',
    description:
      'Official city enforcer responsible for moderation, investigations, reports, and real-time response to violations.',
    requirements: [
      'Previous moderation experience',
      'Strong understanding of community guidelines',
      'Ability to handle difficult situations calmly',
      'Available for regular shifts',
      'Good judgment and decision-making skills',
    ],
    benefits: [
      'Special officer role and badge',
      'Access to officer-only channels',
      'Contribution to platform growth',
      'Recognition in community',
    ],
    icon: <Shield className="h-6 w-6" />,
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'attorney',
    title: 'Troll Court Attorney',
    department: 'Troll Court',
    description:
      'Defense attorney representing defendants in Troll Court. Advocates for clients, presents cases, and ensures fair proceedings.',
    requirements: [
      'Strong legal knowledge and reasoning',
      'Excellent communication skills',
      'Ability to build persuasive arguments',
      'Available for court sessions',
      'Professional demeanor',
    ],
    benefits: [
      'Attorney role and badge',
      'Access to court case system',
      'Represent clients in court',
      'Build reputation as advocate',
    ],
    icon: <FileText className="h-6 w-6" />,
    color: 'from-amber-500 to-yellow-500',
  },
  {
    id: 'prosecutor',
    title: 'Troll Court Prosecutor',
    department: 'Troll Court',
    description:
      'Prosecuting attorney representing the city in criminal cases. Presents evidence, questions witnesses, and seeks justice.',
    requirements: [
      'Understanding of criminal procedure',
      'Strong presentation skills',
      'Ability to examine evidence critically',
      'Available for court sessions',
      'Commitment to justice',
    ],
    benefits: [
      'Prosecutor role and badge',
      'Access to case management',
      'Present cases in court',
      'City-wide recognition',
    ],
    icon: <Users className="h-6 w-6" />,
    color: 'from-red-500 to-orange-500',
  },
  {
    id: 'pastor',
    title: 'Pastor',
    department: 'Spiritual',
    description:
      'Community and church leader role. Hosts services, events, and counseling while maintaining respectful and safe environments.',
    requirements: [
      'Strong faith and biblical knowledge',
      'Ability to lead discussions and studies',
      'Compassion and guidance skills',
      'Availability for church events',
      'Respect for all community members',
    ],
    benefits: [
      'Pastor role and recognition',
      'Lead church-related content',
      'Community spiritual guidance',
      'Special pastor channels',
    ],
    icon: <Cross className="h-6 w-6" />,
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'troller',
    title: 'Troller',
    department: 'Broadcasting',
    description:
      'Entertainer role focused on playful chaos, satire, and disruption that stays within platform rules and policies.',
    requirements: [
      'Must be 18 years or older',
      'Ability to create engaging content',
      'Stable internet connection',
      'Basic streaming equipment',
      'Good communication skills',
    ],
    benefits: [
      'Earn coins from viewer engagement',
      'Access to Troll Officer community',
      'Potential for platform-wide promotion',
      'Network with other creators',
    ],
    icon: <Video className="h-6 w-6" />,
    color: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'seller',
    title: 'Seller',
    department: 'Commerce',
    description:
      'Verified merchant role. Authorized to sell goods, services, or digital items within the marketplace under city rules.',
    requirements: [
      'Must be verified user',
      'Clear business plan or product list',
      'Adherence to commerce policies',
      'Good reputation in community',
      'Ability to fulfill orders promptly',
    ],
    benefits: [
      'Authorized seller badge',
      'Access to marketplace features',
      'Ability to list items/services',
      'Secure transaction processing',
    ],
    icon: <Store className="h-6 w-6" />,
    color: 'from-indigo-500 to-violet-500',
  },
  {
    id: 'journalist',
    title: 'Journalist',
    department: 'TCNN - News',
    description:
      'Content creator for Mai Troll News Network. Write articles, conduct investigations, and keep the city informed with accurate reporting.',
    requirements: [
      'Strong writing and communication skills',
      'Ability to research and verify facts',
      'Understanding of journalistic ethics',
      'Active community participation',
      'Commitment to unbiased reporting',
    ],
    benefits: [
      'Journalist badge and recognition',
      'Earn tips from article readers',
      'Access to TCNN content dashboard',
      'Potential to advance to News Caster',
    ],
    icon: <Newspaper className="h-6 w-6" />,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'news_caster',
    title: 'News Caster',
    department: 'TCNN - Broadcasting',
    description:
      'On-air personality for TCNN. Deliver breaking news, host live broadcasts, and engage with the community through official city news streams.',
    requirements: [
      'Previous journalism or broadcasting experience',
      'Professional on-camera presence',
      'Ability to think on your feet',
      'Knowledge of current events',
      'Must be at least 18 years old',
    ],
    benefits: [
      'News Caster badge and recognition',
      'Ability to go live on TCNN channel',
      'Submit ticker messages',
      'Earn tips from viewers',
      'Platform-wide visibility',
    ],
    icon: <Mic className="h-6 w-6" />,
    color: 'from-red-500 to-orange-500',
  },
  {
    id: 'chief_news_caster',
    title: 'Chief News Caster',
    department: 'TCNN - Leadership',
    description:
      'Lead the TCNN news team. Manage journalists and news casters, approve breaking news, and maintain editorial standards for city-wide broadcasts.',
    requirements: [
      'Previous News Caster or journalism leadership experience',
      'Strong editorial judgment',
      'Leadership and team management skills',
      'Deep understanding of platform community',
      'Commitment to journalistic integrity',
    ],
    benefits: [
      'Chief News Caster badge and authority',
      'Manage TCNN team members',
      'Approve breaking news tickers',
      'Access to TCNN analytics dashboard',
      'Highest level of TCNN recognition',
    ],
    icon: <Radio className="h-6 w-6" />,
    color: 'from-amber-500 to-yellow-500',
  },
  {
    id: 'auctioneer',
    title: 'Auctioneer',
    department: 'Live Auctions',
    description:
      'Host live auction shows where users bid on items using Mai Troll coins. Create exciting 24/7 auction experiences and manage your own auction studio.',
    requirements: [
      'Must be 18 years or older',
      'Good standing in community (no recent violations)',
      'Ability to host engaging live shows',
      'Understanding of auctioneer responsibilities',
      'Reliable internet and streaming setup',
    ],
    benefits: [
      'Create and host live auction shows',
      'Access to Auctioneer Studio dashboard',
      'Earn from successful auctions',
      'Build reputation as trusted auctioneer',
      'Moderate bidders in your auction rooms',
    ],
    icon: <Star className="h-6 w-6" />,
    color: 'from-green-500 to-emerald-500',
  },
]

export const getJobPosition = (id: string) => jobPositions.find((position) => position.id === id)

export const getApplicationRoute = (jobId: string): string => {
  // All job applications now go through the main Application page with position parameter
  return `/apply?position=${jobId}`
}
