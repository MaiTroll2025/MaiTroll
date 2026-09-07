import { Camera, Image, LogIn, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import useSEO from '@/hooks/useSEO'

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

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#05030d] px-6 py-20 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="max-w-2xl">
          <div className="mb-6 flex items-center gap-3 text-cyan-300">
            <Sparkles size={20} />
            <span className="text-sm font-bold uppercase tracking-[0.22em]">MaiTroll social</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">MaiPiks</h1>
          <p className="mt-6 text-xl leading-8 text-slate-300">
            Capture the moment, share your world, and discover photos and stories from the MaiTroll community.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300">
              <LogIn size={18} />
              Sign in to use MaiPiks
            </Link>
            <Link to="/mai-record-label" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 font-bold text-white hover:border-cyan-300/60">
              <Image size={18} />
              Explore MaiTroll music
            </Link>
          </div>
        </div>

        <section className="mt-20 grid gap-5 sm:grid-cols-2" aria-label="MaiPiks features">
          <article className="border border-white/10 bg-white/[0.04] p-6">
            <Camera className="text-cyan-300" size={24} />
            <h2 className="mt-4 text-xl font-bold">Share in the moment</h2>
            <p className="mt-2 text-slate-400">Use MaiPiks to capture photos and short videos from wherever you are.</p>
          </article>
          <article className="border border-white/10 bg-white/[0.04] p-6">
            <Image className="text-fuchsia-300" size={24} />
            <h2 className="mt-4 text-xl font-bold">Find your community</h2>
            <p className="mt-2 text-slate-400">Follow people on MaiTroll and see their public MaiPiks stories and posts.</p>
          </article>
        </section>
      </div>
    </main>
  )
}