import { Component, ErrorInfo, ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'

interface Props {
  children: ReactNode
}

function PhonePageName({ pathname }: { pathname: string }) {
  const pageName = pathname.split('/').filter(Boolean).pop() || 'Home'
  return (
    <span className="text-slate-400">
      {pageName}
    </span>
  )
}

export default function PhoneErrorBoundary({ children }: Props) {
  const location = useLocation()

  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen w-full bg-[#07020F] text-white flex flex-col items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-900/90 border border-red-500/30 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-white mb-1">Page Error</h1>
                <p className="text-red-400 font-mono text-sm break-all">
                  <PhonePageName pathname={location.pathname} />
                </p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Something went wrong while loading this page. Please try refreshing.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-semibold transition-all"
            >
              🔄 Refresh Page
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
