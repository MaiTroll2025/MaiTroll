export const SITE_URL = 'https://www.maitroll.com'
export const SITE_NAME = 'MaiTroll'
export const SITE_ALT_NAME = 'MaiTroll'

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: SITE_ALT_NAME,
    url: SITE_URL,
    description: 'MaiTroll is a live social broadcasting platform where creators go live, battle, build communities, interact with viewers, send gifts and grow their audience.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  }
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    alternateName: SITE_ALT_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: 'MaiTroll (MaiTroll) is a live social broadcasting and content-sharing platform for creators, streamers, gamers, and online communities.',
    sameAs: [SITE_URL],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      url: `${SITE_URL}/support`
    }
  }
}

export function videoObjectSchema(stream: {
  name: string
  description: string
  thumbnailUrl: string
  uploadDate: string
  duration?: string
  embedUrl?: string
  creatorName?: string
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: stream.name,
    description: stream.description,
    thumbnailUrl: stream.thumbnailUrl,
    uploadDate: stream.uploadDate,
    publisher: {
      '@type': 'Organization',
      name: SITE_ALT_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` }
    }
  }
  if (stream.duration) schema.duration = stream.duration
  if (stream.embedUrl) schema.embedUrl = stream.embedUrl
  if (stream.creatorName) {
    schema.creator = {
      '@type': 'Person',
      name: stream.creatorName,
      url: `${SITE_URL}/profile/${stream.creatorName}`
    }
  }
  return schema
}

export function productSchema(product: {
  name: string
  description: string
  image: string
  price: number
  priceCurrency?: string
  url: string
  availability?: string
  brand?: string
  sellerName?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image,
    url: product.url,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: product.priceCurrency || 'USD',
      availability: product.availability || 'https://schema.org/InStock',
      seller: product.sellerName
        ? { '@type': 'Person', name: product.sellerName }
        : undefined
    }
  }
}

export function eventSchema(event: {
  name: string
  description: string
  startDate: string
  endDate?: string
  location?: string
  image?: string
  url: string
  organizerName?: string
  eventType?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: event.location
      ? { '@type': 'Place', name: event.location }
      : { '@type': 'VirtualLocation', url: event.url },
    image: event.image,
    url: event.url,
    organizer: event.organizerName
      ? { '@type': 'Person', name: event.organizerName }
      : { '@type': 'Organization', name: SITE_ALT_NAME }
  }
}

export function breadcrumbSchema(items: { name: string; url?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  }
}

export function profilePageSchema(profile: {
  name: string
  description?: string
  image?: string
  url: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: profile.name,
      description: profile.description,
      image: profile.image,
      url: profile.url,
      sameAs: [profile.url]
    }
  }
}

export function jobPostingSchema(job: {
  title: string
  description: string
  url: string
  datePosted: string
  employmentType?: string
  hiringOrganization?: string
  jobLocation?: string
  baseSalary?: { value: number; currency: string; unitText: string }
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    url: job.url,
    datePosted: job.datePosted,
    employmentType: job.employmentType || 'OTHER',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.hiringOrganization || SITE_ALT_NAME,
      sameAs: SITE_URL
    },
    jobLocation: job.jobLocation
      ? { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Remote' } }
      : undefined,
    baseSalary: job.baseSalary
      ? {
          '@type': 'MonetaryAmount',
          currency: job.baseSalary.currency || 'USD',
          value: {
            '@type': 'QuantitativeValue',
            value: job.baseSalary.value,
            unitText: job.baseSalary.unitText || 'YEAR'
          }
        }
      : undefined
  }
}

export function collectionPageSchema(data: {
  name: string
  description: string
  url: string
  itemCount?: number
  items?: { name: string; url: string }[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: data.name,
    description: data.description,
    url: data.url,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL
    },
    numberOfItems: data.itemCount,
    mainEntity: data.items
      ? {
          '@type': 'ItemList',
          itemListElement: data.items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            url: item.url
          }))
        }
      : undefined
  }
}

export function articleSchema(article: {
  headline: string
  description: string
  image?: string
  datePublished: string
  dateModified?: string
  authorName: string
  url: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.headline,
    description: article.description,
    image: article.image,
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    author: {
      '@type': 'Person',
      name: article.authorName
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_ALT_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` }
    },
    url: article.url,
    mainEntityOfPage: article.url
  }
}

export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  }
}
