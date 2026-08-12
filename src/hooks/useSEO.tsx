import { useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'

export interface SEOConfig {
  title: string
  description: string
  keywords?: string[]
  ogImage?: string
  ogType?: string
  ogVideo?: string
  canonical?: string
  robots?: string
  structuredData?: object | object[]
  author?: string
  publishedTime?: string
  modifiedTime?: string
  section?: string
  tags?: string[]
}

function setMetaTag(property: string, content: string, isName = false) {
  if (!content) return
  const selector = isName ? `meta[name="${property}"]` : `meta[property="${property}"]`
  let meta = document.querySelector(selector) as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    if (isName) {
      meta.setAttribute('name', property)
    } else {
      meta.setAttribute('property', property)
    }
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', content)
}

function setLinkTag(rel: string, href: string) {
  if (!href) return
  let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.appendChild(link)
  }
  link.href = href
}

function injectStructuredData(data: object, id: string) {
  const existing = document.querySelector(`#jsonld-${id}`)
  if (existing) existing.remove()

  const script = document.createElement('script')
  script.id = `jsonld-${id}`
  script.type = 'application/ld+json'
  script.textContent = JSON.stringify(data)
  document.head.appendChild(script)
}

function removeStructuredData(id: string) {
  const existing = document.querySelector(`#jsonld-${id}`)
  if (existing) existing.remove()
}

function removeAllJsonLd() {
  document.querySelectorAll('script[id^="jsonld-"]').forEach(el => el.remove())
}

export default function useSEO(config: SEOConfig) {
  const location = useLocation()
  const canonicalUrl = config.canonical || `https://www.maitroll.com${location.pathname}`
  const imageUrl = config.ogImage || `https://www.maitroll.com/images/mai-troll-city-preview.png`

  const applySEO = useCallback(() => {
    document.title = config.title

    setMetaTag('description', config.description, true)
    if (config.keywords && config.keywords.length > 0) {
      setMetaTag('keywords', config.keywords.join(', '), true)
    }
    if (config.robots) {
      setMetaTag('robots', config.robots, true)
    }

    setMetaTag('og:title', config.title)
    setMetaTag('og:description', config.description)
    setMetaTag('og:url', canonicalUrl)
    setMetaTag('og:type', config.ogType || 'website')
    setMetaTag('og:site_name', 'MaiTroll')
    setMetaTag('og:image', imageUrl)
    setMetaTag('og:image:alt', `${config.title} - MaiTroll`)
    setMetaTag('og:image:width', '1200')
    setMetaTag('og:image:height', '630')
    setMetaTag('og:locale', 'en_US')

    if (config.ogVideo) {
      setMetaTag('og:video', config.ogVideo)
      setMetaTag('og:video:type', 'text/html')
      setMetaTag('og:video:width', '1280')
      setMetaTag('og:video:height', '720')
    }

    if (config.author) setMetaTag('og:author', config.author, true)
    if (config.publishedTime) setMetaTag('article:published_time', config.publishedTime)
    if (config.modifiedTime) setMetaTag('article:modified_time', config.modifiedTime)
    if (config.section) setMetaTag('article:section', config.section)
    if (config.tags && config.tags.length > 0) {
      config.tags.forEach(tag => setMetaTag('article:tag', tag))
    }

    setMetaTag('twitter:card', 'summary_large_image', true)
    setMetaTag('twitter:title', config.title, true)
    setMetaTag('twitter:description', config.description, true)
    setMetaTag('twitter:image', imageUrl, true)
    setMetaTag('twitter:image:alt', `${config.title} - MaiTroll`, true)


    setLinkTag('canonical', canonicalUrl)

    removeAllJsonLd()

    if (config.structuredData) {
      const schemas = Array.isArray(config.structuredData) ? config.structuredData : [config.structuredData]
      schemas.forEach((schema, index) => {
        injectStructuredData(schema, `page-${index}`)
      })
    }
  }, [config.title, config.description, config.keywords, config.robots, config.ogType, config.ogVideo, config.author, config.publishedTime, config.modifiedTime, config.section, config.tags, canonicalUrl, imageUrl])

  useEffect(() => {
    applySEO()
    return () => {
      removeAllJsonLd()
    }
  }, [applySEO, location.pathname])
}
