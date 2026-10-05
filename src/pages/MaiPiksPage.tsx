import useSEO from '@/hooks/useSEO'
import PhoneMaiPiks from '@/phone/pages/PhoneMaiPiks'

export default function MaiPiksPage() {
  useSEO({
    title: 'MaiPiks | Share Photos and Stories',
    description: 'Capture moments, share photos and stories, and connect with the MaiTroll community through MaiPiks.',
    keywords: ['MaiPiks', 'MaiTroll photos', 'social stories', 'share photos online'],
    canonical: 'https://www.maitroll.com/mai-piks',
    robots: 'index, follow',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'MaiPiks',
      url: 'https://www.maitroll.com/mai-piks',
      applicationCategory: 'SocialNetworkingApplication',
      description: 'Capture and share photos and stories with the MaiTroll community.',
    },
  })

  return <PhoneMaiPiks />
}