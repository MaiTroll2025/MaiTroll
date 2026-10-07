import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
// import { TUTORIAL_PAGES, CREATOR_TUTORIAL_PAGES } from '@/components/TutorialWalkthrough'
const TUTORIAL_PAGES = []
const CREATOR_TUTORIAL_PAGES = []
import { 
  X, Camera, Image, ExternalLink, Home, Users, MessageSquare, 
  Gift, Trophy, Wallet, Play, Video, Sparkles
} from 'lucide-react'

const SCREENSHOT_PAGES = [
  { id: 'home', path: '/', title: 'Homepage', aspect: 'desktop' },
  { id: 'auctions', path: '/auctions', title: 'Live Auctions', aspect: 'desktop' },
  { id: 'live', path: '/', title: 'Live Tab', aspect: 'desktop' },
  { id: 'utromail', path: '/utromail', title: 'Utromail Chat', aspect: 'desktop' },
  { id: 'leaderboard', path: '/leaderboard', title: 'Leaderboard', aspect: 'desktop' },
  { id: 'store', path: '/store', title: 'Coin Store', aspect: 'desktop' },
  { id: 'marketplace', path: '/marketplace', title: 'Marketplace', aspect: 'desktop' },
  { id: 'creator', path: '/creator-switch', title: 'Creator Mode', aspect: 'desktop' },
  { id: 'broadcast', path: '/broadcast/setup', title: 'Go Live Setup', aspect: 'desktop' },
]

export default function ScreenshotCapture() {
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(0)
  const [captureMode, setCaptureMode] = useState(false)
  
  const page = SCREENSHOT_PAGES[currentPage]
  
  const nextPage = () => {
    if (currentPage < SCREENSHOT_PAGES.length - 1) {
      setCurrentPage(currentPage + 1)
    }
  }
  
  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }
  
  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/dev" className="text-slate-400 hover:text-white transition-colors flex items-center gap-2">
              <X size={20} /> Back to Dev Menu
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={prevPage}
              disabled={currentPage === 0}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-white">
              {currentPage + 1} / {SCREENSHOT_PAGES.length}
            </span>
            <button
              onClick={nextPage}
              disabled={currentPage === SCREENSHOT_PAGES.length - 1}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Page Preview */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="bg-slate-800 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-purple-400" />
                  <span className="font-medium text-white">{page.title}</span>
                </div>
                <a
                  href={page.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
                >
                  Open in new tab <ExternalLink size={14} />
                </a>
              </div>
              
              <div className="aspect-video bg-slate-950 flex items-center justify-center relative">
                <div className="text-center">
                  <Image className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-500">
                    Navigate to /{page.path} and take a screenshot
                  </p>
                  <p className="text-slate-600 text-sm mt-2">
                     Use your browser&apos;s screenshot tool or extension
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Instructions */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-purple-400" />
                Screenshot Guide
              </h2>
              
              <div className="space-y-4 text-slate-300">
                <div className="p-4 rounded-xl bg-slate-800/50">
                  <h3 className="font-medium text-white mb-2">1. Navigate to each page</h3>
                   <p className="text-sm">Use the Previous/Next buttons or click &quot;Open in new tab&quot;</p>
                </div>
                
                <div className="p-4 rounded-xl bg-slate-800/50">
                  <h3 className="font-medium text-white mb-2">2. Take screenshot</h3>
                  <p className="text-sm">
                    Windows: Win+Shift+S for region, or use browser extension<br/>
                    Mac: Cmd+Shift+4 for region
                  </p>
                </div>
                
                <div className="p-4 rounded-xl bg-slate-800/50">
                  <h3 className="font-medium text-white mb-2">3. Save files</h3>
                  <p className="text-sm">
                    Save as PNG to public/screenshots/<br/>
                    Format: {page.id}.png (e.g., home.png, auctions.png)
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <h3 className="font-bold text-white mb-3">Recommended Resolution</h3>
              <div className="space-y-2 text-sm text-slate-400">
                <p>Desktop: 1280x720 or 1920x1080</p>
                <p>Mobile: 375x812 (iPhone X)</p>
                <p className="text-slate-500">Take both desktop and mobile versions</p>
              </div>
            </div>
            
            <a
              href={page.path}
              target="_blank"
              className="block w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-center flex items-center justify-center gap-2" rel="noreferrer"
            >
              <ExternalLink size={18} />
              Go to {page.title}
            </a>
          </div>
        </div>
        
        {/* Page List */}
        <div className="mt-8">
          <h3 className="text-lg font-bold text-white mb-4">Pages to capture ({SCREENSHOT_PAGES.length})</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
            {SCREENSHOT_PAGES.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setCurrentPage(i)}
                className={`p-3 rounded-lg text-center transition-all ${
                  i === currentPage
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <div className="text-xs font-medium">{p.title}</div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Tutorial Pages Reference */}
        <div className="mt-8">
          <h3 className="text-lg font-bold text-white mb-4">All Tutorial Pages (for reference in descriptions)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {TUTORIAL_PAGES.map(page => (
              <div key={page.id} className="p-2 rounded bg-slate-800/50 text-center">
                <div className="text-xs text-slate-400">{page.title}</div>
                <div className="text-[10px] text-slate-600">{page.path}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}