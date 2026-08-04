import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import useSEO, { type SEOConfig } from '@/hooks/useSEO'
import { SITE_URL } from '@/utils/seoSchemas'

interface SEOPageProps extends SEOConfig {
  children: React.ReactNode
  breadcrumbItems?: { label: string; path?: string }[]
  className?: string
}

export default function SEOPage({
  children,
  breadcrumbItems,
  className,
  ...seoConfig
}: SEOPageProps) {
  useSEO({
    ...seoConfig,
    structuredData: seoConfig.structuredData
      ? [websiteSchemaStub(), ...(Array.isArray(seoConfig.structuredData) ? seoConfig.structuredData : [seoConfig.structuredData])]
      : websiteSchemaStub()
  })

  return (
    <div className={className}>
      {breadcrumbItems && (
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <ol className="flex items-center gap-2 text-sm" itemScope itemType="https://schema.org/BreadcrumbList">
            {breadcrumbItems.map((item, index) => (
              <li key={index} className="flex items-center gap-2" itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                {index > 0 && <ChevronRight className="w-4 h-4 text-slate-500" />}
                {item.path ? (
                  <Link to={item.path} className="text-purple-300 hover:text-purple-200 transition-colors" itemProp="item">
                    <span itemProp="name">{item.label}</span>
                  </Link>
                ) : (
                  <span className="text-slate-400" itemProp="name">{item.label}</span>
                )}
                <meta itemProp="position" content={String(index + 1)} />
              </li>
            ))}
          </ol>
        </nav>
      )}
      {children}
    </div>
  )
}

function websiteSchemaStub() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MaiTroll',
    alternateName: 'MaiMaiTroll',
    url: SITE_URL,
    description: 'MaiTroll is a social streaming platform for creators, streamers, gamers, and online communities.',
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

export function Breadcrumb({ items }: { items: { label: string; path?: string }[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm mb-8" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight className="w-4 h-4 text-slate-500" />}
          {item.path ? (
            <Link to={item.path} className="text-purple-300 hover:text-purple-200 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-400">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
