import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Eye, Home, Mail, HelpCircle, Shield, FileText, MessageCircle, ChevronRight, Share2, Twitter, Facebook, Linkedin } from 'lucide-react'
import useSEO from '@/hooks/useSEO'

interface SEOPageProps {
  children: React.ReactNode
  title: string
  description: string
  keywords?: string[]
  ogImage?: string
}

const navLinks = [
  { path: '/about', label: 'About', icon: Home },
  { path: '/contact', label: 'Contact', icon: Mail },
  { path: '/support', label: 'Support', icon: HelpCircle },
  { path: '/faq', label: 'FAQ', icon: MessageCircle },
]

export default function SEOLayout({ children, title, description, keywords = [], ogImage }: SEOPageProps) {
  const location = useLocation()

  useSEO({
    title: `${title} | Mai Troll`,
    description,
    keywords,
    ogImage
  })

  React.useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://maiMaiTroll.com'
  const canonicalUrl = `${origin}${location.pathname}`

  const handleShare = async () => {
    const shareData = { title: `${title} | Mai Troll`, url: canonicalUrl }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch {}
    } else {
      try { await navigator.clipboard.writeText(canonicalUrl) } catch {}
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Mai Troll</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive = location.pathname === link.path
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-purple-600/20 text-purple-300'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                )
              })}
            </nav>
            <div className="flex items-center gap-3">
              <button
                onClick={handleShare}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="Share this page"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <Link
                to="/auth"
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/auth"
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {children}
      </main>

      <footer className="bg-slate-950 border-t border-slate-800 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-slate-400 hover:text-purple-300 transition-colors">About Us</Link></li>
                <li><Link to="/contact" className="text-slate-400 hover:text-purple-300 transition-colors">Contact</Link></li>
                <li><Link to="/faq" className="text-slate-400 hover:text-purple-300 transition-colors">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Support</h3>
              <ul className="space-y-2">
                <li><Link to="/support" className="text-slate-400 hover:text-purple-300 transition-colors">Help Center</Link></li>
                <li><Link to="/contact" className="text-slate-400 hover:text-purple-300 transition-colors">Submit a Ticket</Link></li>
                <li><a href="mailto:Mai Troll2025@gmail.com" className="text-slate-400 hover:text-purple-300 transition-colors">Email Us</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link to="/privacy" className="text-slate-400 hover:text-purple-300 transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-slate-400 hover:text-purple-300 transition-colors">Terms of Service</Link></li>
                <li><Link to="/legal/safety" className="text-slate-400 hover:text-purple-300 transition-colors">Safety Guidelines</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Follow Us</h3>
              <div className="flex items-center gap-3">
                <a href="https://twitter.com/Mai Troll" target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-700 transition-colors" aria-label="Twitter">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="https://facebook.com/Mai Troll" target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-700 transition-colors" aria-label="Facebook">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="https://linkedin.com/company/Mai Troll" target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-700 transition-colors" aria-label="LinkedIn">
                  <Linkedin className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <Eye className="w-4 h-4 text-white" />
              </div>
              <span className="text-slate-400">&copy; 2026 Mai Troll (MaiMaiTroll). All rights reserved.</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/privacy" className="text-slate-500 hover:text-purple-400 text-sm transition-colors">Privacy</Link>
              <Link to="/terms" className="text-slate-500 hover:text-purple-400 text-sm transition-colors">Terms</Link>
              <Link to="/sitemap.xml" className="text-slate-500 hover:text-purple-400 text-sm transition-colors">Sitemap</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function Breadcrumb({ items }: { items: { label: string; path?: string }[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm mb-8" aria-label="Breadcrumb">
      <Link to="/" className="text-purple-300 hover:text-purple-200 transition-colors">Home</Link>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="w-4 h-4 text-slate-500" />
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

export function SEOContentSection({
  title,
  description,
  icon: Icon,
  children
}: {
  title: string
  description: string
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <section className="py-16 border-b border-slate-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-purple-400" />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
            <p className="text-slate-300 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="mt-8">
          {children}
        </div>
      </div>
    </section>
  )
}

export function CTASection({
  title,
  description,
  primaryAction,
  secondaryAction
}: {
  title: string
  description: string
  primaryAction: { label: string; path: string }
  secondaryAction?: { label: string; path: string }
}) {
  return (
    <section className="py-20 bg-gradient-to-r from-purple-900/30 to-pink-900/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">{title}</h2>
        <p className="text-slate-300 mb-8">{description}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to={primaryAction.path}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            {primaryAction.label}
          </Link>
          {secondaryAction && (
            <Link
              to={secondaryAction.path}
              className="px-8 py-3 border border-slate-600 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
